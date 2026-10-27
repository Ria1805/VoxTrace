"""Turn a saved OpenPhish community feed (one URL per line) into a VoxTrace IOC feed.

Usage (from the voxtrace project folder):
    python tools/build_openphish_feed.py openphish_raw.txt data/iocs/openphish_feed.json

Rules:
  * Keeps the full hostname (e.g. xfinityhelplogin.weebly.com), never a shared platform on its own
    (so "vercel.app", "pages.dev", "github.io" are never added).
  * Skips URL shorteners and shared file hosts: listing them would flag every innocent link on them.
  * Skips raw IP addresses (they are not type "domain").
  * Adds the host with and without a leading "www." so either form matches.
"""
import json, re, sys, datetime
from urllib.parse import urlparse

SHARED_PLATFORMS = {
    "pages.dev", "vercel.app", "github.io", "netlify.app", "workers.dev", "weebly.com", "replit.app",
    "gitbook.io", "web.app", "framer.app", "zapier.app", "typedream.app", "wasmer.app", "square.site",
    "jimdofree.com", "cleverapps.io", "s3.amazonaws.com", "azurewebsites.net", "freemyip.com",
}
SHORTENERS = {"s4w.in", "e.vg", "1url.at", "bit.ly", "tinyurl.com", "t.co", "cutt.ly", "is.gd", "rb.gy"}
SHARED_FILE_HOSTS = (re.compile(r"^f\d+\.backblazeb2\.com$"), re.compile(r"^sharemyhtml\.com$"))
IP_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
HOST_RE = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$")


def hostname(line):
    line = line.strip()
    if not line:
        return None
    if "://" not in line:
        line = "http://" + line
    try:
        h = (urlparse(line).hostname or "").lower().rstrip(".")
    except ValueError:
        return None
    return h or None


def build(lines):
    hosts, skipped = set(), {"shortener": 0, "shared_host": 0, "bare_platform": 0, "ip": 0, "invalid": 0}
    for line in lines:
        h = hostname(line)
        if not h or not HOST_RE.match(h) and not IP_RE.match(h):
            skipped["invalid"] += 1; continue
        if IP_RE.match(h):
            skipped["ip"] += 1; continue
        bare = h[4:] if h.startswith("www.") else h
        if bare in SHORTENERS:
            skipped["shortener"] += 1; continue
        if bare in SHARED_PLATFORMS:
            skipped["bare_platform"] += 1; continue
        if any(p.match(bare) for p in SHARED_FILE_HOSTS):
            skipped["shared_host"] += 1; continue
        hosts.add(h); hosts.add(bare)
    return sorted(hosts), skipped


def main(src, dst):
    with open(src, encoding="utf-8", errors="ignore") as f:
        lines = f.read().splitlines()
    hosts, skipped = build(lines)
    today = datetime.date.today().isoformat()
    feed = {"source": f"OpenPhish Community Feed, downloaded {today} (free, non-commercial use; https://openphish.com)",
            "indicators": [{"type": "domain", "value": h, "tag": "phishing"} for h in hosts]}
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(feed, f, indent=1)
    print(f"read {len(lines)} lines -> wrote {len(hosts)} hostnames to {dst}")
    print("skipped:", skipped)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
