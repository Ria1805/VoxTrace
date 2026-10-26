import os, numpy as np, soundfile as sf, pytest
from voxtrace.custody import CustodyLedger, generate_key_file

SR = 16000


@pytest.fixture
def dirs(tmp_path):
    """Separate folders: data (DB, anchor, evidence), secrets (key), siem (shipped log)."""
    d = {k: tmp_path / k for k in ("data", "secrets", "siem")}
    for p in d.values():
        p.mkdir()
    d["key"] = generate_key_file(str(d["secrets"] / "ledger.key"))
    return d


@pytest.fixture
def make_ledger(dirs):
    def _make(**kw):
        kw.setdefault("key_path", dirs["key"])
        kw.setdefault("siem_log_path", str(dirs["siem"] / "events.jsonl"))
        return CustodyLedger(str(dirs["data"] / "incidents.db"), **kw)
    return _make


@pytest.fixture
def wav(dirs):
    def _wav(i, folder=None):
        p = os.path.join(folder or dirs["data"], f"w{i}.wav")
        sf.write(p, (np.random.default_rng(i).normal(size=SR) * 0.1).astype("float32"), SR)
        return p
    return _wav
