// IndexedDB tipis. Semua data dimuat ke memori saat start; tulisan langsung ke disk.
const NAMA = 'capit-duit', VERSI = 1;
export const STORE = ['transaksi', 'kategori', 'dompet', 'anggaran', 'berulang', 'target', 'pengaturan'];
let db;

const janji = r => new Promise((ok, gagal) => { r.onsuccess = () => ok(r.result); r.onerror = () => gagal(r.error); });
const selesai = t => new Promise((ok, gagal) => { t.oncomplete = () => ok(); t.onerror = t.onabort = () => gagal(t.error); });

export async function buka() {
  const r = indexedDB.open(NAMA, VERSI);
  r.onupgradeneeded = () => {
    const d = r.result;
    for (const s of STORE) {
      if (d.objectStoreNames.contains(s)) continue;
      const os = d.createObjectStore(s, { keyPath: 'id' });
      if (s === 'transaksi') os.createIndex('tanggal', 'tanggal');
    }
  };
  db = await janji(r);
  db.onversionchange = () => db.close();
}

export async function semua() {
  const t = db.transaction(STORE);
  const out = {};
  await Promise.all(STORE.map(async s => { out[s] = await janji(t.objectStore(s).getAll()); }));
  return out;
}

export function put(store, obj) {
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).put(obj);
  return selesai(t);
}

export function putBanyak(store, arr) {
  return putMulti({ [store]: arr });
}

// Atomik lintas store, mis. { transaksi: [...], berulang: [...] }.
export function putMulti(peta) {
  const t = db.transaction(Object.keys(peta), 'readwrite');
  for (const [s, arr] of Object.entries(peta)) for (const x of arr) t.objectStore(s).put(x);
  return selesai(t);
}

export function del(store, id) {
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).delete(id);
  return selesai(t);
}

// Atomik: semua store dikosongkan lalu diisi dalam satu transaksi; gagal = tidak ada yang berubah.
export function gantiSemua(data) {
  const t = db.transaction(STORE, 'readwrite');
  for (const s of STORE) {
    const os = t.objectStore(s);
    os.clear();
    for (const x of data[s] || []) os.put(x);
  }
  return selesai(t);
}
