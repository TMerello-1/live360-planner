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
