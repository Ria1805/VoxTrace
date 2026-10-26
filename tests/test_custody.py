"""Security-property test matrix for the evidence log.

Each test is one attack. The attacker's capability is in the test name:
  db_   - can write the SQLite file only
  fs_   - can write anything in the data folder (DB, anchor, evidence), but not the key
          or the off-box SIEM log
  key_  - has the signing key
  ops_  - not an attack: crashes, concurrency, bad inputs
`limit_` tests document attacks the design does NOT stop. They pass when the attack
SUCCEEDS, so the paper's limitations section is backed by tests too.
See THREAT_MODEL.md for the same table in prose.
"""
import json, os, shutil, sqlite3, subprocess, sys, threading
import numpy as np, pytest
from voxtrace.custody import (CustodyLedger, LedgerError, GENESIS, generate_key_file,
                              load_key, read_trusted_head)
from voxtrace.pipeline import VoxTrace


@pytest.fixture
def led(make_ledger, wav):
    L = make_ledger()
    for i in range(4):
        L.log_incident(wav(i), 0.9, None, 0.9, "FAKE")
    assert L.verify() == (True, [])
    return L


def bad(L, needle, **kw):
    ok, problems = L.verify(**kw)
    assert not ok, "attack went undetected"
    assert any(needle in p for p in problems), problems
    return problems


def restore(snap, data):
    """Put back a backup of the ledger files (DB, its WAL/SHM, anchor) - a rollback attack."""
    for f in os.listdir(data):
        if f.startswith("incidents.db"): os.remove(data / f)
    for f in os.listdir(snap):
        if f.startswith("incidents.db"): shutil.copy(snap / f, data / f)


def rechain(L, key=None):
    """Recompute every hash after an edit. With key=None the attacker can't re-sign."""
    from voxtrace.custody import _COLUMNS
    rows = L.db.execute("SELECT * FROM incidents ORDER BY seq").fetchall()
    names = [d[0] for d in L.db.execute("SELECT * FROM incidents LIMIT 0").description]
    prev = GENESIS
    for row in rows:
        r = dict(zip(names, row))
        rh = L._digest({k: r[k] for k in _COLUMNS}, prev)
        sig = L._sign("voxtrace-record-v2\0", rh) if key else r["signature"]
        L.db.execute("UPDATE incidents SET prev_hash=?, record_hash=?, signature=? WHERE id=?",
                     (prev, rh, sig, r["id"]))
        prev = rh
    return prev


# ============================================================ db_: DB write only
def test_db_edit_field(led):
    led.db.execute("UPDATE incidents SET verdict='REAL' WHERE seq=2")
    bad(led, "record modified")

def test_db_edit_timestamp_only(led):
    led.db.execute("UPDATE incidents SET ts=ts-86400 WHERE seq=2")
    bad(led, "record modified")

def test_db_delete_middle(led):
    led.db.execute("DELETE FROM incidents WHERE seq=2")
    bad(led, "out of sequence")

def test_db_delete_newest(led):
    led.db.execute("DELETE FROM incidents WHERE seq=4")
    bad(led, "does not match head anchor")

def test_db_delete_all(led):
    led.db.execute("DELETE FROM incidents")
    bad(led, "does not match head anchor")

def test_db_insert_forged_record(led):
    row = led.db.execute("SELECT * FROM incidents WHERE seq=4").fetchone()
    names = [d[0] for d in led.db.execute("SELECT * FROM incidents LIMIT 0").description]
    r = dict(zip(names, row)); r.pop("id"); r["seq"] = 5; r["verdict"] = "REAL"
    led.db.execute(f"INSERT INTO incidents({','.join(r)}) VALUES({','.join('?'*len(r))})", list(r.values()))
    bad(led, "record modified")

def test_db_reorder_records(led):
    led.db.execute("UPDATE incidents SET seq=-1 WHERE seq=2")
    led.db.execute("UPDATE incidents SET seq=2 WHERE seq=3")
    led.db.execute("UPDATE incidents SET seq=3 WHERE seq=-1")
    bad(led, "record modified")

def test_db_edit_then_recompute_chain_without_key(led):
    led.db.execute("UPDATE incidents SET fused_score=0.1, verdict='REAL' WHERE seq=2")
    rechain(led)
    bad(led, "signature invalid")

def test_db_swap_evidence_and_update_stored_hash(led, wav):
    p = wav(99)
    from voxtrace.custody import sha256_file
    led.db.execute("UPDATE incidents SET evidence_sha256=?, evidence_files=? WHERE seq=1",
                   (sha256_file(p), json.dumps([{"path": p, "sha256": sha256_file(p)}])))
    bad(led, "record modified")

def test_db_garbage_values_reported_not_raised(led):
    led.db.execute("UPDATE incidents SET signature='ñ' WHERE seq=1")
    led.db.execute("UPDATE incidents SET verdict=x'00ff' WHERE seq=2")
    led.db.execute("UPDATE incidents SET evidence_files='not json' WHERE seq=3")
    probs = bad(led, "incident 1: signature invalid")
    assert any("incident 2" in p for p in probs) and any("incident 3" in p for p in probs)


# ============================================================ evidence files
def test_evidence_file_modified(led):
    path = led.db.execute("SELECT evidence_path FROM incidents WHERE seq=2").fetchone()[0]
    with open(path, "ab") as f: f.write(b"x")
    bad(led, "evidence file modified")

class Fixed:
    version = "test"
    def __init__(self, s): self.s = s
    def score(self, _): return self.s

def test_video_tamper_detected_in_audio_plus_video_incident(make_ledger, wav, dirs):
    a = wav(1); v = dirs["data"] / "call.mp4"; v.write_bytes(b"pretend video")
    vt = VoxTrace(Fixed(0.8), Fixed(0.7), make_ledger())
    vt.analyze(a, audio_path=a, video_path=str(v))
    assert vt.ledger.verify()[0]
    with open(v, "ab") as f: f.write(b"TAMPERED")
    bad(vt.ledger, "evidence file modified: call.mp4")

def test_missing_video_file_detected(make_ledger, wav, dirs):
    a = wav(1); v = dirs["data"] / "call.mp4"; v.write_bytes(b"pretend video")
    vt = VoxTrace(Fixed(0.8), Fixed(0.7), make_ledger())
    vt.analyze(a, audio_path=a, video_path=str(v))
    os.remove(v)
    bad(vt.ledger, "evidence file missing: call.mp4")

def test_evidence_swapped_during_analysis_refused(make_ledger, wav):
    p = wav(1)
    class Swapper(Fixed):
        def score(self, path):
            with open(path, "ab") as f: f.write(b"swap")   # file changes mid-analysis
            return 0.9
    vt = VoxTrace(Swapper(0.9), None, make_ledger())
    with pytest.raises(LedgerError, match="changed between hashing and logging"):
        vt.analyze(p)


# ============================================================ fs_: data folder, no key
def test_fs_delete_anchor(led):
    os.remove(led.anchor_path)
    bad(led, "anchor missing")

def test_fs_forge_anchor(led):
    led.db.execute("DELETE FROM incidents WHERE seq=4")
    a = led.head(); a.update(count=3, head=led.db.execute("SELECT record_hash FROM incidents WHERE seq=3").fetchone()[0])
    json.dump(a, open(led.anchor_path, "w"))
    bad(led, "anchor signature invalid")

def test_fs_corrupt_anchor_reported(led):
    open(led.anchor_path, "w").close()
    bad(led, "anchor unreadable")

def test_fs_truncate_then_legit_insert_refused(led, wav):
    led.db.execute("DELETE FROM incidents WHERE seq=4")
    with pytest.raises(LedgerError, match="does not match its signed head anchor"):
        led.log_incident(wav(50), 0.9, None, 0.9, "FAKE")

def test_fs_rollback_with_old_anchor_caught_by_external_head(led, dirs, wav):
    snap = dirs["data"].parent / "snap"; shutil.copytree(dirs["data"], snap)
    led.log_incident(wav(10), 0.9, None, 0.9, "FAKE")          # seq 5, shipped to SIEM
    trusted = read_trusted_head(led.siem_log_path, led.key)
    led.db.close()
    restore(snap, dirs["data"])
    rolled = CustodyLedger(str(dirs["data"] / "incidents.db"), key_path=dirs["key"])
    assert trusted["seq"] == 5
    bad(rolled, "external head says at least 5", trusted_head=trusted)

def test_fs_wipe_db_and_anchor_caught_by_external_head(led, dirs):
    trusted = read_trusted_head(led.siem_log_path, led.key)
    led.db.close()
    for f in os.listdir(dirs["data"]):
        if f.startswith("incidents.db"): os.remove(dirs["data"] / f)
    fresh = CustodyLedger(str(dirs["data"] / "incidents.db"), key_path=dirs["key"])
    bad(fresh, "external head says at least 4", trusted_head=trusted)

def test_limit_fs_rollback_undetected_without_external_head(led, dirs, wav):
    """LIMITATION: without the off-box head, restoring an old DB+anchor backup passes."""
    snap = dirs["data"].parent / "snap"; shutil.copytree(dirs["data"], snap)
    led.log_incident(wav(10), 0.9, None, 0.9, "FAKE")
    led.db.close()
    restore(snap, dirs["data"])
    rolled = CustodyLedger(str(dirs["data"] / "incidents.db"), key_path=dirs["key"])
    assert rolled.verify() == (True, [])

def test_external_log_ignores_forged_lines(led):
    with open(led.siem_log_path, "a") as f:
        f.write(json.dumps({"voxtrace": {"event": "incident", "seq": 999, "head": "f"*64, "head_sig": "0"*64}}) + "\n")
    assert read_trusted_head(led.siem_log_path, led.key)["seq"] == 4


# ============================================================ key handling
def test_key_never_in_db(led):
    assert led.key.hex() not in "\n".join(led.db.iterdump())

def test_colocated_key_refused(dirs):
    k = generate_key_file(str(dirs["data"] / "ledger.key"))
    with pytest.raises(LedgerError, match="inside the ledger.s data folder"):
        CustodyLedger(str(dirs["data"] / "incidents.db"), key_path=k)

def test_key_in_data_subfolder_refused(dirs):
    (dirs["data"] / "secrets").mkdir()
    k = generate_key_file(str(dirs["data"] / "secrets" / "ledger.key"))
    with pytest.raises(LedgerError, match="inside the ledger's data folder"):
        CustodyLedger(str(dirs["data"] / "incidents.db"), key_path=k)

@pytest.mark.skipif(os.name == "nt", reason="POSIX permissions")
def test_preplanted_world_readable_key_refused(dirs):
    p = dirs["secrets"] / "planted.key"; p.write_text(os.urandom(32).hex()); os.chmod(p, 0o644)
    with pytest.raises(LedgerError, match="readable by others"):
        load_key(str(p))

def test_missing_key_is_an_error_not_a_new_key(dirs):
    with pytest.raises(LedgerError, match="not found"):
        load_key(str(dirs["secrets"] / "nope.key"))
    assert not (dirs["secrets"] / "nope.key").exists()

def test_wrong_size_key_refused(dirs):
    p = dirs["secrets"] / "short.key"; p.write_text("abcd"); os.chmod(p, 0o600)
    with pytest.raises(LedgerError, match="32 bytes"):
        load_key(str(p))

def test_genkey_refuses_overwrite(dirs):
    with pytest.raises(FileExistsError):
        generate_key_file(dirs["key"])

def test_wrong_key_cannot_verify(led, dirs):
    other = CustodyLedger(str(dirs["data"] / "incidents.db"), key=os.urandom(32))
    bad(other, "signature invalid")

def test_limit_key_holder_can_forge(led):
    """LIMITATION: anyone with the key can rewrite history undetectably (HMAC = shared
    secret, so no non-repudiation). Only the external head would show the change."""
    trusted = read_trusted_head(led.siem_log_path, led.key)
    led.db.execute("UPDATE incidents SET verdict='REAL' WHERE seq=4")
    head = rechain(led, key=led.key)
    led._write_anchor(4, head)
    assert led.verify() == (True, [])
    bad(led, "does not match the external head", trusted_head=trusted)


# ============================================================ ops_: not attacks
def test_ops_crash_between_commit_and_anchor(make_ledger, wav, monkeypatch):
    L = make_ledger()
    L.log_incident(wav(1), 0.9, None, 0.9, "FAKE")
    real = L._write_anchor
    monkeypatch.setattr(L, "_write_anchor", lambda *a: (_ for _ in ()).throw(OSError("crash")))
    with pytest.raises(OSError):
        L.log_incident(wav(2), 0.9, None, 0.9, "FAKE")       # committed, anchor not updated
    monkeypatch.setattr(L, "_write_anchor", real)
    assert L.verify() == (True, [])                           # anchor lagging is not tampering
    L.log_incident(wav(3), 0.9, None, 0.9, "FAKE")            # and writing continues
    assert L.verify() == (True, []) and L.head()["count"] == 3

def test_ops_40_threads_one_connection(make_ledger, wav):
    L = make_ledger(); paths = [wav(i) for i in range(40)]; errors = []
    def go(p):
        try: L.log_incident(p, 0.9, None, 0.9, "FAKE")
        except Exception as e: errors.append(repr(e))
    ts = [threading.Thread(target=go, args=(p,)) for p in paths]
    [t.start() for t in ts]; [t.join() for t in ts]
    assert errors == []
    assert L.verify() == (True, []) and L.head()["count"] == 40

def test_ops_4_processes_same_db(make_ledger, wav, dirs):
    make_ledger()                                              # create DB + genesis anchor
    paths = [wav(i) for i in range(40)]
    code = ("import sys; sys.path.insert(0, sys.argv[1]);"
            "from voxtrace.custody import CustodyLedger;"
            "L = CustodyLedger(sys.argv[2], key_path=sys.argv[3]);"
            "[L.log_incident(p, 0.9, None, 0.9, 'FAKE') for p in sys.argv[4:]]")
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    procs = [subprocess.Popen([sys.executable, "-c", code, root, str(dirs["data"] / "incidents.db"),
                               dirs["key"], *paths[i::4]]) for i in range(4)]
    assert all(p.wait(timeout=120) == 0 for p in procs)
    L = make_ledger()
    ok, problems = L.verify()
    assert ok, problems
    assert L.db.execute("SELECT COUNT(*) FROM incidents").fetchone()[0] == 40
    assert L.head()["count"] == 40          # anchor ended on the latest record, never behind

@pytest.mark.parametrize("score", [1, np.float32(0.7), np.float64(0.7), np.int64(1), 0.1 + 0.2])
def test_ops_score_types_round_trip(make_ledger, wav, score):
    L = make_ledger(); L.log_incident(wav(1), score, None, score, "FAKE")
    assert L.verify() == (True, [])

@pytest.mark.parametrize("score", [float("nan"), float("inf"), True])
def test_ops_bad_scores_rejected(make_ledger, wav, score):
    with pytest.raises((ValueError, TypeError)):
        make_ledger().log_incident(wav(1), score, None, 0.5, "FAKE")

def test_ops_old_schema_refused(dirs):
    db = dirs["data"] / "incidents.db"
    sqlite3.connect(db).execute("CREATE TABLE incidents(id INTEGER PRIMARY KEY, ts REAL, record_hash TEXT)")
    with pytest.raises(LedgerError, match="older VoxTrace version"):
        CustodyLedger(str(db), key_path=dirs["key"])

def test_ops_empty_ledger_verifies(make_ledger):
    assert make_ledger().verify() == (True, [])

def test_ops_siem_log_written(led):
    lines = [json.loads(l)["voxtrace"] for l in open(led.siem_log_path)]
    assert [l["seq"] for l in lines] == [1, 2, 3, 4] and all(l["verdict"] == "FAKE" for l in lines)
    led.verify(emit=True)
    assert json.loads(open(led.siem_log_path).readlines()[-1])["voxtrace"]["chain_intact"] is True


# ============================================================ round-2 review regressions
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WRITER = ("import sys; sys.path.insert(0, sys.argv[1]);"
          "from voxtrace.custody import CustodyLedger;"
          "L = CustodyLedger(sys.argv[2], key_path=sys.argv[3]);"
          "[L.log_incident(p, 0.9, None, 0.9, 'FAKE') for p in sys.argv[4:]]")


def spawn(dirs, paths):
    return subprocess.Popen([sys.executable, "-c", WRITER, ROOT, str(dirs["data"] / "incidents.db"),
                             dirs["key"], *paths])


def test_ops_verify_while_other_processes_write_no_false_alarm(make_ledger, wav, dirs):
    L = make_ledger()
    paths = [wav(i) for i in range(120)]
    procs = [spawn(dirs, paths[i::4]) for i in range(4)]
    alarms = []
    while any(p.poll() is None for p in procs):
        ok, problems = L.verify()
        if not ok: alarms += problems
    assert all(p.wait(timeout=120) == 0 for p in procs)
    assert alarms == [], alarms[:3]
    assert L.verify() == (True, []) and L.head()["count"] == 120


def test_ops_many_processes_open_a_brand_new_ledger(wav, dirs):
    paths = [wav(i) for i in range(48)]                      # DB does NOT exist yet
    procs = [spawn(dirs, paths[i::8]) for i in range(8)]
    assert [p.wait(timeout=120) for p in procs] == [0] * 8
    L = CustodyLedger(str(dirs["data"] / "incidents.db"), key_path=dirs["key"])
    assert L.verify() == (True, []) and L.head()["count"] == 48


def test_ops_export_while_running_keeps_every_record(led, dirs):
    out = dirs["siem"].parent / "handover"; out.mkdir()
    led.export(str(out / "incidents.db"))
    copy = CustodyLedger(str(out / "incidents.db"), key_path=dirs["key"], read_only=True)
    assert copy.verify() == (True, [])
    assert copy.db.execute("SELECT COUNT(*) FROM incidents").fetchone()[0] == 4


def test_ops_read_only_examiner_copy_cannot_write(led, dirs, wav):
    out = dirs["siem"].parent / "handover"; out.mkdir()
    led.export(str(out / "incidents.db"))
    copy = CustodyLedger(str(out / "incidents.db"), key_path=dirs["key"], read_only=True)
    with pytest.raises(LedgerError, match="read-only"):
        copy.log_incident(wav(7), 0.9, None, 0.9, "FAKE")
    with pytest.raises(sqlite3.OperationalError):
        copy.db.execute("DELETE FROM incidents")


def test_ops_deleting_only_the_db_gives_clear_message(led, dirs, wav):
    led.db.close()
    for f in os.listdir(dirs["data"]):
        if f.startswith("incidents.db") and not f.endswith(".head"): os.remove(dirs["data"] / f)
    fresh = CustodyLedger(str(dirs["data"] / "incidents.db"), key_path=dirs["key"])
    with pytest.raises(LedgerError, match="move .* aside"):
        fresh.log_incident(wav(5), 0.9, None, 0.9, "FAKE")
    assert not fresh.verify()[0]                              # and verify still flags it


def test_ops_genkey_creates_missing_folder(tmp_path):
    p = generate_key_file(str(tmp_path / "new" / "dir" / "ledger.key"))
    assert len(load_key(p)) == 32


def test_ops_genkey_without_hard_links(tmp_path, monkeypatch):
    def no_link(*a): raise PermissionError(1, "Operation not permitted")
    monkeypatch.setattr(os, "link", no_link)
    p = generate_key_file(str(tmp_path / "ledger.key"))
    assert len(load_key(p)) == 32
    assert [f for f in os.listdir(tmp_path) if f.startswith(".keytmp")] == []
    with pytest.raises(FileExistsError):
        generate_key_file(p)


# ============================================================ round-3 probe findings
@pytest.mark.skipif(os.name == "nt", reason="symlinks need admin rights on Windows")
def test_fs_symlinked_key_inside_data_folder_refused(dirs):
    link = dirs["data"] / "key.lnk"; os.symlink(dirs["key"], link)
    with pytest.raises(LedgerError, match="via a symlink"):
        CustodyLedger(str(dirs["data"] / "incidents.db"), key_path=str(link))

@pytest.mark.skipif(os.name == "nt", reason="symlinks need admin rights on Windows")
def test_fs_symlinked_key_folder_inside_data_folder_refused(dirs):
    os.symlink(dirs["secrets"], dirs["data"] / "secrets")
    with pytest.raises(LedgerError, match="inside the ledger's data folder"):
        CustodyLedger(str(dirs["data"] / "incidents.db"), key_path=str(dirs["data"] / "secrets" / "ledger.key"))

def test_fs_substituted_key_caught_by_fingerprint(led, dirs):
    good_fp = led.key_fp
    evil = generate_key_file(str(dirs["siem"].parent / "evil" / "k"))
    E = CustodyLedger(str(dirs["data"] / "incidents.db"), key_path=evil)
    head = rechain(E, key=E.key); E._write_anchor(4, head)
    assert E.verify() == (True, [])                          # re-signed with attacker's key...
    bad(E, "fingerprint", expected_key_fp=good_fp)            # ...caught by the recorded fingerprint

def test_db_table_dropped_reported_not_raised(led):
    led.db.execute("DROP TABLE incidents")
    bad(led, "incidents is missing")

def test_db_table_replaced_by_view(led):
    led.db.execute("ALTER TABLE incidents RENAME TO real_t")
    led.db.execute("CREATE VIEW incidents AS SELECT * FROM real_t WHERE seq<4")
    bad(led, "incidents is a view")

def test_db_extra_unsigned_column_reported(led):
    led.db.execute("ALTER TABLE incidents ADD COLUMN analyst_note TEXT")
    led.db.execute("UPDATE incidents SET analyst_note='cleared, not fraud'")
    bad(led, "extra columns ['analyst_note']")

def test_db_blocking_trigger_reported(led):
    led.db.execute("CREATE TRIGGER t BEFORE INSERT ON incidents BEGIN SELECT RAISE(ABORT,'nope'); END")
    bad(led, "unexpected trigger 't'")

def test_key_env_and_file_both_set_refused(dirs, monkeypatch):
    monkeypatch.setenv("VOXTRACE_LEDGER_KEY", os.urandom(32).hex())
    with pytest.raises(LedgerError, match="use exactly one"):
        load_key(dirs["key"])

@pytest.mark.parametrize("th", [{"seq": -5, "head": "x"}, {"seq": "abc", "head": "x"}, {"seq": 2}])
def test_malformed_external_head_reported(led, th):
    bad(led, "external head is malformed", trusted_head=th)
