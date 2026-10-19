"""Liest die offizielle Sessionliste von Live! 360 Orlando 2026 und schreibt data/sessions.json.

Läuft in GitHub Actions (siehe .github/workflows/update-sessions.yml). Nur Standardbibliothek.
Die Seite listet Räume derzeit noch nicht; sobald sie auftauchen (auf der Liste oder der
Detailseite, z. B. "Room: Pacific Hall A"), landen sie im Feld "room".
"""
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://live360events.com/events/orlando-2026/sessions/"
DAYS = {15: "sunday", 16: "monday", 17: "tuesday", 18: "wednesday", 19: "thursday", 20: "friday"}
OUT = Path(__file__).resolve().parent.parent / "data" / "sessions.json"

TIME_RE = re.compile(r"(\d{1,2}:\d{2}\s*[ap]\.?m\.?)\s*[-–]\s*(\d{1,2}:\d{2}\s*[ap]\.?m\.?)", re.I)
CODE_RE = re.compile(r"\b([A-Z]{2}(?:HOL|[MTWHF])\d{2})\b")
ROOM_LABEL_RE = re.compile(r"\b(?:Room|Location|Raum)\s*:\s*([^\n|]{2,60})", re.I)
ROOM_WORD_RE = re.compile(r"\b(Salon|Ballroom|Hall|Room|Lagoon|Pacific|Oceana|Islands?|Sails|Bay|Suite|Pavilion|Palms)\b", re.I)
SKIP_TEXT_RE = re.compile(r"^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b|Royal Pacific Resort|^\W*$", re.I)


class Tokens(HTMLParser):
    """Zerlegt HTML in eine Folge von Text- und Link-Tokens."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self._href, self._buf, self._skip = [], None, [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self._skip += 1
        elif tag == "a":
            self._flush()
            self._href = dict(attrs).get("href") or ""
        elif tag in ("br", "p", "div", "li", "h1", "h2", "h3", "h4", "h5", "span", "td", "tr"):
            self._flush()

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self._skip = max(0, self._skip - 1)
        elif tag == "a":
            text = " ".join("".join(self._buf).split())
            self._buf = []
            if self._href is not None:
                self.out.append(("a", text, self._href))
            self._href = None
        elif tag in ("p", "div", "li", "h1", "h2", "h3", "h4", "h5", "span", "td", "tr"):
            self._flush()

    def handle_data(self, data):
        if not self._skip:
            self._buf.append(data)

    def _flush(self):
        if self._href is not None:
            return
        text = " ".join("".join(self._buf).split())
        self._buf = []
        if text:
            self.out.append(("t", text, None))


def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (live360-planner updater)"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            print(f"retry {url}: {e}", file=sys.stderr)
            time.sleep(3 * (i + 1))


def to_min(t):
    m = re.match(r"(\d{1,2}):(\d{2})\s*([ap])", t.strip(), re.I)
    h = int(m.group(1)) % 12 + (12 if m.group(3).lower() == "p" else 0)
    return h * 60 + int(m.group(2))


def parse_day(num, html):
    p = Tokens()
    p.feed(html)
    toks = p.out
    slug_re = re.compile(r"/sessions/" + DAYS[num] + r"/([^/?#]+)\.aspx", re.I)
    entries, cur, pending = [], None, []
    for kind, text, href in toks:
        m = slug_re.search(href or "") if kind == "a" else None
        if m and text:
            times = [x for x in pending if TIME_RE.search(x)]
            before = " ".join(pending[-4:])
            code = CODE_RE.search(before)
            tm = TIME_RE.search(times[-1]) if times else None
            cur = {"day": num, "slug": m.group(1), "title": text, "code": code.group(1) if code else "",
                   "start": to_min(tm.group(1)) if tm else None, "end": to_min(tm.group(2)) if tm else None,
                   "speakers": [], "extra": []}
            entries.append(cur)
            pending = []
            continue
        if kind == "a" and cur is not None and "speaker" in (href or "").lower() and text:
            cur["speakers"].append(text)
            continue
        if kind == "t":
            if TIME_RE.search(text) or CODE_RE.fullmatch(text.strip()):
                pending.append(text)
            elif cur is not None and not SKIP_TEXT_RE.search(text) and len(text) <= 60:
                cur["extra"].append(text)
                pending.append(text)
            else:
                pending.append(text)
    out = []
    for e in entries:
        if e["start"] is None:
            continue
        room = ""
        for x in e["extra"]:
            lm = ROOM_LABEL_RE.search(x)
            if lm:
                room = lm.group(1).strip()
                break
        if not room:
            room = next((x for x in e["extra"] if ROOM_WORD_RE.search(x) and x not in e["speakers"] and x != e["title"]), "")
        e["room"] = room
        del e["extra"]
        out.append(e)
    return out


def room_from_detail(url):
    try:
        p = Tokens()
        p.feed(get(url, tries=2))
    except Exception:  # noqa: BLE001
        return ""
    texts = [t for k, t, _ in p.out if k == "t"]
    for i, t in enumerate(texts):
        m = ROOM_LABEL_RE.search(t)
        if m:
            return m.group(1).strip()
        if re.fullmatch(r"(Room|Location)\s*:?", t, re.I) and i + 1 < len(texts) and len(texts[i + 1]) <= 60:
            return texts[i + 1].strip()
    return ""


def main():
    sessions = []
    for num, name in DAYS.items():
        html = get(f"{BASE}session-list.aspx?EventDay={num}")
        day = parse_day(num, html)
        print(f"{name}: {len(day)} entries", file=sys.stderr)
        sessions.extend(day)
    if len(sessions) < 100:
        sys.exit(f"Only {len(sessions)} sessions parsed; page layout probably changed. Not writing.")
    for s in sessions:
        s["url"] = f"{BASE}{DAYS[s['day']]}/{s['slug']}.aspx"
        s["id"] = f"{s['day']}:{s['code'] or s['slug']}"
    missing = [s for s in sessions if not s["room"]]
    with ThreadPoolExecutor(8) as ex:
        for s, room in zip(missing, ex.map(lambda s: room_from_detail(s["url"]), missing)):
            s["room"] = room
    rooms = sum(1 for s in sessions if s["room"])
    print(f"{len(sessions)} sessions, {rooms} with a room", file=sys.stderr)

    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    if old.get("sessions") == sessions:
        print("No changes.", file=sys.stderr)
        return
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "sessions": sessions},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    print("Wrote", OUT, file=sys.stderr)


if __name__ == "__main__":
    main()
