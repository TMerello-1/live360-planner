// Konferenzwahl: "Diese Konferenz beim Start öffnen"; ohne Haken lässt sich zu einer anderen Konferenz wechseln
(() => {
  if (!window.CONF) return;
  const HOME_KEY = "l360:home"; // { redirect, conf } — liest auch die Startseite (build.py)
  const get = () => { try { return JSON.parse(localStorage.getItem(HOME_KEY)); } catch { return null; } };
  const set = v => { try { localStorage.setItem(HOME_KEY, JSON.stringify(v)); } catch {} };
  const TXT = {
    de: { open: "Diese Konferenz beim Start öffnen", go: "Zu Konferenz wechseln …", all: "Alle Konferenzen" },
    en: { open: "Open this conference on start", go: "Switch to conference …", all: "All conferences" },
  };
  const tx = k => (TXT[LANG] || TXT.en)[k];

  const css = document.createElement("style");
  css.textContent = `
    .conf-row { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; font-size: 0.8rem; color: var(--muted); margin-top: 4px; }
    .conf-row label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
    .conf-row select { padding: 4px 8px; font-size: 0.8rem; }
  `;
  document.head.appendChild(css);

  const row = document.createElement("div");
  row.className = "conf-row";
  row.innerHTML = '<label><input type="checkbox" id="conf-home"> <span></span></label><select id="conf-go" hidden></select>';
  (document.querySelector(".update-row") || document.querySelector(".brand .sub")).after(row);
  const box = row.querySelector("#conf-home"), sel = row.querySelector("#conf-go");
  let list = [{ id: CONF.id, name: CONF.name }];

  // Noch keine Wahl gespeichert: die erste geöffnete Konferenz wird die Startkonferenz
  if (!get()) set({ redirect: true, conf: CONF.id });
  const draw = () => {
    const pref = get();
    box.checked = !!(pref && pref.redirect && pref.conf === CONF.id);
    row.querySelector("span").textContent = tx("open");
    sel.hidden = box.checked;
    sel.innerHTML = `<option value="">${tx("go")}</option>` +
      list.filter(c => c.id !== CONF.id).map(c => `<option value="${c.id}/">${esc(c.name)}${c.dates ? " · " + esc(c.dates[LANG] || c.dates.en) : ""}</option>`).join("") +
      `<option value="?list">${tx("all")}</option>`;
  };
  box.onchange = () => { set({ redirect: box.checked, conf: CONF.id }); draw(); };
  sel.onchange = () => { if (sel.value) location.href = CONF.home + sel.value; };
  window.addEventListener("planner-lang", draw);
  draw();
  fetch(CONF.home + "conferences.json").then(r => r.ok ? r.json() : null).then(d => { if (d && d.conferences) { list = d.conferences; draw(); } }).catch(() => {});
})();
