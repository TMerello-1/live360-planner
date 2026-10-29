import json, sys, time, urllib.request, re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
out = Path("probe"); out.mkdir(exist_ok=True)
def get(url):
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (live360-planner; personal use)"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            print("fail", url, e, file=sys.stderr); time.sleep(3)
    return ""
base = "https://vslive.com/events/san-diego-2026/"
urls = {"home.html": base + "home.aspx", "agenda.html": base + "agenda.aspx",
        "speakers.html": base + "speakers/speaker-list.aspx", "sessions.html": base + "sessions/session-list.aspx"}
for d in range(13, 20):
    urls[f"list-{d}.html"] = base + f"sessions/session-list.aspx?EventDay={d}"
for k, u in urls.items():
    (out / k).write_text(get(u), encoding="utf-8")
links = set()
for f in out.glob("*.html"):
    links |= set(re.findall(r'href="([^"]*/sessions/(?:monday|tuesday|wednesday|thursday|friday|sunday)/[^"?#]+\.aspx)', f.read_text()))
links = sorted({l if l.startswith("http") else "https://vslive.com" + l for l in links})
print(len(links), "session links", file=sys.stderr)
(out / "details").mkdir(exist_ok=True)
def save(u):
    name = "_".join(u.split("/sessions/")[1].split("/")).replace(".aspx", ".html")
    (out / "details" / name).write_text(get(u), encoding="utf-8")
with ThreadPoolExecutor(6) as ex:
    list(ex.map(save, links))
