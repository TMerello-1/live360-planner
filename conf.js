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
    .conf-row select { appearance: none; -webkit-appearance: none; border: 0; background: none; padding: 0; font: inherit; font-weight: 600; color: var(--accent); cursor: pointer; }
  `;
  document.head.appendChild(css);

  const row = document.createElement("span");
  row.className = "conf-row";
  row.innerHTML = '<label><input type="checkbox" id="conf-home"> <span></span></label><select id="conf-go" hidden></select>';
  // In die Zeile "Nach Updates suchen" einreihen, damit es auf dem Handy keine eigene Zeile braucht
  const host = document.querySelector(".update-row");
  if (host) host.append(row); else document.querySelector(".brand .sub").after(row);
  const box = row.querySelector("#conf-home"), sel = row.querySelector("#conf-go");
  let list = CONF.list || [{ id: CONF.id, name: CONF.name }];

  // Noch keine Wahl gespeichert: die erste geöffnete Konferenz wird die Startkonferenz
  if (!get()) set({ redirect: true, conf: CONF.id });
  const draw = () => {
    const pref = get();
    box.checked = !!(pref && pref.redirect && pref.conf === CONF.id);
    row.querySelector("span").textContent = tx("open");
    row.querySelector("label").title = tx("openLong");
    sel.hidden = box.checked;
    sel.innerHTML = `<option value="">${tx("go")}</option>` +
      list.filter(c => c.id !== CONF.id).map(c => `<option value="${c.id}/">${esc(c.name)}${c.dates ? " · " + esc(c.dates[LANG] || c.dates.en) : ""}</option>`).join("") +
      `<option value="?list">${tx("all")}</option>`;
  };
  box.onchange = () => { set({ redirect: box.checked, conf: CONF.id }); draw(); };
  sel.onchange = () => { if (sel.value) location.href = CONF.home + sel.value; };
  window.addEventListener("planner-lang", draw);
  draw();
  fetch(CONF.home + "conferences.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).then(d => { if (d && d.conferences) { list = d.conferences; draw(); } }).catch(() => {});
})();
