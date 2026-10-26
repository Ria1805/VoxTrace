"""Tamper-evident evidence log (owner: Tanay).

Wording for the paper: call this a *tamper-evident detection and evidence-integrity log*.
It is not a full chain of custody (it does not yet record who handled evidence, transfers
or exports), and it does NOT give non-repudiation (HMAC is a shared secret). See
THREAT_MODEL.md for exactly what it does and does not detect.

Protection layers
  1. Hash chain     - each record_hash covers its fields, its position (seq) and the
                      previous record_hash. Editing, deleting, inserting, reordering or
                      renumbering a record breaks the chain.
  2. Signatures     - each record_hash is HMAC-SHA256 signed with a key that is never
                      stored in the DB and (by enforcement) never in the DB's directory.
                      Without the key, a DB writer cannot recompute a valid chain.
  3. Local anchor   - signed (count, head) file next to the DB, rewritten after every
                      commit. Catches deletion of the newest records.
  4. External head  - every commit also appends a signed JSON line to `siem_log_path`
                      (the file Wazuh ships off the box). verify(trusted_head=...) checks
                      the DB against a head obtained from there. This is the only layer
                      that catches rollback to an old DB+anchor backup or a full wipe.
  5. Evidence files - every file (audio AND video) is hashed; the pipeline hashes them
                      BEFORE scoring and the ledger refuses to log if they changed since.
"""
from __future__ import annotations

import hashlib, hmac, json, math, os, sqlite3, stat, sys, tempfile, threading, time

GENESIS = "0" * 64
KEY_BYTES = 32
_REC, _ANC = "voxtrace-record-v2\0", "voxtrace-anchor-v2\0"   # domain separation
_COLUMNS = ["seq", "ts", "evidence_path", "evidence_sha256", "evidence_files",
            "audio_score", "video_score", "fused_score", "verdict", "model_versions",
            "ioc_matches", "playbook_actions", "actor"]


class LedgerError(Exception):
    """Ledger misconfiguration or an integrity problem that blocks writing."""


# --------------------------------------------------------------------------- hashing
def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def hash_evidence(paths) -> list[dict]:
    """Hash evidence files. Call this on receipt, BEFORE analysis, and pass the result
    to log_incident(..., evidence_files=...) so a file swapped mid-analysis is caught."""
    paths = [paths] if isinstance(paths, (str, os.PathLike)) else list(paths)
    if not paths:
        raise ValueError("at least one evidence file is required")
    return [{"path": os.path.abspath(p), "sha256": sha256_file(p)} for p in paths]


# --------------------------------------------------------------------------- keys
def generate_key_file(key_path: str) -> str:
    """Create a new 32-byte key file (mode 0600). Fails if the file already exists.
    Run once at setup:  python -m voxtrace.custody genkey /secure/place/ledger.key"""
    key_path = os.path.abspath(os.path.expanduser(key_path))
    d = os.path.dirname(key_path)
    os.makedirs(d, mode=0o700, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".keytmp-")
    try:
        os.write(fd, os.urandom(KEY_BYTES).hex().encode())
        os.fsync(fd)
        os.close(fd)
        if os.name != "nt":
            os.chmod(tmp, 0o600)
        try:
            os.link(tmp, key_path)      # atomic, and fails if key_path exists
        except FileExistsError:
            raise
        except OSError:                 # no hard links (FAT/exFAT USB, some SMB shares)
            with open(tmp) as f:
                data = f.read()
            out = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(out, "w") as f:
                f.write(data); f.flush(); os.fsync(f.fileno())
    finally:
        try: os.unlink(tmp)
        except FileNotFoundError: pass
    return key_path


def load_key(key_path: str | None = None) -> bytes:
    """Key from $VOXTRACE_LEDGER_KEY (64 hex chars) or a key file. Never auto-created:
    silently making a fresh key would make every past record look forged."""
    env = os.environ.get("VOXTRACE_LEDGER_KEY")
    if env and key_path:
        raise LedgerError("both VOXTRACE_LEDGER_KEY and a key file are set; use exactly one "
                          "(an environment variable silently overriding the key file is unsafe)")
    if env:
        raw = env.strip()
    else:
        if not key_path:
            raise LedgerError("no ledger key: set VOXTRACE_LEDGER_KEY or pass key_path "
                              "(create one with: python -m voxtrace.custody genkey <path>)")
        if not os.path.exists(key_path):
            raise LedgerError(f"ledger key file not found: {key_path}")
        if os.name != "nt":
            st = os.stat(key_path)
            if st.st_mode & (stat.S_IRWXG | stat.S_IRWXO):
                raise LedgerError(f"ledger key {key_path} is readable by others; run chmod 600 "
                                  "(on WSL /mnt/c or Docker bind mounts chmod has no effect: "
                                  "use VOXTRACE_LEDGER_KEY instead)")
            if hasattr(os, "getuid") and st.st_uid != os.getuid():
                raise LedgerError(f"ledger key {key_path} is not owned by the service user")
        with open(key_path) as f:
            raw = f.read().strip()
    try:
        key = bytes.fromhex(raw)
    except ValueError:
        raise LedgerError("ledger key is not valid hex") from None
    if len(key) != KEY_BYTES:
        raise LedgerError(f"ledger key must be {KEY_BYTES} bytes, got {len(key)}")
    return key


def key_fingerprint(key: bytes) -> str:
    """Safe to publish/record off-box; lets an examiner confirm which key signed."""
    return hashlib.sha256(b"voxtrace-key-fp\0" + key).hexdigest()[:16]


# --------------------------------------------------------------------------- helpers
def _num(x):
    """Scores must round-trip through SQLite REAL unchanged, or the hash breaks."""
    if x is None:
        return None
    if isinstance(x, bool):
        raise TypeError("score must be a number, not bool")
    f = float(x)
    if not math.isfinite(f):
        raise ValueError(f"score must be finite, got {x!r}")
    return f


def _replace(src, dst, tries=10):
    for i in range(tries):           # Windows: retry if dst is briefly open elsewhere
        try:
            return os.replace(src, dst)
        except PermissionError:
            if i == tries - 1:
                raise
            time.sleep(0.05)


# --------------------------------------------------------------------------- ledger
class CustodyLedger:
    def __init__(self, db_path: str, key_path: str | None = None, *, key: bytes | None = None,
                 anchor_path: str | None = None, siem_log_path: str | None = None,
                 read_only: bool = False):
        """read_only=True opens an exported copy for an examiner: verify() works, writes don't."""
        self.db_path = os.path.abspath(db_path)
        self.anchor_path = os.path.abspath(anchor_path or self.db_path + ".head")
        self.siem_log_path = os.path.abspath(siem_log_path) if siem_log_path else None
        if key is None:
            if key_path:
                # Check the path as written AND as resolved: a symlink (to the key or to its
                # folder) that lives inside the data folder could be re-pointed by anyone who
                # can write there, letting them swap in their own key.
                key_forms = {os.path.abspath(os.path.expanduser(key_path)),
                             os.path.realpath(os.path.expanduser(key_path))}
                data_dirs = set()
                for f in (self.db_path, self.anchor_path):
                    data_dirs |= {os.path.dirname(os.path.abspath(f)), os.path.dirname(os.path.realpath(f))}
                for kp in key_forms:
                    for d in data_dirs:
                        try: inside = os.path.commonpath([kp, d]) == d
                        except ValueError: inside = False      # different drives on Windows
                        if inside:
                            raise LedgerError("refusing a key file inside the ledger's data folder "
                                              f"({d}), directly or via a symlink: anyone who can "
                                              "write there could swap the key and re-sign history")
            key = load_key(key_path)
        if len(key) != KEY_BYTES:
            raise LedgerError(f"ledger key must be {KEY_BYTES} bytes")
        self.key = key
        self.key_fp = key_fingerprint(key)
        self._lock = threading.RLock()

        self.read_only = read_only
        if read_only:
            if not os.path.exists(self.db_path):
                raise LedgerError(f"no ledger at {self.db_path}")
            from urllib.request import pathname2url
            self.db = sqlite3.connect(f"file:{pathname2url(self.db_path)}?mode=ro", uri=True,
                                      check_same_thread=False, isolation_level=None, timeout=30)
            if "signature" not in [r[1] for r in self.db.execute("PRAGMA table_info(incidents)")]:
                raise LedgerError(f"{self.db_path} is not a signed VoxTrace ledger")
            return
        # NOTE: keep the data folder on a LOCAL disk. SQLite WAL mode does not work on network
        # shares, and OneDrive/Dropbox syncing the -wal/-shm files can corrupt the DB.
        self.db = sqlite3.connect(self.db_path, check_same_thread=False, isolation_level=None,
                                  timeout=30)
        # Switching to WAL needs an exclusive lock and SQLite does not apply the busy timeout
        # to it, so several processes opening a brand-new ledger together must retry.
        for attempt in range(100):
            try:
                self.db.execute("PRAGMA journal_mode=WAL")   # readers never block COMMIT
                break
            except sqlite3.OperationalError as e:
                if "locked" not in str(e) or attempt == 99:
                    raise
                time.sleep(0.02 + 0.01 * (attempt % 5))
        self.db.execute("PRAGMA synchronous=FULL")
        cols = [r[1] for r in self.db.execute("PRAGMA table_info(incidents)")]
        if cols and "signature" not in cols:
            raise LedgerError(f"{self.db_path} was created by an older VoxTrace version with no "
                              "signatures; it cannot be verified. Start a new ledger file.")
        self.db.execute(
            """CREATE TABLE IF NOT EXISTS incidents(
                id INTEGER PRIMARY KEY AUTOINCREMENT, seq INTEGER NOT NULL UNIQUE,
                ts REAL, evidence_path TEXT, evidence_sha256 TEXT, evidence_files TEXT,
                audio_score REAL, video_score REAL, fused_score REAL,
                verdict TEXT, model_versions TEXT, ioc_matches TEXT,
                playbook_actions TEXT, actor TEXT,
                prev_hash TEXT, record_hash TEXT, signature TEXT)""")
        # Fresh ledger: write a signed genesis anchor, so "anchor missing" always means
        # tampering. Done under the DB write lock so several processes starting together
        # (uvicorn --workers N) agree on it.
        self.db.execute("BEGIN IMMEDIATE")
        try:
            n = self.db.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
            if n == 0 and not os.path.exists(self.anchor_path):
                self._write_anchor(0, GENESIS)
        finally:
            self.db.execute("COMMIT")

    # ---------------- crypto ----------------
    @staticmethod
    def _digest(payload: dict, prev_hash: str) -> str:
        blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)
        return hashlib.sha256((_REC + blob + "\0" + prev_hash).encode()).hexdigest()

    def _sign(self, domain: str, msg: str) -> str:
        return hmac.new(self.key, (domain + msg).encode(), hashlib.sha256).hexdigest()

    def _check(self, domain: str, msg: str, sig) -> bool:
        if not isinstance(sig, str):
            return False
        try:
            return hmac.compare_digest(self._sign(domain, msg).encode(), sig.encode("utf-8"))
        except Exception:
            return False

    def _head_sig(self, count, head) -> str:
        return self._sign(_ANC, f"{int(count)}:{head}")

    # ---------------- anchor + external log ----------------
    def _write_anchor(self, count: int, head: str):
        rec = {"count": count, "head": head, "ts": round(time.time(), 3),
               "key_fp": self.key_fp, "sig": self._head_sig(count, head)}
        d = os.path.dirname(self.anchor_path)
        fd, tmp = tempfile.mkstemp(dir=d, prefix=".anchor-")
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(rec, f); f.flush(); os.fsync(f.fileno())
            _replace(tmp, self.anchor_path)
        except BaseException:
            try: os.unlink(tmp)
            except FileNotFoundError: pass
            raise
        return rec

    def read_anchor(self):
        """Returns (anchor_dict | None, error_message | None)."""
        for attempt in range(5):
            if not os.path.exists(self.anchor_path):
                return None, None
            try:
                with open(self.anchor_path) as f:
                    a = json.load(f)
                int(a["count"]); str(a["head"])
                return a, None
            except PermissionError:      # Windows: file briefly locked during os.replace
                time.sleep(0.05)
            except Exception as e:
                return None, f"head anchor unreadable ({type(e).__name__})"
        return None, "head anchor unreadable (locked)"

    def _emit(self, event: dict):
        """Append one JSON line to the SIEM-shipped log (Wazuh reads this)."""
        if not self.siem_log_path:
            return
        line = json.dumps({"voxtrace": event}, sort_keys=True, allow_nan=False)
        with open(self.siem_log_path, "a") as f:
            f.write(line + "\n"); f.flush(); os.fsync(f.fileno())

    def head(self):
        """Current signed head {count, head, sig} - export this somewhere the DB host can't rewrite."""
        a, _ = self.read_anchor()
        return a

    # ---------------- state ----------------
    def _db_head(self):
        h = self.db.execute("SELECT record_hash, seq FROM incidents ORDER BY seq DESC LIMIT 1").fetchone()
        n = self.db.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
        return (h[0], h[1], n) if h else (GENESIS, 0, 0)

    def _anchor_consistent(self, db_hash, db_seq, n, anchor):
        """The anchor may LAG the DB (crash between COMMIT and anchor write, or two processes
        finishing out of order) - records after it are still signature-checked, and a writer
        without the key cannot add valid ones. It may never be AHEAD: that means deletion."""
        c = int(anchor["count"])
        if c > n or db_seq != n:
            return False
        if c == 0:
            return anchor["head"] == GENESIS
        row = self.db.execute("SELECT record_hash FROM incidents WHERE seq=?", (c,)).fetchone()
        return bool(row) and row[0] == anchor["head"]

    # ---------------- write ----------------
    def log_incident(self, evidence, audio_score, video_score, fused_score, verdict,
                     model_versions=None, ioc_matches=None, playbook_actions=None,
                     actor="voxtrace", evidence_files=None, severity=None):
        """`evidence`: one path or a list (audio, video...). `evidence_files`: output of
        hash_evidence() taken before analysis; if given, files are re-hashed and must match."""
        files = hash_evidence(evidence)
        if evidence_files is not None:
            expected = {(e["path"], e["sha256"]) for e in evidence_files}
            if {(e["path"], e["sha256"]) for e in files} != expected:
                raise LedgerError("evidence changed between hashing and logging")
        a, v, fsc = _num(audio_score), _num(video_score), _num(fused_score)
        if self.read_only:
            raise LedgerError("ledger opened read-only")

        with self._lock:
            anchor, aerr = self.read_anchor()
            self.db.execute("BEGIN IMMEDIATE")
            try:
                db_hash, db_seq, n = self._db_head()
                if n == 0 and anchor and not aerr and int(anchor.get("count", 0)) > 0:
                    raise LedgerError(
                        f"the ledger is empty but its signed anchor says {anchor['count']} records. "
                        "Either the database was deleted or replaced (possible tampering - run verify), "
                        f"or you meant to start a new ledger: then move {self.anchor_path} aside first.")
                if anchor is None or aerr or not self._check(_ANC, f"{anchor['count']}:{anchor['head']}", anchor.get("sig")) \
                        or not self._anchor_consistent(db_hash, db_seq, n, anchor):
                    raise LedgerError("ledger does not match its signed head anchor; refusing to "
                                      "append (run verify() and investigate)")
                seq = n + 1
                payload = dict(
                    seq=seq, ts=round(time.time(), 3), evidence_path=files[0]["path"],
                    evidence_sha256=files[0]["sha256"], evidence_files=json.dumps(files, sort_keys=True),
                    audio_score=a, video_score=v, fused_score=fsc, verdict=str(verdict),
                    model_versions=json.dumps(model_versions or {}, sort_keys=True),
                    ioc_matches=json.dumps(ioc_matches or [], sort_keys=True),
                    playbook_actions=json.dumps(playbook_actions or [], sort_keys=True), actor=str(actor),
                )
                rh = self._digest(payload, db_hash)
                sig = self._sign(_REC, rh)
                cols = _COLUMNS + ["prev_hash", "record_hash", "signature"]
                self.db.execute(f"INSERT INTO incidents({','.join(cols)}) VALUES({','.join('?' * len(cols))})",
                                [payload[c] for c in _COLUMNS] + [db_hash, rh, sig])
                self.db.execute("COMMIT")
            except BaseException:
                try: self.db.execute("ROLLBACK")
                except sqlite3.Error: pass
                raise
            # Only after a successful commit. The anchor is updated inside a second write
            # transaction, so anchor writes from different processes are serialised by the
            # DB lock and always describe the latest committed record: it never moves backwards.
            self._refresh_anchor()
            try: self.db.execute("PRAGMA wal_checkpoint(PASSIVE)")
            except sqlite3.Error: pass
            self._emit({"event": "incident", "seq": seq, "head": rh, "head_sig": self._head_sig(seq, rh),
                        "verdict": payload["verdict"], "severity": severity, "fused_score": fsc,
                        "evidence_sha256": files[0]["sha256"], "key_fp": self.key_fp})
        return rh

    def _refresh_anchor(self):
        self.db.execute("BEGIN IMMEDIATE")
        try:
            db_hash, db_seq, n = self._db_head()
            cur, _ = self.read_anchor()
            if not cur or int(cur.get("count", 0)) < n:
                self._write_anchor(n, db_hash)
        finally:
            try: self.db.execute("COMMIT")
            except sqlite3.Error: pass

    # ---------------- read ----------------
    def list_incidents(self, limit=50):
        with self._lock:
            cur = self.db.execute("SELECT seq, ts, evidence_sha256, fused_score, verdict, playbook_actions "
                                  "FROM incidents ORDER BY seq DESC LIMIT ?", (int(limit),))
            return [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]

    # ---------------- verify ----------------
    _EXPECTED_COLS = ["id"] + _COLUMNS + ["prev_hash", "record_hash", "signature"]

    def _schema_problems(self):
        """Extra columns, triggers or views on the ledger are not covered by the signatures:
        an unsigned column can carry misleading data and a trigger can silently block or
        alter writes. Any deviation from the expected schema is reported."""
        out = []
        objs = self.db.execute("SELECT type, name, tbl_name FROM sqlite_master").fetchall()
        kinds = {n: t for t, n, _ in objs}
        if kinds.get("incidents") != "table":
            return [f"incidents is {'missing' if 'incidents' not in kinds else 'a ' + kinds['incidents']}, "
                    "not the ledger table (dropped, renamed or replaced)"]
        cols = [r[1] for r in self.db.execute("PRAGMA table_info(incidents)")]
        if cols != self._EXPECTED_COLS:
            extra = [c for c in cols if c not in self._EXPECTED_COLS]
            missing = [c for c in self._EXPECTED_COLS if c not in cols]
            out.append(f"ledger schema changed (extra columns {extra}, missing {missing})")
        for t, n, tbl in objs:
            if t in ("trigger", "view"):
                out.append(f"unexpected {t} '{n}' in the ledger database")
        return out

    def verify(self, trusted_head: dict | None = None, emit: bool = False,
               expected_key_fp: str | None = None):
        """Returns (ok, problems). Never raises on corrupted data - corruption is reported.

        trusted_head: {"seq"/"count": n, "head": h} obtained from OUTSIDE this host (the
        SIEM log, see read_trusted_head). Without it, rollback to an older DB+anchor
        backup and a full wipe cannot be detected.
        expected_key_fp: the key fingerprint recorded somewhere independent at setup;
        catches a substituted key that was used to re-sign the whole history."""
        problems = []
        if expected_key_fp and not hmac.compare_digest(expected_key_fp.encode(), self.key_fp.encode()):
            problems.append(f"signing key fingerprint {self.key_fp} does not match the expected "
                            f"{expected_key_fp} (key substituted?)")
        with self._lock:
            # Anchor FIRST, then the snapshot: anchors are only written after a commit, so a
            # snapshot taken afterwards always contains at least the anchored records.
            anchor, aerr = self.read_anchor()
            rows, names = [], []
            try:
                self.db.execute("BEGIN")          # one consistent snapshot of the table
                schema = self._schema_problems()
                problems += schema
                if not schema or not schema[0].startswith("incidents is"):
                    rows = self.db.execute("SELECT * FROM incidents ORDER BY id").fetchall()
                    names = [d[0] for d in self.db.execute("SELECT * FROM incidents LIMIT 0").description]
            except sqlite3.Error as e:
                problems.append(f"ledger database unreadable ({type(e).__name__}: {e})")
            finally:
                try: self.db.execute("ROLLBACK")
                except sqlite3.Error: pass

        prev, by_seq = GENESIS, {}
        for pos, row in enumerate(rows, start=1):
            r = dict(zip(names, row))
            label = f"incident {r.get('seq', '?')}"
            try:
                if r["seq"] != pos:
                    problems.append(f"{label}: out of sequence (expected position {pos}; record "
                                    "deleted, inserted or renumbered)")
                if r["prev_hash"] != prev:
                    problems.append(f"{label}: chain link broken")
                payload = {k: r[k] for k in _COLUMNS}
                if self._digest(payload, r["prev_hash"]) != r["record_hash"]:
                    problems.append(f"{label}: record modified")
                if not self._check(_REC, str(r["record_hash"]), r["signature"]):
                    problems.append(f"{label}: signature invalid (record forged, chain rewritten, or wrong key)")
                for ev in json.loads(r["evidence_files"]):
                    name = os.path.basename(ev["path"])
                    if not os.path.exists(ev["path"]):
                        problems.append(f"{label}: evidence file missing: {name}")
                    elif sha256_file(ev["path"]) != ev["sha256"]:
                        problems.append(f"{label}: evidence file modified: {name}")
            except Exception as e:
                problems.append(f"{label}: record unreadable/corrupted ({type(e).__name__})")
            by_seq[pos] = r.get("record_hash")
            prev = r.get("record_hash")
        n = len(rows)

        if aerr:
            problems.append(aerr)
        elif anchor is None:
            problems.append("head anchor missing (records may have been deleted)")
        elif not self._check(_ANC, f"{anchor['count']}:{anchor['head']}", anchor.get("sig")):
            problems.append("head anchor signature invalid (anchor file tampered or wrong key)")
        else:
            c = int(anchor["count"])
            expected = GENESIS if c == 0 else by_seq.get(c)
            if c > n or anchor["head"] != expected:
                problems.append(f"ledger does not match head anchor: anchor says {anchor['count']} records, "
                                f"DB has {n} (records deleted or chain rewritten)")

        if trusted_head is not None:
            try:
                tn = int(trusted_head.get("seq", trusted_head.get("count")))
            except (TypeError, ValueError):
                tn = -1
            if tn < 0 or not isinstance(trusted_head.get("head"), str):
                problems.append("external head is malformed; cannot use it")
            elif tn > n:
                problems.append(f"DB has {n} records but the external head says at least {tn} "
                                "(rollback, wipe or truncation)")
            elif tn and by_seq.get(tn) != trusted_head["head"]:
                problems.append(f"record {tn} does not match the external head (history rewritten)")

        ok = not problems
        if emit and not self.read_only:
            try: self._emit({"event": "verify", "chain_intact": ok, "records": n, "problems": problems[:20]})
            except OSError: pass
        return ok, problems


def _export(self, dest_db: str):
    """Safe copy for backup or hand-over to an examiner: SQLite online backup (includes data
    still in the -wal file) plus the anchor. Never copy incidents.db directly while running."""
    with self._lock:
        anchor_src = self.anchor_path
        dst = sqlite3.connect(dest_db)
        try:
            self.db.backup(dst)
        finally:
            dst.close()
        if os.path.exists(anchor_src):
            import shutil
            shutil.copy2(anchor_src, dest_db + ".head")
    return dest_db


CustodyLedger.export = _export


def read_trusted_head(siem_log_path: str, key: bytes) -> dict | None:
    """Latest correctly-signed head from a copy of the SIEM log (ideally the copy held by
    the SIEM server, not the local file). Lines with bad signatures are ignored."""
    best = None
    with open(siem_log_path) as f:
        for line in f:
            try:
                ev = json.loads(line)["voxtrace"]
                if ev.get("event") != "incident":
                    continue
                msg = _ANC + f"{int(ev['seq'])}:{ev['head']}"
                good = hmac.new(key, msg.encode(), hashlib.sha256).hexdigest()
                if hmac.compare_digest(good.encode(), str(ev["head_sig"]).encode()):
                    if best is None or ev["seq"] > best["seq"]:
                        best = {"seq": int(ev["seq"]), "head": ev["head"]}
            except Exception:
                continue
    return best


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "genkey":
        p = generate_key_file(sys.argv[2])
        print(f"created {p}  fingerprint {key_fingerprint(load_key(p))}")
    else:
        print("usage: python -m voxtrace.custody genkey <path-outside-the-db-folder>")
