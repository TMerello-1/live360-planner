# Live! 360 Planner: features

A personal session planner for Live! 360 Orlando 2026, built from the official session list. This file lists every feature and how it is built, so the app can be reused for another conference.

- Installable app: https://tmerello-1.github.io/live360-planner/
- Claude version: https://claude.ai/artifact/CXA3y833b1WxjV8HHugaEJ. It has every feature except updates, install and sync, because it can't reach other websites.

## Browsing the program

| Feature | What it does | How it's built |
|---|---|---|
| Day tabs | Shows one conference day at a time (Nov 15–20). | `DAYS`, `state.day`. Each session gets an id of the form `day:code`. |
| Time slots | Groups sessions by start time and shows the end time or the number of items. | `slotsOf(day)` builds slots from non-event sessions; `SLOTS`, `slotAt()`. |
| Filters | Time slot, format (Keynote, Session, Fast Focus, Workshop, Lab, Panel, Event), conference chips, "Saved only", "Hide breaks", "Reset filters". | `filtered()`, `state.*`. The UI state is kept in localStorage under `ui`. |
| Global search | Typing searches all days: titles, speakers, codes, conference, room, description and learning goals. Results are grouped under day headings with a count. | `filtered()` ignores the day and slot while `state.q` is set; `renderProgram()` adds `.day-head`. |
| Conference colours | Each conference has its own colour and short name (VS Live!, Data Platform, TechMentor, AI Live!, AI Architecture, Cyber Live!, Live! 360). | `TRACKS` with CSS colour variables, and a `trackHint` in the raw data. |
| Session popup | Tapping a title opens a small window with a summary, "What you'll learn", level, speakers, room and a link to the official page. | `DESC` (our own short summaries, fetched once), `openInfo(id)` / `closeInfo()`. |

## Planning

| Feature | What it does | How it's built |
|---|---|---|
| Save sessions | A "+ Save" or "★ Saved" button on every card. | A `picked` Set saved to localStorage `picked` via `savePicked()`. |
| Conflict warnings | Saved sessions that overlap are marked red. Unsaved sessions show "collides with your selection", and each day gets a banner listing its overlaps. | `overlaps()`, `conflictsOf()`, `conflictPairs()`. Removed sessions are ignored. |
| My Plan | A timeline per day of saved sessions plus every empty slot. It shows stats for saved sessions, hours and overlaps, and how many slots are still free per day. | `renderPlan()`. |
| Empty slots | Shown as "Still free, N items to choose from, View →". Slots that a longer session covers say "Taken by …". | The `.slot-empty` and `.covered` rows in `renderPlan()`. |
| Single-option slots | A slot with only one session (such as a keynote) shows that session directly with an "Only option" tag and a one-tap Save. | `cardHTML(s, {plan, only})`. |
| Slot comparison | Tapping a slot shows all its sessions side by side, with a switch between "Display titles" and "Display descriptions". | `renderCompare()`, `state.cmpDay`, `state.cmpStart`, `state.cmpMode`. |
| Copy / clear plan | Copies the plan as text (with a fallback for when the clipboard is blocked). Clearing everything asks for confirmation first. | `planText()`, `#copy`, `#clear-confirm`. |

## App and language

| Feature | What it does | How it's built |
|---|---|---|
| German / English | A DE/EN switch. It defaults to the browser language and is remembered. | An `I18N {de,en}` dictionary, `t(key,…args)`, `data-i18n*` attributes, `applyLang()`, and a `planner-lang` event. |
| Installable (PWA) | An install button on Android and desktop, and a short guide for iPhone. It works offline. | `manifest.webmanifest`, `icons/`, `pwa.js`, and `sw.js` (network-first page, cached fonts; bump `VERSION` whenever cached files change). |
| Program updates | "Check for updates" with "Data as of …". It runs once on start and shows changes to rooms, times, titles, speakers, and new or cancelled sessions, with a list of the changes that affect your plan. | A GitHub Action runs `scripts/scrape.py` daily at 06:17 UTC and writes `data/sessions.json`. `updates.js` loads it and `applyUpdates()` matches sessions by URL, or by `day:code` when there is no URL. |
| Sync across devices | Saved sessions sync automatically through a secret GitHub Gist. When the same session changes on two devices, the latest change wins. Other devices connect by QR code or by pasting a connect link. | `sync.js`: a token with the `gist` scope only and a per-session `[on, timestamp]` log, synced on start, on focus, every minute and after each change. The QR code uses `vendor/qrcode.js`. |

## Build and deploy

- The app source is `src/planner.html`, which is the same file as the Claude version.
- `python3 build.py` builds `index.html` by adding the PWA head, `updates.js`, `sync.js` and `pwa.js`.
- GitHub Pages serves from `main`, root folder.
- The workflow `.github/workflows/update-sessions.yml` commits fresh data every day and can also be started by hand.

## Reusing for another conference

1. Replace `RAW` in `src/planner.html`. Each line is `code|title|time|speakers|slug|trackHint`, and each day starts with a header line `#15 Sunday So`.
2. Update `DAYS`, `TRACKS`, `BASE_DATE` and the title texts in `I18N`.
3. Regenerate `DESC` (id → summary, learn, level, track) or leave it empty.
4. Point `scripts/scrape.py` at the new session list, and change the Gist file name in `sync.js` and the storage prefix `l360or26:`.
5. Run `python3 build.py`, bump `VERSION` in `sw.js`, and push.
