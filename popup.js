import { encryptJSON, decryptJSON } from "./crypto.js";
import { dumpDeepStorageInTab, restoreDeepStorageInTab } from "./storage-deep.js";

const $ = (id) => document.getElementById(id);

let currentTab = null;
let currentUrl = null;
let currentDomain = null;

function setStatus(msg, level = "ok", elId = "status") {
  const el = $(elId);
  el.textContent = msg;
  el.className = level === "err" ? "status-err" : level === "warn" ? "status-warn" : "status-ok";
}

function rootDomainName(hostname) {
  return hostname.replace(/^www\./, "");
}

function tsName() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Tab switching ----------
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    $("panel-" + t.dataset.tab).classList.add("active");
  });
});

// ---------- Encrypt toggle ----------
function bindEncToggle(checkboxId, wrapId) {
  const cb = $(checkboxId);
  const wrap = $(wrapId);
  const apply = () => { wrap.style.display = cb.checked ? "" : "none"; };
  cb.addEventListener("change", apply);
  apply();
}
bindEncToggle("encEnabled", "pwWrap");
bindEncToggle("encEnabledG", "pwWrapG");

function isEnvelope(obj) {
  return obj && obj.v === 1 && obj.alg === "AES-GCM" && obj.ct && obj.salt && obj.iv;
}

// ---------- Init ----------
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:/.test(tab.url)) {
    $("domain").textContent = "⚠️ Current page not supported (use on http/https pages)";
    $("exportBtn").disabled = true;
    $("importBtn").disabled = true;
    return;
  }
  currentTab = tab;
  currentUrl = tab.url;
  const u = new URL(tab.url);
  currentDomain = u.hostname;
  $("domain").textContent = `🌐 ${currentDomain}`;
}

// =========================================================
// Current Site mode
// =========================================================

async function readSiteCookies() {
  const cookies = await chrome.cookies.getAll({ url: currentUrl });
  const u = new URL(currentUrl);
  const parts = u.hostname.split(".");
  if (parts.length >= 2) {
    const rootDomain = "." + parts.slice(-2).join(".");
    try {
      const more = await chrome.cookies.getAll({ domain: rootDomain });
      const seen = new Set(cookies.map((c) => `${c.domain}|${c.path}|${c.name}`));
      for (const c of more) {
        const k = `${c.domain}|${c.path}|${c.name}`;
        if (!seen.has(k)) {
          cookies.push(c);
          seen.add(k);
        }
      }
    } catch (e) {}
  }
  return cookies;
}

async function readTabStorage(which) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    args: [which],
    func: (which) => {
      const store = which === "local" ? localStorage : sessionStorage;
      const out = {};
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        out[k] = store.getItem(k);
      }
      return out;
    },
  });
  return (results && results[0] && results[0].result) || {};
}

async function writeCookieOne(c) {
  const url =
    (c.secure ? "https://" : "http://") +
    (c.domain.startsWith(".") ? c.domain.slice(1) : c.domain) +
    (c.path || "/");
  const params = {
    url,
    name: c.name,
    value: c.value,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite || "unspecified",
  };
  if (c.storeId) params.storeId = c.storeId;
  if (!c.hostOnly) params.domain = c.domain;
  if (!c.session && c.expirationDate) params.expirationDate = c.expirationDate;
  await chrome.cookies.set(params);
}

async function writeSiteCookies(cookies) {
  let ok = 0, fail = 0;
  for (const c of cookies) {
    try { await writeCookieOne(c); ok++; }
    catch (e) { console.warn("set cookie failed", c.name, e); fail++; }
  }
  return { ok, fail };
}

async function writeTabStorage(which, data) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    args: [which, data],
    func: (which, data) => {
      const store = which === "local" ? localStorage : sessionStorage;
      let ok = 0;
      for (const [k, v] of Object.entries(data || {})) {
        try { store.setItem(k, v); ok++; } catch (e) {}
      }
      return ok;
    },
  });
  return (results && results[0] && results[0].result) || 0;
}

// ---------- Current Site: Export ----------
$("exportBtn").addEventListener("click", async () => {
  try {
    const encrypt = $("encEnabled").checked;
    const pw = $("password").value;
    if (encrypt && (!pw || pw.length < 6))
      return setStatus("Password must be at least 6 characters", "err");
    setStatus("Collecting data...");

    const payload = {
      type: "site",
      meta: { url: currentUrl, domain: currentDomain, exportedAt: new Date().toISOString() },
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      deep: null,
    };
    if ($("incCookies").checked) payload.cookies = await readSiteCookies();
    if ($("incLocal").checked) payload.localStorage = await readTabStorage("local");
    if ($("incSession").checked) payload.sessionStorage = await readTabStorage("session");

    if ($("incDeep").checked) {
      setStatus("Collecting IndexedDB / Cache Storage / SW info (may take a few seconds)...");
      try {
        payload.deep = await dumpDeepStorageInTab(currentTab.id);
      } catch (e) {
        console.warn("deep dump failed", e);
        payload.deepError = e.message;
      }
    }

    const safe = rootDomainName(currentDomain).replace(/[^a-z0-9.-]/gi, "_");
    if (encrypt) {
      setStatus("Encrypting...");
      const envelope = await encryptJSON(payload, pw);
      envelope.kind = "session-vault-site";
      downloadJSON(envelope, `${safe}_${tsName()}.json`);
    } else {
      payload.kind = "session-vault-site";
      downloadJSON(payload, `${safe}_${tsName()}.plain.json`);
    }

    const idbCount = payload.deep?.indexedDB?.length || 0;
    const cacheCount = payload.deep?.cacheStorage?.length || 0;
    const swCount = payload.deep?.serviceWorkers?.length || 0;
    setStatus(
      `✅ Exported${encrypt ? " (encrypted)" : ""}: ${payload.cookies.length} cookies, ${Object.keys(payload.localStorage).length} local, ${Object.keys(payload.sessionStorage).length} session, ${idbCount} IDB, ${cacheCount} caches, ${swCount} SW`
    );
  } catch (e) {
    console.error(e);
    setStatus("❌ " + e.message, "err");
  }
});

$("importBtn").addEventListener("click", () => $("fileInput").click());

// =========================================================
// Whole Browser mode
// =========================================================

async function readAllCookies() {
  return chrome.cookies.getAll({});
}

async function readAllOpenTabsStorage(opts) {
  const tabs = await chrome.tabs.query({});
  const collected = {};
  let scanned = 0;
  for (const tab of tabs) {
    if (!tab.url || !/^https?:/.test(tab.url)) continue;
    const origin = new URL(tab.url).origin;
    if (collected[origin]) continue;
    try {
      // Shallow storage
      const [{ result: shallow }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const dump = (s) => {
            const o = {};
            for (let i = 0; i < s.length; i++) o[s.key(i)] = s.getItem(s.key(i));
            return o;
          };
          return { local: dump(localStorage), session: dump(sessionStorage) };
        },
      });
      const entry = { local: shallow.local, session: shallow.session, deep: null };

      if (opts.deep) {
        try {
          entry.deep = await dumpDeepStorageInTab(tab.id);
        } catch (e) {
          entry.deepError = e.message;
        }
      }
      collected[origin] = entry;
      scanned++;
    } catch (e) {
      // skip pages we can't inject into
    }
  }
  return { collected, scanned };
}

// ---------- Whole Browser: Export ----------
$("exportGlobalBtn").addEventListener("click", async () => {
  try {
    const encrypt = $("encEnabledG").checked;
    const pw = $("passwordG").value;
    if (encrypt && (!pw || pw.length < 6))
      return setStatus("Password must be at least 6 characters", "err", "statusGlobal");

    setStatus("Collecting all cookies...", "ok", "statusGlobal");
    const cookies = await readAllCookies();

    setStatus(`Got ${cookies.length} cookies. Scanning open tabs...`, "ok", "statusGlobal");
    const { collected, scanned } = await readAllOpenTabsStorage({
      deep: $("incDeepG").checked,
    });

    const payload = {
      type: "global",
      meta: {
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        cookieCount: cookies.length,
        originsWithStorage: Object.keys(collected).length,
        tabsScanned: scanned,
      },
      cookies,
      storageByOrigin: collected,
    };

    if (encrypt) {
      setStatus("Encrypting...", "ok", "statusGlobal");
      const envelope = await encryptJSON(payload, pw);
      envelope.kind = "session-vault-global";
      downloadJSON(envelope, `browser-vault_${tsName()}.json`);
    } else {
      payload.kind = "session-vault-global";
      downloadJSON(payload, `browser-vault_${tsName()}.plain.json`);
    }

    setStatus(
      `✅ Done${encrypt ? " (encrypted)" : ""}: ${cookies.length} cookies + ${scanned} open tabs (each with local/session${$("incDeepG").checked ? " + IDB + Cache" : ""}).`,
      "ok", "statusGlobal"
    );
  } catch (e) {
    console.error(e);
    setStatus("❌ " + e.message, "err", "statusGlobal");
  }
});

$("importGlobalBtn").addEventListener("click", () => $("fileInputG").click());

// =========================================================
// Unified import — auto-routes by payload.type
// =========================================================

async function handleImportedFile(file, statusElId) {
  setStatus("Reading file...", "ok", statusElId);
  const parsed = JSON.parse(await file.text());
  let payload;
  if (isEnvelope(parsed)) {
    const pw = $("password").value || $("passwordG").value;
    if (!pw) {
      setStatus("This file is encrypted — enter the password", "err", statusElId);
      return;
    }
    setStatus("Decrypting...", "ok", statusElId);
    payload = await decryptJSON(parsed, pw);
  } else {
    payload = parsed;
  }

  if (payload.type === "global") {
    await importGlobalPayload(payload, statusElId);
  } else {
    await importSitePayload(payload, statusElId);
  }
}

async function importSitePayload(payload, statusElId) {
  if (!currentTab) {
    setStatus("❌ Open the target site in a tab first.", "err", statusElId);
    return;
  }
  setStatus("Writing site data...", "ok", statusElId);
  let cookieRes = { ok: 0, fail: 0 }, localCount = 0, sessionCount = 0;
  if (Array.isArray(payload.cookies))
    cookieRes = await writeSiteCookies(payload.cookies);
  if (payload.localStorage)
    localCount = await writeTabStorage("local", payload.localStorage);
  if (payload.sessionStorage)
    sessionCount = await writeTabStorage("session", payload.sessionStorage);

  let deepSummary = null;
  if (payload.deep) {
    setStatus("Restoring IndexedDB / Cache Storage...", "ok", statusElId);
    try {
      deepSummary = await restoreDeepStorageInTab(currentTab.id, payload.deep);
    } catch (e) {
      console.warn("deep restore failed", e);
    }
  }

  const extra = deepSummary
    ? `, IDB ${deepSummary.indexedDB.ok}/${deepSummary.indexedDB.ok + deepSummary.indexedDB.fail}, caches ${deepSummary.cacheStorage.ok}/${deepSummary.cacheStorage.ok + deepSummary.cacheStorage.fail}`
    : "";
  setStatus(
    `✅ Site import done: cookies ${cookieRes.ok}/${cookieRes.ok + cookieRes.fail}, local ${localCount}, session ${sessionCount}${extra}. Refresh the page.`,
    "ok", statusElId
  );
  const statsEl = statusElId === "statusGlobal" ? $("statsG") : $("stats");
  if (statsEl) statsEl.textContent = `Source: ${payload.meta?.domain || "?"} · exported at ${payload.meta?.exportedAt || "?"}`;
}

async function importGlobalPayload(payload, statusElId) {
  setStatus("Writing cookies...", "ok", statusElId);
  let ok = 0, fail = 0;
  for (const c of payload.cookies || []) {
    try { await writeCookieOne(c); ok++; }
    catch (e) { fail++; }
  }

  let pendingOrigins = 0;
  if (payload.storageByOrigin && Object.keys(payload.storageByOrigin).length) {
    await chrome.storage.local.set({ pendingStorage: payload.storageByOrigin });
    pendingOrigins = Object.keys(payload.storageByOrigin).length;
  }

  setStatus(
    `✅ Whole-browser import: cookies ${ok} ok / ${fail} failed. ` +
    (pendingOrigins
      ? `${pendingOrigins} origins of localStorage / IndexedDB / Cache staged — open the extension after visiting each site to restore.`
      : ""),
    "ok", statusElId
  );
  const statsEl = statusElId === "statusGlobal" ? $("statsG") : $("stats");
  if (statsEl) statsEl.textContent = `Backup time: ${payload.meta?.exportedAt || "?"}`;
}

$("fileInput").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try { await handleImportedFile(file, "status"); }
  catch (e) { console.error(e); setStatus("❌ " + e.message, "err"); }
  finally { ev.target.value = ""; }
});

$("fileInputG").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try { await handleImportedFile(file, "statusGlobal"); }
  catch (e) { console.error(e); setStatus("❌ " + e.message, "err", "statusGlobal"); }
  finally { ev.target.value = ""; }
});

// Check if there is pending storage for the current site
async function checkPendingForCurrentSite() {
  if (!currentTab) return;
  const { pendingStorage } = await chrome.storage.local.get("pendingStorage");
  if (!pendingStorage) return;
  const origin = new URL(currentUrl).origin;
  if (!pendingStorage[origin]) return;

  const banner = document.createElement("div");
  banner.className = "warn";
  banner.style.cursor = "pointer";
  banner.innerHTML = `🔄 Pending storage for this origin — <b>click here to restore</b>`;
  banner.addEventListener("click", async () => {
    try {
      const data = pendingStorage[origin];
      const lc = await writeTabStorage("local", data.local || {});
      const sc = await writeTabStorage("session", data.session || {});
      let deepRes = null;
      if (data.deep) {
        try {
          deepRes = await restoreDeepStorageInTab(currentTab.id, data.deep);
        } catch (e) {}
      }
      delete pendingStorage[origin];
      if (Object.keys(pendingStorage).length === 0) {
        await chrome.storage.local.remove("pendingStorage");
      } else {
        await chrome.storage.local.set({ pendingStorage });
      }
      const extra = deepRes
        ? `, IDB ${deepRes.indexedDB.ok}, caches ${deepRes.cacheStorage.ok}`
        : "";
      banner.textContent = `✅ Restored ${lc} local + ${sc} session${extra}. Refresh the page.`;
    } catch (e) {
      banner.textContent = "❌ " + e.message;
    }
  });
  $("panel-site").insertBefore(banner, $("panel-site").firstChild.nextSibling);
}

init().then(checkPendingForCurrentSite);
