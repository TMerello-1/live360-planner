// "Nach Updates suchen": lädt data/sessions.json (täglich per GitHub Action aktualisiert) und übernimmt Änderungen
(() => {
  const row = document.createElement("div");
  row.className = "update-row";
  row.innerHTML = '<button class="link-btn" id="check-updates"></button><span class="asof" id="data-asof"></span>';
  document.querySelector(".brand .sub").after(row);
  const btn = row.querySelector("#check-updates");

  const fmtDate = iso => {
    const d = new Date(iso.length <= 10 ? iso + "T12:00:00Z" : iso);
    return isNaN(d) ? iso : d.toLocaleString(LANG === "de" ? "de-DE" : "en-US", { day: "numeric", month: "short", hour: iso.length > 10 ? "2-digit" : undefined, minute: iso.length > 10 ? "2-digit" : undefined });
  };
  const label = () => {
    btn.textContent = t("checkUpdates");
    const data = store.get("data", null);
    row.querySelector("#data-asof").textContent = t("asOf", fmtDate((data && data.updated) || BASE_DATE));
  };
  label();
  window.addEventListener("planner-lang", label);
  // Gespeicherte Sprecherliste ohne neues Zeichnen übernehmen; sie wird nur in der Sprecher-Ansicht direkt gebraucht
  const cachedSpk = store.get("speakers", null);
  if (cachedSpk) { applySpeakers(cachedSpk); if (state.view === "spk") render(); }

  const total = ch => Object.values(ch).reduce((a, l) => a + l.length, 0);

  function showResult(ch) {
    const lines = [["codes", "chRenum"], ["rooms", "chRooms"], ["times", "chTimes"], ["titles", "chTitles"], ["speakers", "chSpeakers"], ["added", "chAdded"], ["removed", "chRemoved"]]
      .filter(([k]) => ch[k].length).map(([k, key]) => `<li>${t(key, ch[k].length)}</li>`);
    const mine = [...new Set(Object.values(ch).flat())].filter(s => picked.has(s.id));
    const withRoom = SESSIONS.filter(s => s.room).length;
    const pop = document.getElementById("pop");
    pop.style.setProperty("--c", "var(--accent)");
    pop.innerHTML = `<button class="x" id="pop-x" aria-label="${t("close")}">×</button>
      <h2 id="pop-title">${t("updatesTitle")}</h2>
      ${lines.length ? `<ul class="chg">${lines.join("")}</ul>` : `<p>${t("upToDate")}</p>`}
      ${mine.length ? `<div><div class="lbl">${t("yourPicks")}</div><ul class="chg">${mine.map(s => `<li><b>${esc(s.code || s.title)}</b> ${esc(s.code ? s.title : "")}${s.room ? " · " + esc(s.room) : ""}${s.removed ? " · " + t("removedTag") : ""}</li>`).join("")}</ul></div>` : ""}
      <div class="note">${withRoom ? t("roomsCount", withRoom) : t("noRoomsYet")}</div>
      ${Object.keys(changed).length ? `<div class="pop-foot"><button class="btn primary" data-chg-show>${t("chgShow")}</button><span></span></div>` : ""}`;
    document.getElementById("pop-bg").hidden = false;
    document.body.classList.add("noscroll");
    document.getElementById("pop-x").focus();
  }

  async function check(silent) {
    if (!silent) { btn.disabled = true; btn.textContent = t("checking"); }
    try {
      const r = await fetch("data/sessions.json?t=" + Date.now(), { cache: "no-store" });
      let ch = { codes: [], rooms: [], times: [], titles: [], speakers: [], added: [], removed: [] };
      let redraw = false;
      if (r.ok) {
        const data = await r.json();
        const old = store.get("data", null);
        // Unveränderte Daten nicht erneut anwenden und nicht neu zeichnen (sonst hängt die Seite beim Start kurz)
        if (!old || old.updated !== data.updated || JSON.stringify(old.sessions) !== JSON.stringify(data.sessions)) {
          ch = applyUpdates(data);
          noteChanges(ch);  // bleibt markiert, bis "Als gesehen markieren"
          store.set("data", data);
          redraw = total(ch) > 0;
        }
      } else if (r.status !== 404) throw new Error(r.status);
      // Sprecherliste (Titel, Foto, Profil-Link) gleich mit aktualisieren
      try {
        const rs = await fetch("data/speakers.json?t=" + Date.now(), { cache: "no-store" });
        if (rs.ok) {
          const sp = await rs.json();
          const prev = store.get("speakers", null);
          if (!prev || JSON.stringify(prev.speakers) !== JSON.stringify(sp.speakers)) {
            applySpeakers(sp); store.set("speakers", sp); if (state.view === "spk") redraw = true;
          }
        }
      } catch {}
      if (redraw) render();
      label();
      if (!silent) showResult(ch);
      else if (total(ch)) {
        const affectsPicks = Object.values(ch).flat().some(s => picked.has(s.id));
        if (affectsPicks) showResult(ch); else toast(t("updatesTitle") + ": " + total(ch));
      }
    } catch {
      if (!silent) toast(t("updateFailed"));
    } finally {
      btn.disabled = false; label();
    }
  }

  btn.addEventListener("click", () => check(false));
  // Erst prüfen, wenn die Seite gezeichnet ist und nichts zu tun hat
  const later = window.requestIdleCallback || (f => setTimeout(f, 1500));
  if (navigator.onLine) window.addEventListener("load", () => later(() => check(true), { timeout: 4000 }));
})();
