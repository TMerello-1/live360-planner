"""Baut index.html aus src/planner.html (dem Artifact-Inhalt) plus PWA-Kopf und -Skript."""
from pathlib import Path

root = Path(__file__).parent
body = (root / "src" / "planner.html").read_text(encoding="utf-8")
head = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b6e8a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Live360 Plan">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
"""
tail = """
<script src="pwa.js"></script>
</body>
</html>
"""
(root / "index.html").write_text(head + body + tail, encoding="utf-8")
print("index.html built")
