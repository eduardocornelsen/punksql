// SqlEngine — shared abstraction over the sql.js WASM engine.
// Manages an isolated sandbox DB instance (separate from the challenge globalDB).

const CDNJS = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3";
const IDB_NAME = "punksql-sandbox";
const IDB_STORE = "workspace";
const IDB_KEY = "db";

let _sandboxDB = null;

async function _loadSqlJs() {
  if (window.initSqlJs) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${CDNJS}/sql-wasm.js`;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function _openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function _loadFromIDB() {
  try {
    const db = await _openIDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveToIndexedDB() {
  if (!_sandboxDB) return false;
  try {
    const data = _sandboxDB.export();
    const idb = await _openIDB();
    await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(data, IDB_KEY);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    return true;
  } catch {
    return false;
  }
}

export async function clearIndexedDB() {
  try {
    const idb = await _openIDB();
    await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    return true;
  } catch {
    return false;
  }
}

// Returns the singleton sandbox DB, hydrating from IndexedDB if available.
export async function getSandboxDB(schema) {
  if (_sandboxDB) return _sandboxDB;
  const [saved] = await Promise.all([_loadFromIDB(), _loadSqlJs()]);
  const SQL = await window.initSqlJs({ locateFile: (f) => `${CDNJS}/${f}` });
  if (saved) {
    _sandboxDB = new SQL.Database(saved);
  } else {
    _sandboxDB = new SQL.Database();
    if (schema) _sandboxDB.run(schema);
  }
  return _sandboxDB;
}

export function resetSandboxDB(schema) {
  if (_sandboxDB) {
    try { _sandboxDB.close(); } catch {}
    _sandboxDB = null;
  }
  return getSandboxDB(schema);
}

// Thin wrapper matching the existing runSQL() shape.
export function execSQL(db, sql) {
  const t0 = performance.now();
  try {
    const r = db.exec(sql);
    const ms = (performance.now() - t0).toFixed(1);
    if (!r.length) return { ok: true, columns: [], rows: [], ms, msg: `0 rows (${ms}ms)` };
    return { ok: true, columns: r[0].columns, rows: r[0].values, ms, msg: `${r[0].values.length} rows (${ms}ms)` };
  } catch (e) {
    return { ok: false, columns: [], rows: [], ms: (performance.now() - t0).toFixed(1), msg: e.message };
  }
}

// SAVEPOINT-wrapped execution: runs fn(db), rolls back on error.
export function withScratch(db, fn) {
  db.exec("SAVEPOINT sp_scratch");
  try {
    const result = fn(db);
    db.exec("RELEASE SAVEPOINT sp_scratch");
    return { ok: true, result };
  } catch (e) {
    try { db.exec("ROLLBACK TO SAVEPOINT sp_scratch"); db.exec("RELEASE SAVEPOINT sp_scratch"); } catch {}
    return { ok: false, error: e.message };
  }
}
