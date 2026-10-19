// Installierbarkeit: Service Worker registrieren und einen "Installieren"-Knopf anbieten
(() => {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }

  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) return;

  const css = document.createElement("style");
  css.textContent = `
    .install-btn { border: 1px solid var(--accent); background: var(--accent); color: var(--accent-ink); border-radius: 999px; padding: 6px 14px; font-weight: 600; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 6px; }
    .install-btn svg { width: 15px; height: 15px; }
    .brand-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .ios-steps { margin: 0; padding-left: 1.2em; display: grid; gap: 8px; line-height: 1.5; }
  `;
  document.head.appendChild(css);

  const btn = document.createElement("button");
  btn.className = "install-btn";
  btn.id = "install";
  btn.hidden = true;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14"/></svg>Installieren';
  const views = document.querySelector(".views");
  const wrap = document.createElement("div");
  wrap.className = "brand-actions";
  views.replaceWith(wrap);
  wrap.append(btn, views);

  let deferred = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; btn.hidden = false; });
  window.addEventListener("appinstalled", () => { deferred = null; btn.hidden = true; });

  // iOS Safari kennt kein Installations-Ereignis: dort eine kurze Anleitung zeigen
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) btn.hidden = false;

  btn.addEventListener("click", async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") btn.hidden = true;
      deferred = null;
      return;
    }
    const pop = document.getElementById("pop");
    pop.style.setProperty("--c", "var(--accent)");
    pop.innerHTML = `<button class="x" id="pop-x" aria-label="Schließen">×</button>
      <h2 id="pop-title">Auf den Home-Bildschirm</h2>
      <ol class="ios-steps">
        <li>Tippe in Safari unten auf <b>Teilen</b> (das Quadrat mit dem Pfeil nach oben).</li>
        <li>Wähle <b>Zum Home-Bildschirm</b>.</li>
        <li>Tippe auf <b>Hinzufügen</b>.</li>
      </ol>
      <div class="note">Danach startet der Planer wie eine App, auch ohne Internet.</div>`;
    document.getElementById("pop-bg").hidden = false;
    document.body.classList.add("noscroll");
    document.getElementById("pop-x").focus();
  });
})();
