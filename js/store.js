// Almacenamiento local del usuario (IndexedDB con respaldo en localStorage y en memoria).
// Nada sale del dispositivo.
const DB = 'interlineal', OS = 'kv';
let dbp = null;
const mem = new Map();

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(OS);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}

export async function get(key, def) {
  const db = await open();
  if (db) {
    try {
      const v = await new Promise((res, rej) => {
        const q = db.transaction(OS).objectStore(OS).get(key);
        q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
      });
      if (v !== undefined) return v;
    } catch {}
  }
  try { const s = localStorage.getItem('il:' + key); if (s != null) return JSON.parse(s); } catch {}
  return mem.has(key) ? mem.get(key) : def;
}

export async function set(key, val) {
  mem.set(key, val);
  const db = await open();
  if (db) {
    try {
      await new Promise((res, rej) => {
        const t = db.transaction(OS, 'readwrite');
        t.objectStore(OS).put(val, key); t.oncomplete = res; t.onerror = () => rej(t.error);
      });
      return;
    } catch {}
  }
  try { localStorage.setItem('il:' + key, JSON.stringify(val)); } catch {}
}
