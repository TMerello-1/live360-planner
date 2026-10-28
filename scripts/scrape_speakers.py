"""Liest die offizielle Sprecherliste von Live! 360 Orlando 2026 und schreibt data/speakers.json.

Läuft in GitHub Actions zusammen mit scrape.py. Nur Standardbibliothek.
Gespeichert werden nur Fakten aus der Liste (Name, Titel/Firma, Foto-Adresse, Link zum offiziellen
Profil); Fotos und Biografien bleiben auf der offiziellen Seite und werden nur verlinkt.
"""
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

LIST_URL = "https://live360events.com/events/orlando-2026/speakers/speaker-list.aspx"
OUT = Path(__file__).resolve().parent.parent / "data" / "speakers.json"
ID_RE = re.compile(r"SpeakerId=(?:%7B|\{)([0-9A-Fa-f-]{36})(?:%7D|\})", re.I)
PHOTO_RE = re.compile(r"/-/media/|speakerphoto|speaker-photos", re.I)
SESSION_RE = re.compile(r"^[A-Z]{2,6}\d{2}$|Live!|Demo Theater|Panel Discussion|Keynote", re.I)
NOISE_RE = re.compile(r"^(view|more|bio|sessions?|read more|speaker|profile|details|close|×)\b.*$", re.I)


def absolute(src):
    """Sitecore-Medien liegen unter /-/media/ an der Wurzel; Leerzeichen in Links kodieren."""
    url = urljoin(LIST_URL, src)
    if "/-/media/" in url:
        url = urljoin(LIST_URL, "/-/media/" + url.split("/-/media/", 1)[1])
    return url.replace(" ", "%20")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (live360-planner; personal use)"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            print(f"fetch failed ({attempt + 1}): {e}", file=sys.stderr)
            time.sleep(2 ** attempt)
    raise SystemExit("could not fetch " + url)


class SpeakerParser(HTMLParser):
    """Sammelt pro SpeakerId: Link, Foto davor, Linktexte und den Text bis zum nächsten Sprecher."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items, self.order = {}, []
        self.cur = None          # SpeakerId des aktuellen Blocks
        self.in_link = None      # SpeakerId, wenn gerade in einem Sprecher-Link
        self.pending_img = None  # zuletzt gesehenes Foto, noch keinem Sprecher zugeordnet
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style", "noscript"):
            self.skip += 1
        elif tag == "img":
            src = a.get("src") or a.get("data-src") or ""
            if PHOTO_RE.search(src):
                if self.in_link and not self.items[self.in_link]["photo"]:
                    self.items[self.in_link]["photo"] = src
                else:
                    self.pending_img = src
        elif tag == "a":
            m = ID_RE.search(a.get("href") or "")
            if m:
                sid = m.group(1).upper()
                if sid not in self.items:
                    self.items[sid] = {"id": sid, "href": a["href"], "photo": None, "link_text": [], "text": []}
                    self.order.append(sid)
                    if self.pending_img:
                        self.items[sid]["photo"] = self.pending_img
                    self.pending_img = None
                self.cur = self.in_link = sid

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self.skip = max(0, self.skip - 1)
        elif tag == "a":
            self.in_link = None

    def handle_data(self, data):
        if self.skip or not self.cur:
            return
        text = " ".join(data.split())
        if not text or NOISE_RE.match(text):
            return
        it = self.items[self.cur]
        (it["link_text"] if self.in_link else it["text"]).append(text)


def main():
    html = fetch(LIST_URL)
    first = ID_RE.search(html)
    if first:  # Ausschnitt fürs Log, um die Struktur prüfen zu können
        print("--- sample ---\n" + html[max(0, first.start() - 1200): first.start() + 1500] + "\n--- end sample ---")
    p = SpeakerParser()
    p.feed(html)
    speakers = []
    for sid in p.order:
        it = p.items[sid]
        texts = list(dict.fromkeys(it["link_text"] + it["text"]))
        if not texts:
            continue
        name, rest = texts[0], []
        for t in texts[1:]:  # Titel/Firma stehen vor den Session-Codes und -Titeln
            if SESSION_RE.search(t):
                break
            rest.append(t)
        speakers.append({
            "id": sid,
            "name": name,
            "title": " · ".join(rest[:4]),
            "photo": absolute(it["photo"]) if it["photo"] else None,
            "url": absolute(it["href"]),
        })
    print(f"{len(speakers)} speakers")
    for s in speakers[:5] + speakers[-3:]:
        print(json.dumps(s, ensure_ascii=False))
    if len(speakers) < 20:
        raise SystemExit("too few speakers parsed, keeping the old file")
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "speakers": speakers},
                              ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
