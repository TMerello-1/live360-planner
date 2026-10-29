// Geräte-Sync: gemerkte Sessions in einem geheimen GitHub Gist; Konflikte pro Session nach Zeitstempel
(() => {
  Object.assign(I18N.de, {
    sync: "Sync", syncOff: "Sync aus", syncOk: d => "Synchronisiert " + d, syncBusy: "Synchronisiere …", syncErr: "Sync fehlgeschlagen",
    syncTitle: "Plan auf allen Geräten",
    syncIntro: "Deine gemerkten Sessions werden in einem geheimen Gist (einer kleinen privaten Datei) in deinem GitHub-Konto gespeichert und laufen automatisch zwischen deinen Geräten mit.",
    syncStep1: "1. Token erstellen: Link öffnen, ganz unten „Generate token“ tippen und den Token kopieren. Nur das Recht „gist“ ist angehakt.",
    syncOpenGh: "Token bei GitHub erstellen ↗",
    syncStep2: "2. Token hier einfügen (oder den Verbindungslink eines anderen Geräts):", syncConnect: "Verbinden", syncBadToken: "GitHub hat den Token abgelehnt. Bitte prüfen.",
    syncOn: "Sync ist an. Änderungen gehen automatisch an deine anderen Geräte.", syncNow: "Jetzt synchronisieren",
    syncPair: "Weiteres Gerät verbinden", syncPairText: "Diesen Code mit dem anderen Gerät scannen oder den Link dort öffnen. Er enthält deinen Token, also nicht weitergeben. Für die Homescreen-App auf dem iPhone: Link kopieren und dort unter „Sync“ einfügen.",
    syncCopyLink: "Link kopieren", syncLinkCopied: "Link kopiert", syncDisconnect: "Sync auf diesem Gerät beenden",
    syncPaired: "Gerät verbunden, Plan wird synchronisiert", syncPlanUpdated: "Plan von anderem Gerät übernommen",
  });
  Object.assign(I18N.en, {
    sync: "Sync", syncOff: "Sync off", syncOk: d => "Synced " + d, syncBusy: "Syncing …", syncErr: "Sync failed",
    syncTitle: "Your plan on every device",
    syncIntro: "Your saved sessions are stored in a secret Gist (a small private file) in your GitHub account and stay in sync across your devices automatically.",
    syncStep1: "1. Create a token: open the link, tap “Generate token” at the bottom and copy the token. Only the “gist” permission is ticked.",
    syncOpenGh: "Create token on GitHub ↗",
    syncStep2: "2. Paste the token here (or a connect link from another device):", syncConnect: "Connect", syncBadToken: "GitHub rejected the token. Please check it.",
    syncOn: "Sync is on. Changes go to your other devices automatically.", syncNow: "Sync now",
    syncPair: "Connect another device", syncPairText: "Scan this code with the other device or open the link there. It contains your token, so don't share it. For the home-screen app on iPhone: copy the link and paste it into Sync there.",
    syncCopyLink: "Copy link", syncLinkCopied: "Link copied", syncDisconnect: "Stop syncing on this device",
    syncPaired: "Device connected, syncing your plan", syncPlanUpdated: "Plan updated from another device",
  });

  const FILE = (window.CONF && CONF.gistFile) || "live360-orlando-2026-plan.json";
  const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=gist&description=Live360%20Planner%20sync";
  // { token, gist } je Konferenz; der Token gilt für alle Konferenzen, damit man nur einmal koppeln muss
  const TOKEN_KEY = "l360:syncToken";
  const shared = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
  const share = c => { try { c && c.token ? localStorage.setItem(TOKEN_KEY, c.token) : localStorage.removeItem(TOKEN_KEY); } catch {} };
  let cfg = store.get("sync", null) || (shared() ? { token: shared(), gist: null } : null);
  const saveCfg = () => { store.set("sync", cfg); share(cfg); };
  share(cfg);
  let log = store.get("syncLog", {}); // id -> [1|0, ms] für Gemerkte, "x:"+id für "Kein Interesse", "m:"+id für "Muss ich sehen"
  let lastSync = store.get("syncAt", 0), busy = false, failed = false, timer = 0;

  // Lokale Änderungen mitschreiben: savePicked wird bei jeder Änderung (auch "Kein Interesse") aufgerufen
  const keys = () => new Set([...picked, ...[...nope].map(id => "x:" + id), ...[...must].map(id => "m:" + id)]);
  let snap = keys();
  for (const k of snap) if (!log[k]) log[k] = [1, 1];
  store.set("syncLog", log);
  const origSave = savePicked;
  savePicked = function () {
    origSave();
    const now = Date.now(), cur = keys();
    for (const k of cur) if (!snap.has(k)) log[k] = [1, now];
    for (const k of snap) if (!cur.has(k)) log[k] = [0, now];
    snap = cur;
    store.set("syncLog", log);
    if (cfg) { clearTimeout(timer); timer = setTimeout(sync, 1200); }
  };

  const api = (path, opts = {}) => fetch("https://api.github.com" + path, {
    cache: "no-store", ...opts,
    headers: { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json", ...(opts.body ? { "Content-Type": "application/json" } : {}) },
  }).then(r => { if (!r.ok) { const e = new Error(r.status); e.status = r.status; throw e; } return r.json(); });

  async function findGist() {
    for (let page = 1; page <= 5; page++) {
      const list = await api(`/gists?per_page=100&page=${page}`);
      const hit = list.find(g => g.files && g.files[FILE]);
      if (hit) return hit.id;
      if (list.length < 100) break;
    }
    const g = await api("/gists", { method: "POST", body: JSON.stringify({ public: false, description: ((window.CONF && CONF.name) || "Live! 360 Orlando 2026") + " planner (sync)", files: { [FILE]: { content: JSON.stringify({ v: 1, items: {} }) } } }) });
    return g.id;
  }

  async function sync() {
    if (!cfg || busy || !navigator.onLine) return;
    busy = true; failed = false; label();
    try {
      if (!cfg.gist) { cfg.gist = await findGist(); saveCfg(); }
      let remote = {};
      try {
        const g = await api("/gists/" + cfg.gist);
        const f = g.files[FILE];
        const text = f.truncated ? await fetch(f.raw_url, { cache: "no-store" }).then(r => r.text()) : f.content;
        remote = (JSON.parse(text || "{}").items) || {};
      } catch (e) {
        if (e.status !== 404) throw e;
        cfg.gist = await findGist(); saveCfg();
      }
      // Pro Session gewinnt die jüngere Änderung
      const merged = { ...remote };
      for (const [id, v] of Object.entries(log)) if (!merged[id] || v[1] > merged[id][1]) merged[id] = v;
      const before = [...keys()].sort().join();
      log = merged; store.set("syncLog", log);
      const on = Object.keys(log).filter(k => log[k][0]);
      picked = new Set(on.filter(k => BY_ID[k]));
      nope = new Set(on.filter(k => k.startsWith("x:") && BY_ID[k.slice(2)]).map(k => k.slice(2)));
      must = new Set(on.filter(k => k.startsWith("m:") && BY_ID[k.slice(2)]).map(k => k.slice(2)));
      snap = keys();
      origSave();
      if ([...snap].sort().join() !== before) { render(); toast(t("syncPlanUpdated")); }
      if (JSON.stringify(merged) !== JSON.stringify(remote)) {
        await api("/gists/" + cfg.gist, { method: "PATCH", body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify({ v: 1, items: merged }) } } }) });
      }
      lastSync = Date.now(); store.set("syncAt", lastSync);
    } catch (e) {
      failed = true;
      if (e.status === 401) { cfg = null; saveCfg(); toast(t("syncBadToken")); }
    } finally {
      busy = false; label();
    }
  }

  // Oberfläche: Link in der Update-Zeile, Details im Popup
  const btn = document.createElement("button");
  btn.className = "link-btn"; btn.id = "sync-btn";
  const status = document.createElement("span");
  status.className = "asof";
  const row = document.querySelector(".update-row") || document.querySelector(".brand .sub");
  row.append(btn, status);

  function label() {
    btn.textContent = (cfg ? "⟳ " : "") + t("sync");
    status.textContent = !cfg ? t("syncOff") : busy ? t("syncBusy") : failed ? t("syncErr")
      : lastSync ? t("syncOk", new Date(lastSync).toLocaleTimeString(LANG === "de" ? "de-DE" : "en-US", { hour: "2-digit", minute: "2-digit" })) : "";
  }
  label();
  window.addEventListener("planner-lang", () => { label(); if (!document.getElementById("pop-bg").hidden && document.getElementById("sync-pop")) openPop(); });

  const pairLink = () => location.origin + location.pathname + "#sync=" + btoa(JSON.stringify({ t: cfg.token, g: cfg.gist }));

  function openPop(showPair) {
    const pop = document.getElementById("pop");
    pop.style.setProperty("--c", "var(--accent)");
    pop.innerHTML = `<button class="x" id="pop-x" aria-label="${t("close")}">×</button>
      <h2 id="pop-title"><span id="sync-pop"></span>${t("syncTitle")}</h2>
      ${!cfg ? `<p>${t("syncIntro")}</p>
        <p>${t("syncStep1")}</p>
        <p><a class="btn" href="${TOKEN_URL}" target="_blank" rel="noopener">${t("syncOpenGh")}</a></p>
        <p>${t("syncStep2")}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="sync-token" type="password" autocomplete="off" spellcheck="false" placeholder="ghp_…" style="flex:1;min-width:0;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font:inherit;background:var(--bg);color:var(--fg)"><button class="btn primary" id="sync-connect">${t("syncConnect")}</button></div>
        <div class="note" id="sync-msg"></div>`
      : `<p>${t("syncOn")}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="sync-now">${t("syncNow")}</button><button class="btn" id="sync-pair">${t("syncPair")}</button></div>
        ${showPair ? `<div><p class="note">${t("syncPairText")}</p><div id="sync-qr" style="background:#fff;padding:10px;display:inline-block;border-radius:8px"></div><p><button class="btn" id="sync-copy">${t("syncCopyLink")}</button></p></div>` : ""}
        <p><button class="link-btn" id="sync-off" style="color:var(--danger)">${t("syncDisconnect")}</button></p>`}`;
    document.getElementById("pop-bg").hidden = false;
    document.body.classList.add("noscroll");
    const $p = s => pop.querySelector(s);
    if (!cfg) {
      $p("#sync-connect").onclick = async () => {
        const raw = $p("#sync-token").value.trim();
        if (!raw) return;
        // Akzeptiert auch den Verbindungslink eines anderen Geräts
        let token = raw, gist = null;
        const lm = raw.match(/sync=([^&\s]+)/);
        if (lm) try { const d = JSON.parse(atob(decodeURIComponent(lm[1]))); token = d.t; gist = d.g || null; } catch {}
        $p("#sync-connect").disabled = true; $p("#sync-msg").textContent = t("syncBusy");
        cfg = { token, gist };
        try { await api("/gists?per_page=1"); saveCfg(); await sync(); openPop(); }
        catch { cfg = null; $p("#sync-msg").textContent = t("syncBadToken"); $p("#sync-connect").disabled = false; }
      };
      $p("#sync-token").focus();
    } else {
      $p("#sync-now").onclick = () => sync();
      $p("#sync-pair").onclick = () => openPop(true);
      $p("#sync-off").onclick = () => { cfg = null; saveCfg(); label(); openPop(); };
      if (showPair) {
        const link = pairLink();
        $p("#sync-copy").onclick = () => { try { navigator.clipboard.writeText(link).then(() => toast(t("syncLinkCopied"))); } catch {} };
        const draw = () => { const q = qrcode(0, "M"); q.addData(link); q.make(); $p("#sync-qr").innerHTML = q.createSvgTag({ cellSize: 4, margin: 0 }); };
        if (window.qrcode) draw();
        else { const s = document.createElement("script"); s.src = ((window.CONF && CONF.home) || "") + "vendor/qrcode.js"; s.onload = draw; document.head.append(s); }
      }
    }
  }
  btn.addEventListener("click", () => openPop());

  // Verbindungslink vom anderen Gerät übernehmen
  function takeLink() {
    const m = location.hash.match(/[#&]sync=([^&]+)/);
    if (!m) return;
    try {
      const d = JSON.parse(atob(decodeURIComponent(m[1])));
      if (d.t) { cfg = { token: d.t, gist: d.g || null }; saveCfg(); toast(t("syncPaired")); }
    } catch {}
    history.replaceState(null, "", location.pathname + location.search);
  }
  takeLink();
  window.addEventListener("hashchange", () => { takeLink(); sync(); });

  if (cfg) sync();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); });
  window.addEventListener("online", sync);
  setInterval(() => { if (document.visibilityState === "visible") sync(); }, 60000);
})();
