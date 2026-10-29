// Konferenzwahl: "Diese Konferenz beim Start öffnen"; ohne Haken lässt sich zu einer anderen Konferenz wechseln
(() => {
  if (!window.CONF) return;
  const HOME_KEY = "l360:home"; // { redirect, conf } — liest auch die Startseite (build.py)
  const get = () => { try { return JSON.parse(localStorage.getItem(HOME_KEY)); } catch { return null; } };
  const set = v => { try { localStorage.setItem(HOME_KEY, JSON.stringify(v)); } catch {} };
  const TXT = {
    de: { open: "Beim Start öffnen", openLong: "Diese Konferenz beim Start öffnen", go: "Wechseln ▾", all: "Alle Konferenzen" },
    en: { open: "Open on start", openLong: "Open this conference on start", go: "Switch ▾", all: "All conferences" },
  };
  const tx = k => (TXT[LANG] || TXT.en)[k];

  const css = document.createElement("style");
  css.textContent = `
    .conf-row { display: inline-flex; gap: 8px; align-items: center; font-size: 0.75rem; color: var(--muted); }
    .conf-row label { display: inline-flex; gap: 4px; align-items: center; cursor: pointer; white-space: nowrap; }
    .conf-row input { margin: 0; width: 13px; height: 13px; }
    .conf-go { position: relative; }
    .conf-go > button { border: 0; background: none; padding: 0; font: inherit; font-weight: 600; color: var(--accent); cursor: pointer; }
    .conf-menu { position: absolute; left: 0; top: calc(100% + 6px); z-index: 50; min-width: 220px; max-width: calc(100vw - 32px); padding: 4px 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface, #fff); box-shadow: 0 6px 24px rgba(0,0,0,.18); }
    .conf-menu a { display: block; padding: 10px 14px; color: var(--fg, inherit); text-decoration: none; font-size: 0.875rem; line-height: 1.3; }
    .conf-menu a small { display: block; color: var(--muted); font-size: 0.75rem; }
    .conf-menu a + a { border-top: 1px solid var(--line); }
    .conf-menu a:hover, .conf-menu a:focus-visible { background: var(--accent-soft); }
  `;
  document.head.appendChild(css);

  const row = document.createElement("span");
  row.className = "conf-row";
  row.innerHTML = '<label><input type="checkbox" id="conf-home"> <span></span></label>' +
    '<span class="conf-go" id="conf-go" hidden><button type="button" aria-haspopup="true" aria-expanded="false"></button><span class="conf-menu" hidden></span></span>';
  // In die Zeile "Nach Updates suchen" einreihen, damit es auf dem Handy keine eigene Zeile braucht
  const host = document.querySelector(".update-row");
  if (host) host.append(row); else document.querySelector(".brand .sub").after(row);
  // Eigenes kleines Menü statt <select>: das native Auswahlfenster war auf Android leer bzw. seltsam breit
  const box = row.querySelector("#conf-home"), sel = row.querySelector("#conf-go");
  const btn = sel.querySelector("button"), menu = sel.querySelector(".conf-menu");
  const showMenu = open => { menu.hidden = !open; btn.setAttribute("aria-expanded", open); };
  let list = CONF.list || [{ id: CONF.id, name: CONF.name }];

  // Noch keine Wahl gespeichert: die erste geöffnete Konferenz wird die Startkonferenz
  if (!get()) set({ redirect: true, conf: CONF.id });
  const draw = () => {
    const pref = get();
    box.checked = !!(pref && pref.redirect && pref.conf === CONF.id);
    row.querySelector("span").textContent = tx("open");
    row.querySelector("label").title = tx("openLong");
    sel.hidden = box.checked;
    btn.textContent = tx("go");
    menu.innerHTML = list.filter(c => c.id !== CONF.id).map(c => `<a href="${CONF.home}${c.id}/">${esc(c.name)}${c.dates ? `<small>${esc(c.dates[LANG] || c.dates.en)}</small>` : ""}</a>`).join("") +
      `<a href="${CONF.home}?list">${tx("all")}</a>`;
  };
  box.onchange = () => { set({ redirect: box.checked, conf: CONF.id }); draw(); };
  btn.onclick = e => { e.stopPropagation(); showMenu(menu.hidden); };
  document.addEventListener("click", e => { if (!sel.contains(e.target)) showMenu(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") showMenu(false); });
  window.addEventListener("planner-lang", draw);
  draw();
  fetch(CONF.home + "conferences.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).then(d => { if (d && d.conferences) { list = d.conferences; draw(); } }).catch(() => {});
})();
