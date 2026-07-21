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
    // sql.js export() closes + reopens the connection, which drops every
    // ATTACHed database. File-backed attachments (see attachMemoryDB) keep
    // their data in the WASM FS, so re-attach them right after the export.
    const attached = listDatabases(_sandboxDB).filter((d) => d.name !== "main" && d.file);
    const data = _sandboxDB.export();
    attached.forEach((d) => execSQL(_sandboxDB, `ATTACH DATABASE '${d.file}' AS "${d.name}"`));
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

// ── Multi-database (ATTACH) helpers — TDD §2.1 ────────────────
// SQLite's namespacing unit is the attached database; we emulate
// "schemas" by attaching named in-memory DBs (analytics.fct_orders).
// Attached DBs are session-only: db.export() persists main alone.
const DB_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED_DB_NAMES = new Set(["main", "temp"]);

export function listDatabases(db) {
  const r = execSQL(db, "PRAGMA database_list");
  if (!r.ok) return [{ name: "main", file: "" }];
  return r.rows.map(([, name, file]) => ({ name, file: file || "" }));
}

export function attachMemoryDB(db, name) {
  if (!DB_NAME_RE.test(name || "")) return { ok: false, msg: `invalid database name '${name}' (letters, digits, _ — must not start with a digit)` };
  if (RESERVED_DB_NAMES.has(name.toLowerCase())) return { ok: false, msg: `'${name}' is reserved` };
  if (listDatabases(db).some((d) => d.name.toLowerCase() === name.toLowerCase())) return { ok: false, msg: `database '${name}' is already attached` };
  // File-backed in the WASM in-memory FS (NOT ':memory:'): survives the
  // close/reopen that db.export() performs on every workspace auto-save.
  // Still session-only — the FS lives in RAM and IndexedDB saves main only.
  const r = execSQL(db, `ATTACH DATABASE '/attached_${name}.db' AS "${name}"`);
  if (!r.ok) return { ok: false, msg: r.msg };
  wipeDatabase(db, name); // clear stale objects if this name existed earlier in the session
  return { ok: true, msg: `attached '${name}'` };
}

function wipeDatabase(db, name) {
  const r = execSQL(db, `SELECT name, type FROM "${name}".sqlite_master WHERE type IN ('table','view')`);
  if (!r.ok) return;
  r.rows.forEach(([obj, type]) => execSQL(db, `DROP ${type === "view" ? "VIEW" : "TABLE"} IF EXISTS "${name}"."${obj}"`));
}

export function detachDatabase(db, name) {
  if (RESERVED_DB_NAMES.has((name || "").toLowerCase())) return { ok: false, msg: `cannot detach '${name}'` };
  wipeDatabase(db, name); // empty the backing file so a later re-attach starts clean
  const r = execSQL(db, `DETACH DATABASE "${name}"`);
  return r.ok ? { ok: true, msg: `detached '${name}'` } : { ok: false, msg: r.msg };
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
