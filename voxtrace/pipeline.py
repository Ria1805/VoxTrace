from .custody import hash_evidence
from .fusion import fuse, verdict_from_score
from .threat_intel import ThreatIntel
from .playbook import respond, CONTEXT_ONLY_TYPES


class VoxTrace:
    def __init__(self, audio_detector=None, video_detector=None, ledger=None, intel=None, threshold=0.5):
        if ledger is None:
            raise ValueError("pass a CustodyLedger (it needs a key; see THREAT_MODEL.md)")
        self.audio, self.video = audio_detector, video_detector
        self.ledger = ledger
        self.intel = intel or ThreatIntel()
        self.threshold = threshold

    def analyze(self, evidence_path, audio_path=None, video_path=None, observables=None, actor="voxtrace"):
        # Hash EVERY file (audio and video) on receipt, BEFORE scoring. The ledger re-hashes
        # at logging time and refuses if anything changed while the models were running.
        paths = [evidence_path] + [p for p in (audio_path, video_path) if p and p != evidence_path]
        received = hash_evidence(paths)

        a = self.audio.score(audio_path or evidence_path) if self.audio and (audio_path or not video_path) else None
        video_details = None
        if self.video and video_path:
            predict = getattr(self.video, "predict", None)
            if predict:
                video_details = predict(video_path)
                v = video_details["p_fake"]
            else:
                v = self.video.score(video_path)
        else:
            v = None
        fused = fuse(a, v)
        verdict = verdict_from_score(fused, self.threshold)
        iocs = self.intel.correlate(observables or {})
        # IOC rule (data/iocs/MATCH_RULE.md): an exact IOC match is evidence even when the
        # detector says REAL, so the playbook runs for it too. Tool references are context only.
        # The verdict stays the detector's own; only the severity/actions use the IOC.
        exact_hits = [m for m in iocs if m.get("type") not in CONTEXT_ONLY_TYPES]
        if verdict == "FAKE" or exact_hits:
            severity, actions = respond(fused if fused is not None else 0.0, iocs)
        elif verdict == "UNSCORED":
            severity, actions = ("UNSCORED", ["Unreadable media or missing modality: flagged for manual forensic inspection"])
        else:
            severity, actions = ("NONE", ["Log only"])
        versions = {"audio": getattr(self.audio, "version", None), "video": getattr(self.video, "version", None)}
        rh = self.ledger.log_incident(paths, a, v, fused, verdict, versions, iocs, [severity] + actions,
                                      actor=actor, evidence_files=received, severity=severity)
        return dict(audio_score=a, video_score=v, fused_score=fused, verdict=verdict,
                    severity=severity, actions=actions, ioc_matches=iocs, record_hash=rh,
                    evidence_sha256=[e["sha256"] for e in received], video_details=video_details)
