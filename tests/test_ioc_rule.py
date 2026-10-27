"""Tests for the IOC rule in data/iocs/MATCH_RULE.md.
Exact IOC (domain, phone, ...) raises severity one tier, capped at HIGH.
Tool references (tts_tool) are logged only. CRITICAL needs score >= 0.90.
Smoke tests of the rule, not evidence about detection quality."""
import json
import numpy as np
import soundfile as sf
import pytest
from voxtrace.pipeline import VoxTrace
from voxtrace.threat_intel import ThreatIntel
from voxtrace.playbook import respond

DOMAIN = {"type": "domain", "value": "bad.test", "source": "t", "tag": "phishing"}
TOOL = {"type": "tts_tool", "value": "ElevenLabs", "source": "t", "tag": "voice-cloning"}


@pytest.mark.parametrize("score, hits, expected", [
    (0.20, [], "LOW"),
    (0.20, [TOOL], "LOW"),         # tool name alone changes nothing
    (0.20, [DOMAIN], "MEDIUM"),    # one tier up, not straight to HIGH
    (0.60, [DOMAIN], "HIGH"),
    (0.80, [DOMAIN], "HIGH"),      # capped: IOC alone never reaches CRITICAL
    (0.95, [DOMAIN], "CRITICAL"),  # CRITICAL comes from the score
    (0.20, [DOMAIN, TOOL], "MEDIUM"),
])
def test_playbook_ioc_rule(score, hits, expected):
    assert respond(score, hits)[0] == expected


class FixedScore:
    """Stand-in detector that always returns the same score."""
    version = "stub"

    def __init__(self, s):
        self.s = s

    def score(self, path):
        return self.s


def _setup(tmp_path):
    wav = tmp_path / "call.wav"
    sf.write(str(wav), (0.1 * np.random.default_rng(0).normal(size=16000)).astype("float32"), 16000)
    feeds = tmp_path / "feeds"
    feeds.mkdir()
    (feeds / "t.json").write_text(json.dumps({"source": "test", "indicators": [
        {"type": "domain", "value": "bad.test", "tag": "phishing"},
        {"type": "tts_tool", "value": "ElevenLabs", "tag": "voice-cloning"}]}))
    return str(wav), ThreatIntel(str(feeds))


def test_low_score_with_bad_domain_is_escalated_but_stays_real(tmp_path, make_ledger):
    wav, intel = _setup(tmp_path)
    vt = VoxTrace(FixedScore(0.2), None, make_ledger(), intel=intel)
    out = vt.analyze(wav, observables={"domain": ["bad.test"]})
    assert out["verdict"] == "REAL"          # the detector's verdict is not changed
    assert out["severity"] == "MEDIUM"       # the IOC raised severity one tier
    assert out["ioc_matches"]
    ok, _ = vt.ledger.verify()
    assert ok


def test_low_score_with_tool_name_only_changes_nothing(tmp_path, make_ledger):
    wav, intel = _setup(tmp_path)
    vt = VoxTrace(FixedScore(0.2), None, make_ledger(), intel=intel)
    out = vt.analyze(wav, observables={"tts_tool": ["ElevenLabs"]})
    assert out["verdict"] == "REAL" and out["severity"] == "NONE"
    assert out["ioc_matches"]                # still recorded in the log
