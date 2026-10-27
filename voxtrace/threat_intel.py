"""Threat intel correlation (owner: Harshita).

Matches an incident's observable indicators (phone numbers, domains, wallet/UPI IDs,
evidence hashes, claimed TTS tool) against local IOC feeds in data/iocs/*.json.
Feed format: {"source": "...", "indicators": [{"type": "domain", "value": "...", "tag": "..."}]}

TODO: add enrichment from VirusTotal / urlscan.io (needs API keys) behind `enrich_online`.
"""
import json, glob, os


class ThreatIntel:
    def __init__(self, feed_dir="data/iocs"):
        self.index = {}
        for fp in glob.glob(os.path.join(feed_dir, "*.json")):
            feed = json.load(open(fp))
            for ind in feed.get("indicators", []):
                key = (ind["type"], str(ind["value"]).lower())
                self.index.setdefault(key, []).append(
                    {"value": str(ind["value"]), "source": feed.get("source", os.path.basename(fp)),
                     "tag": ind.get("tag", "")})

    def correlate(self, observables: dict):
        """observables like {"domain": [...], "phone": [...], "sha256": [...], "tts_tool": [...]}"""
        hits = []
        for typ, values in observables.items():
            for v in values:
                for m in self.index.get((typ, str(v).lower()), []):
                    hits.append({"type": typ, "value": v, **m})
        return hits
