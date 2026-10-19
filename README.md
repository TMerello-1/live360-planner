# Live! 360 Orlando 2026 Planner

Personal session planner for Live! 360 Orlando (November 15–20, 2026), built from the official session list.

- Browse all sessions by day, time slot, format and conference
- Save sessions and get warned about overlapping times
- "Mein Plan" shows each day with empty slots; click a slot to compare all its sessions side by side
- Click a session title for a short summary of the official description
- Switch between English and German with the DE / EN toggle (defaults to your browser language)

Live site: https://tmerello-1.github.io/live360-planner/

Your picks are stored in your browser's local storage only.

## Install as an app

The site is a PWA. On Chrome, Edge or Android, use the **Installieren** button in the header. On iPhone or iPad, the same button shows how to add it from Safari's Share menu. Once installed, the planner also works offline.

## Updating

`src/planner.html` holds the planner itself. Run `python3 build.py` to rebuild `index.html` with the PWA head and install script. Bump `VERSION` in `sw.js` when you change cached files.

## Session updates

A GitHub Action (`.github/workflows/update-sessions.yml`) re-reads the official session list every day at 06:17 UTC and commits changes to `data/sessions.json` (rooms once they're published, time or title changes, new or cancelled sessions). In the app, **Check for updates** loads that file and shows what changed. You can also run the action by hand from the Actions tab.

## Sync across devices

`sync.js` keeps saved sessions in a secret GitHub Gist (`live360-orlando-2026-plan.json`) using a personal token with only the `gist` scope. Each session's latest change wins, so edits on several devices merge. Other devices connect by QR code or by pasting the connect link. The QR code uses the vendored `vendor/qrcode.js` (qrcode-generator 1.4.4, MIT).
