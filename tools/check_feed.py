import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from voxtrace.threat_intel import ThreatIntel

feed = json.load(open("data/iocs/openphish_feed.json", encoding="utf-8"))
print("entries in openphish_feed.json:", len(feed["indicators"]))
print("source line:", feed["source"])

ti = ThreatIntel("data/iocs")
print("total entries loaded from all feeds:", len(ti.index))

tests = {
    "domain": ["xfinityhelplogin.weebly.com", "google.com"],
    "tts_tool": ["ElevenLabs", "SomeOtherTool"],
}
for hit in ti.correlate(tests):
    print("MATCH:", hit["type"], hit["value"], "-", hit["tag"])