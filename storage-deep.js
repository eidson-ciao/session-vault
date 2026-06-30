// storage-deep.js
// Deep storage dump/restore that runs INSIDE the page via chrome.scripting.executeScript.
// Handles: IndexedDB, Cache Storage, Service Worker registrations (info only), WebSQL.
//
// Everything binary (Blob, ArrayBuffer, TypedArray) is serialized as
// { __b: "<base64>", __t: "blob"|"ab"|"u8a"|... }
// so it survives JSON.stringify and structuredClone-equivalent round-trip.

// ---------------- shared helpers (page-side) ----------------
// IMPORTANT: these helpers must be self-contained string-injected functions
// because chrome.scripting.executeScript only ships the func body, not module imports.

function pageHelpers() {
  // base64 helpers
  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  function b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  // Encode any structured-clonable value into JSON-safe representation
  async function encodeValue(v) {
    if (v === null || v === undefined) return v;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") return v;
    if (t === "bigint") return { __t: "bigint", v: v.toString() };
    if (v instanceof Date) return { __t: "date", v: v.toISOString() };
    if (v instanceof RegExp) return { __t: "regexp", source: v.source, flags: v.flags };
    if (v instanceof Blob) {
      const ab = await v.arrayBuffer();
      return { __t: "blob", mime: v.type || "", b: bufToB64(ab) };
    }
    if (v instanceof ArrayBuffer) return { __t: "ab", b: bufToB64(v) };
    if (ArrayBuffer.isView(v)) {
      return {
        __t: "tav",
        ctor: v.constructor.name,
        b: bufToB64(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)),
      };
    }
    if (v instanceof Map) {
      const out = [];
      for (const [k, val] of v.entries()) out.push([await encodeValue(k), await encodeValue(val)]);
      return { __t: "map", v: out };
    }
    if (v instanceof Set) {
      const out = [];
      for (const val of v.values()) out.push(await encodeValue(val));
      return { __t: "set", v: out };
    }
    if (Array.isArray(v)) {
      const out = [];
      for (const item of v) out.push(await encodeValue(item));
      return out;
    }
    if (t === "object") {
      const out = {};
      for (const k of Object.keys(v)) out[k] = await encodeValue(v[k]);
      return out;
    }
    // Functions, symbols, weak refs etc: drop (not structured-clonable anyway)
    return null;
  }

  function decodeValue(v) {
    if (v === null || v === undefined) return v;
    const t = typeof v;
    if (t !== "object") return v;
    if (Array.isArray(v)) return v.map(decodeValue);
    if (v.__t === "bigint") return BigInt(v.v);
    if (v.__t === "date") return new Date(v.v);
    if (v.__t === "regexp") return new RegExp(v.source, v.flags);
    if (v.__t === "blob") return new Blob([b64ToBuf(v.b)], { type: v.mime || "" });
    if (v.__t === "ab") return b64ToBuf(v.b);
    if (v.__t === "tav") {
      const ctor = self[v.ctor] || Uint8Array;
      const buf = b64ToBuf(v.b);
      return new ctor(buf);
    }
    if (v.__t === "map") {
      const m = new Map();
      for (const [k, val] of v.v) m.set(decodeValue(k), decodeValue(val));
      return m;
    }
    if (v.__t === "set") {
      const s = new Set();
      for (const val of v.v) s.add(decodeValue(val));
      return s;
    }
    const out = {};
    for (const k of Object.keys(v)) out[k] = decodeValue(v[k]);
    return out;
  }

  return { bufToB64, b64ToBuf, encodeValue, decodeValue };
}

// ============================================================
// EXPORT: dump everything into a JSON-safe object
// ============================================================
async function dumpAll() {
  const h = (function () {
    // inline helper code here so it's available in the page
    // NOTE: this function body is reassigned by the caller below
  })();

  const result = {
    indexedDB: [],          // [{name, version, stores: [{name, keyPath, autoIncrement, indexes:[...], records:[{key, value}]}]}]
    cacheStorage: [],       // [{cacheName, entries: [{url, request:{method,headers,body?}, response:{status,statusText,headers,body}}]}]
    serviceWorkers: [],     // [{scope, scriptURL, state}]  — info only
    webSQL: [],             // [{name, version, tables:[{name, sql, rows:[...]}]}]
  };

  // ---------- IndexedDB ----------
  try {
    if (typeof indexedDB.databases === "function") {
      const dbs = await indexedDB.databases();
      for (const info of dbs) {
        if (!info.name) continue;
        const dbDump = await dumpIDB(info.name, h);
        if (dbDump) result.indexedDB.push(dbDump);
      }
    }
  } catch (e) {
    result._idbError = e.message;
  }

  // ---------- Cache Storage ----------
  try {
    if (self.caches) {
      const names = await caches.keys();
      for (const name of names) {
        const cache = await caches.open(name);
        const reqs = await cache.keys();
        const entries = [];
        for (const req of reqs) {
          try {
            const resp = await cache.match(req);
            const reqHeaders = {};
            req.headers.forEach((v, k) => (reqHeaders[k] = v));
            const respHeaders = {};
            resp.headers.forEach((v, k) => (respHeaders[k] = v));
            const respBuf = await resp.clone().arrayBuffer();
            entries.push({
              url: req.url,
              request: {
                method: req.method,
                headers: reqHeaders,
              },
              response: {
                status: resp.status,
                statusText: resp.statusText,
                headers: respHeaders,
                body: h.bufToB64(respBuf),
              },
            });
          } catch (e) {
            // skip bad entries
          }
        }
        result.cacheStorage.push({ cacheName: name, entries });
      }
    }
  } catch (e) {
    result._cacheError = e.message;
  }

  // ---------- Service Worker registrations (info only) ----------
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        const sw = r.active || r.waiting || r.installing;
        result.serviceWorkers.push({
          scope: r.scope,
          scriptURL: sw && sw.scriptURL,
          state: sw && sw.state,
        });
      }
    }
  } catch (e) {
    result._swError = e.message;
  }

  // ---------- WebSQL (deprecated but still in some Chromes) ----------
  try {
    if (typeof self.openDatabase === "function") {
      // We can't enumerate WebSQL databases via API; we'd need their names.
      // Skip enumeration (no portable way). Leave it empty; restoration also can't
      // create dbs we don't know about.
      result._webSQLNote = "WebSQL cannot be enumerated via standard API; skipped.";
    }
  } catch (e) {}

  return result;
}

async function dumpIDB(name, h) {
  return new Promise((resolve) => {
    const openReq = indexedDB.open(name);
    openReq.onerror = () => resolve({ name, error: openReq.error?.message || "open failed" });
    openReq.onsuccess = async () => {
      const db = openReq.result;
      const dbInfo = {
        name: db.name,
        version: db.version,
        stores: [],
      };
      try {
        const storeNames = Array.from(db.objectStoreNames);
        if (storeNames.length === 0) {
          db.close();
          return resolve(dbInfo);
        }
        const tx = db.transaction(storeNames, "readonly");
        for (const storeName of storeNames) {
          const store = tx.objectStore(storeName);
          const meta = {
            name: storeName,
            keyPath: store.keyPath,
            autoIncrement: store.autoIncrement,
            indexes: [],
            records: [],
          };
          for (const idxName of store.indexNames) {
            const idx = store.index(idxName);
            meta.indexes.push({
              name: idx.name,
              keyPath: idx.keyPath,
              unique: idx.unique,
              multiEntry: idx.multiEntry,
            });
          }
          // Read all records
          const records = await new Promise((res) => {
            const out = [];
            const cursorReq = store.openCursor();
            cursorReq.onsuccess = async (e) => {
              const cur = e.target.result;
              if (!cur) return res(out);
              try {
                // Only push key if store has no keyPath (out-of-line key)
                const rec = { value: await h.encodeValue(cur.value) };
                if (store.keyPath == null) rec.key = await h.encodeValue(cur.primaryKey);
                out.push(rec);
              } catch (e) {}
              cur.continue();
            };
            cursorReq.onerror = () => res(out);
          });
          meta.records = records;
          dbInfo.stores.push(meta);
        }
        db.close();
        resolve(dbInfo);
      } catch (e) {
        db.close();
        resolve({ name, error: e.message });
      }
    };
    openReq.onupgradeneeded = () => {
      // db didn't exist, skip
    };
    openReq.onblocked = () => resolve({ name, error: "blocked" });
  });
}

// ============================================================
// IMPORT: restore from dumped object
// ============================================================
async function restoreAll(dump) {
  const h = (function () { /* replaced by injector */ })();
  const summary = {
    indexedDB: { ok: 0, fail: 0 },
    cacheStorage: { ok: 0, fail: 0 },
    serviceWorkers: { staged: 0 },
    webSQL: { skipped: true },
  };

  // ---------- IndexedDB ----------
  for (const dbInfo of dump.indexedDB || []) {
    try {
      await restoreIDB(dbInfo, h);
      summary.indexedDB.ok++;
    } catch (e) {
      summary.indexedDB.fail++;
    }
  }

  // ---------- Cache Storage ----------
  try {
    if (self.caches) {
      for (const cacheDump of dump.cacheStorage || []) {
        try {
          const cache = await caches.open(cacheDump.cacheName);
          for (const entry of cacheDump.entries) {
            try {
              const body = h.b64ToBuf(entry.response.body);
              const resp = new Response(body, {
                status: entry.response.status,
                statusText: entry.response.statusText,
                headers: entry.response.headers,
              });
              const req = new Request(entry.url, {
                method: entry.request.method || "GET",
                headers: entry.request.headers,
              });
              await cache.put(req, resp);
            } catch (e) {}
          }
          summary.cacheStorage.ok++;
        } catch (e) {
          summary.cacheStorage.fail++;
        }
      }
    }
  } catch (e) {}

  // Service workers cannot be installed by an extension on behalf of the page;
  // we just leave a note — the page itself must call navigator.serviceWorker.register
  // when visited.
  if ((dump.serviceWorkers || []).length) {
    summary.serviceWorkers.staged = dump.serviceWorkers.length;
  }

  return summary;
}

async function restoreIDB(dbInfo, h) {
  // Open at the recorded version (or current+1 if it exists with lower version)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbInfo.name, dbInfo.version || 1);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      // Drop existing object stores not in dump, create missing ones
      const wanted = new Set(dbInfo.stores.map((s) => s.name));
      for (const existing of Array.from(db.objectStoreNames)) {
        if (!wanted.has(existing)) db.deleteObjectStore(existing);
      }
      for (const s of dbInfo.stores) {
        let store;
        if (!db.objectStoreNames.contains(s.name)) {
          store = db.createObjectStore(s.name, {
            keyPath: s.keyPath ?? null,
            autoIncrement: !!s.autoIncrement,
          });
        } else {
          store = ev.target.transaction.objectStore(s.name);
        }
        // Rebuild indexes
        for (const existingIdx of Array.from(store.indexNames)) store.deleteIndex(existingIdx);
        for (const idx of s.indexes || []) {
          store.createIndex(idx.name, idx.keyPath, {
            unique: idx.unique,
            multiEntry: idx.multiEntry,
          });
        }
      }
    };
    req.onsuccess = async () => {
      const db = req.result;
      try {
        for (const s of dbInfo.stores) {
          if (!db.objectStoreNames.contains(s.name)) continue;
          const tx = db.transaction([s.name], "readwrite");
          const store = tx.objectStore(s.name);
          // Clear then bulk insert
          await new Promise((res) => {
            const clr = store.clear();
            clr.onsuccess = res;
            clr.onerror = res;
          });
          for (const rec of s.records || []) {
            try {
              const value = h.decodeValue(rec.value);
              if ("key" in rec) {
                store.put(value, h.decodeValue(rec.key));
              } else {
                store.put(value);
              }
            } catch (e) {}
          }
          await new Promise((res) => {
            tx.oncomplete = res;
            tx.onerror = res;
            tx.onabort = res;
          });
        }
        db.close();
        resolve();
      } catch (e) {
        db.close();
        reject(e);
      }
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  });
}

// ============================================================
// Export the wrapped, self-contained functions
// ============================================================

// These are the strings actually injected into target tabs.
// We compile the page-side functions to source so they can run without imports.

function buildPageScript() {
  // Returns a source string with all needed helpers + dumpAll/restoreAll definitions.
  const helpersSrc = pageHelpers.toString();
  const dumpIDBSrc = dumpIDB.toString();
  const dumpAllSrc = dumpAll.toString().replace(
    /const h = \(function \(\) \{[\s\S]*?\}\)\(\);/,
    "const h = (" + helpersSrc + ")();"
  );
  const restoreIDBSrc = restoreIDB.toString();
  const restoreAllSrc = restoreAll.toString().replace(
    /const h = \(function \(\) \{[\s\S]*?\}\)\(\);/,
    "const h = (" + helpersSrc + ")();"
  );
  return [
    helpersSrc,
    dumpIDBSrc,
    dumpAllSrc,
    restoreIDBSrc,
    restoreAllSrc,
  ].join("\n");
}

// Run a function in a target tab, after injecting the page-side script.
export async function dumpDeepStorageInTab(tabId) {
  const pageScript = buildPageScript();
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN", // need MAIN world for indexedDB etc to see page-context dbs
    args: [pageScript],
    func: async (src) => {
      // eslint-disable-next-line no-new-func
      const factory = new Function(src + "\nreturn { dumpAll };");
      const { dumpAll } = factory();
      return await dumpAll();
    },
  });
  return results?.[0]?.result || null;
}

export async function restoreDeepStorageInTab(tabId, dump) {
  const pageScript = buildPageScript();
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [pageScript, dump],
    func: async (src, dump) => {
      // eslint-disable-next-line no-new-func
      const factory = new Function(src + "\nreturn { restoreAll };");
      const { restoreAll } = factory();
      return await restoreAll(dump);
    },
  });
  return results?.[0]?.result || null;
}
