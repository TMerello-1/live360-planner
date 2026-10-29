"""Baut die Web-App: je Konferenz <id>/index.html aus conferences/<id>/planner.html (dem Artifact-Inhalt)
plus PWA-Kopf und -Skripten, dazu die Startseite index.html, conferences.json und die Dateiliste in sw.js."""
import html
import json
import re
from pathlib import Path

root = Path(__file__).parent
confs = []
for cfg in sorted(root.glob("conferences/*/config.json")):
    c = json.loads(cfg.read_text(encoding="utf-8"))
    if (cfg.parent / "planner.html").exists():
        confs.append(c)
confs.sort(key=lambda c: c["start"], reverse=True)

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b6e8a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Live360 Plan">
<link rel="manifest" href="{home}manifest.webmanifest">
<link rel="icon" href="{home}icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="{home}icons/apple-touch-icon.png">
<style>:root{{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{extra}</head>
<body>
"""

# Konferenzseiten
for c in confs:
    conf = {"id": c["id"], "name": c["name"], "storageKey": c["storageKey"], "gistFile": c["gistFile"],
            "home": "../", "data": f"../data/{c['id']}/"}
    body = (root / "conferences" / c["id"] / "planner.html").read_text(encoding="utf-8")
    head = HEAD.format(home="../", extra=f"<script>window.CONF = {json.dumps(conf, ensure_ascii=False)};</script>\n")
    tail = "\n" + "".join(f'<script src="../{js}"></script>\n' for js in ("updates.js", "sync.js", "conf.js", "pwa.js")) + "</body>\n</html>\n"
    out = root / c["id"] / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(head + body + tail, encoding="utf-8")
    print(out.relative_to(root), "built")

# Liste der Konferenzen für Startseite und Konferenzwahl
listing = [{k: c[k] for k in ("id", "name", "dates", "start", "end", "active")} for c in confs]
(root / "conferences.json").write_text(json.dumps({"conferences": listing}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

# Startseite: öffnet die gemerkte Konferenz (Haken "Diese Konferenz beim Start öffnen"), sonst die Auswahl.
# Ohne gemerkte Wahl geht es zur einzigen aktiven Konferenz. "?list" zeigt immer die Auswahl.
cards = "\n".join(
    f'    <a class="conf" href="{c["id"]}/"><b>{html.escape(c["name"])}</b>'
    f'<span data-de="{html.escape(c["dates"]["de"])}">{html.escape(c["dates"]["en"])}</span></a>' for c in confs)
start = HEAD.format(home="", extra=f"""<title>Live! 360 Planner</title>
<script>
(() => {{
  const confs = {json.dumps([c["id"] for c in confs])}, active = {json.dumps([c["id"] for c in confs if c.get("active")])};
  let pref = null; try {{ pref = JSON.parse(localStorage.getItem("l360:home")); }} catch {{}}
  const target = pref ? (pref.redirect && confs.includes(pref.conf) ? pref.conf : null) : (active.length === 1 ? active[0] : null);
  if (target && !/[?&]list\\b/.test(location.search)) location.replace(target + "/" + location.hash);
}})();
</script>
<style>
  body {{ font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #f3f5f8; color: #14202b; }}
  main {{ max-width: 560px; margin: 0 auto; padding: 32px 16px; display: grid; gap: 14px; }}
  h1 {{ margin: 0; font-size: 1.6rem; }}
  p {{ margin: 0; color: #5b6976; }}
  .conf {{ display: grid; gap: 4px; padding: 14px 16px; border: 1px solid #d6dde4; border-radius: 12px; background: #fff; color: inherit; text-decoration: none; }}
  .conf:hover {{ border-color: #0b6e8a; }}
  .conf span {{ font-size: 0.9rem; color: #5b6976; }}
  @media (prefers-color-scheme: dark) {{
    body {{ background: #0f171e; color: #e6edf2; }} p, .conf span {{ color: #9aa9b5; }}
    .conf {{ background: #17222b; border-color: #2a3a46; }} .conf:hover {{ border-color: #4fc0dc; }}
  }}
</style>
""")
start += f"""<main>
  <h1>Live! 360 Planner</h1>
  <p data-de="Wähle eine Konferenz. Mit dem Haken „Diese Konferenz beim Start öffnen“ in der Konferenz landest du künftig direkt dort.">Pick a conference. Tick "Open this conference on start" inside a conference to go straight there next time.</p>
{cards}
</main>
<script>
  if (/^de\\b/i.test(navigator.language)) document.querySelectorAll("[data-de]").forEach(e => e.textContent = e.dataset.de);
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {{}}));
</script>
</body>
</html>
"""
(root / "index.html").write_text(start, encoding="utf-8")
print("index.html (start page) built")

# Dateiliste für den Offline-Cache
assets = ["./", "./index.html", "./conferences.json", "./manifest.webmanifest", "./pwa.js", "./updates.js", "./conf.js", "./sync.js",
          "./vendor/qrcode.js", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"]
for c in confs:
    assets += [f"./{c['id']}/", f"./{c['id']}/index.html"]
sw = root / "sw.js"
src = sw.read_text(encoding="utf-8")
src, n = re.subn(r"const ASSETS = \[.*?\];", "const ASSETS = " + json.dumps(assets) + ";", src, count=1, flags=re.S)
assert n == 1
sw.write_text(src, encoding="utf-8")
print("sw.js assets:", len(assets))
