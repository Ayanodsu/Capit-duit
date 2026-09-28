// Fungsi murni tanpa DOM: format, perhitungan saldo/statistik/anggaran, Clawd, streak,
// transaksi berulang, validasi impor, CSV. Diuji oleh test.mjs.

export const VERSI_SKEMA = 1;
export const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const MAKS_NOMINAL = 999_999_999_999;

// ---------- format ----------
const nf0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export const angka = n => nf0.format(Math.abs(n));
export const rp = n => (n < 0 ? '−' : '') + 'Rp ' + angka(n);

// 3.017.500 → "3,02 jt", 350.000 → "350 rb". Ambang dipilih supaya pembulatan tidak menghasilkan "1.000 rb".
export function singkat(n) {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 999_995_000) return s + nf2.format(a / 1e9) + ' M';
  if (a >= 999_950) return s + nf2.format(a / 1e6) + ' jt';
  if (a >= 1000) return s + nf1.format(a / 1e3) + ' rb';
  return s + nf0.format(a);
}

// ---------- tanggal (selalu waktu lokal, format ISO 'YYYY-MM-DD') ----------
const pad = n => String(n).padStart(2, '0');
export const isoHari = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const keDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d || 1); };
export const tambahHari = (iso, n) => { const d = keDate(iso); d.setDate(d.getDate() + n); return isoHari(d); };
export const selisihHari = (a, b) => Math.round((keDate(b) - keDate(a)) / 864e5);
export const fmtTanggal = iso => { const d = keDate(iso); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`; };
export const fmtJam = ms => { const d = new Date(ms); return `${pad(d.getHours())}.${pad(d.getMinutes())}`; };
export const namaBulan = ym => { const [y, m] = ym.split('-').map(Number); return `${BULAN[m - 1]} ${y}`; };
export const geserBulan = (ym, n) => { const [y, m] = ym.split('-').map(Number); return isoHari(new Date(y, m - 1 + n, 1)).slice(0, 7); };
export const hariDalamBulan = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const akhirBulan = ym => `${ym}-${pad(hariDalamBulan(ym))}`;

// ---------- saldo & ringkasan ----------
export function saldoDompet(transaksi, dompet) {
  const s = new Map(dompet.map(d => [d.id, d.saldoAwal]));
  const tambah = (id, n) => { if (s.has(id)) s.set(id, s.get(id) + n); };
  for (const t of transaksi) {
    if (t.tipe === 'masuk') tambah(t.dompetId, t.nominal);
    else if (t.tipe === 'keluar') tambah(t.dompetId, -t.nominal);
    else { tambah(t.dompetId, -t.nominal); tambah(t.keDompetId, t.nominal); }
  }
  return s;
}

// Transfer tidak dihitung sebagai pemasukan/pengeluaran.
export function ringkas(transaksi, awal, akhir) {
  let masuk = 0, keluar = 0;
  for (const t of transaksi) {
    if (t.tanggal < awal || t.tanggal > akhir) continue;
    if (t.tipe === 'masuk') masuk += t.nominal;
    else if (t.tipe === 'keluar') keluar += t.nominal;
  }
  return { masuk, keluar };
}

export function totalPerKategori(transaksi, awal, akhir, tipe = 'keluar') {
  const m = new Map();
  for (const t of transaksi) {
    if (t.tipe !== tipe || t.tanggal < awal || t.tanggal > akhir) continue;
    m.set(t.kategoriId, (m.get(t.kategoriId) || 0) + t.nominal);
  }
  return m;
}

// ---------- statistik ----------
// mode: 'minggu' (Senin–Minggu) | 'bulan' | 'tahun'. ref: tanggal ISO di dalam periode.
export function rentang(mode, ref) {
  if (mode === 'minggu') {
    const awal = tambahHari(ref, -((keDate(ref).getDay() + 6) % 7));
    const akhir = tambahHari(awal, 6);
    const a = keDate(awal), b = keDate(akhir);
    const label = a.getMonth() === b.getMonth()
      ? `${a.getDate()} – ${b.getDate()} ${BULAN[b.getMonth()]} ${b.getFullYear()}`
      : `${a.getDate()} ${BULAN[a.getMonth()]} – ${b.getDate()} ${BULAN[b.getMonth()]} ${b.getFullYear()}`;
    return { awal, akhir, label, sebelum: tambahHari(ref, -7), banding: 'minggu lalu' };
  }
  if (mode === 'tahun') {
    const y = ref.slice(0, 4);
    return { awal: `${y}-01-01`, akhir: `${y}-12-31`, label: y, sebelum: `${y - 1}-06-01`, banding: String(y - 1) };
  }
  const ym = ref.slice(0, 7), lalu = geserBulan(ym, -1);
  return { awal: `${ym}-01`, akhir: akhirBulan(ym), label: namaBulan(ym), sebelum: `${lalu}-01`, banding: BULAN_PANJANG[Number(lalu.slice(5)) - 1] };
}

// Batang pengeluaran: per hari (minggu/bulan) atau per bulan (tahun).
export function batang(transaksi, mode, r) {
  const perHari = new Map();
  for (const t of transaksi) {
    if (t.tipe !== 'keluar' || t.tanggal < r.awal || t.tanggal > r.akhir) continue;
    perHari.set(t.tanggal, (perHari.get(t.tanggal) || 0) + t.nominal);
  }
  if (mode === 'tahun') {
    const y = r.awal.slice(0, 4);
    return BULAN.map((label, i) => {
      const ym = `${y}-${pad(i + 1)}`;
      let nilai = 0;
      for (const [h, v] of perHari) if (h.startsWith(ym)) nilai += v;
      return { label, nilai, awal: `${ym}-01` };
    });
  }
  const out = [];
  for (let h = r.awal; h <= r.akhir; h = tambahHari(h, 1)) {
    const d = keDate(h);
    out.push({ label: mode === 'minggu' ? HARI[d.getDay()] : String(d.getDate()), nilai: perHari.get(h) || 0, awal: h });
  }
  return out;
}

// Rata-rata hanya atas batang yang sudah dimulai (hari/bulan mendatang tidak dihitung).
export function rataRata(bars, hariIni) {
  const lewat = bars.filter(b => b.awal <= hariIni);
  if (!lewat.length) return 0;
  return Math.round(lewat.reduce((s, b) => s + b.nilai, 0) / lewat.length);
}

// ---------- anggaran ----------
export function pemakaianAnggaran(transaksi, anggaran, ym) {
  const pakai = totalPerKategori(transaksi, `${ym}-01`, akhirBulan(ym));
  return anggaran.filter(a => a.bulan === ym).map(a => {
    const terpakai = pakai.get(a.kategoriId) || 0;
    return { ...a, terpakai, rasio: terpakai / a.batas };
  });
}
export const statusAnggaran = r => (r > 1 ? 'jebol' : r >= 0.8 ? 'waspada' : 'aman');
// Persen tampilan selalu konsisten dengan warna status (79,96% tidak tampil "80%" berwarna hijau).
export function persenAnggaran(r) {
  const p = Math.round(r * 100);
  if (r > 1) return Math.max(101, p);
  if (r >= 0.8) return Math.min(100, Math.max(80, p));
  return Math.min(79, p);
}

// ---------- Clawd ----------
// Diperiksa berurutan: panik → waspada → rayakan → ngantuk → senang.
// c: { anggaran:[{nama,batas,terpakai,rasio}], masuk, keluar, bulanIni, jam, adaTxHariIni,
//      masukHariIni, streak, targetTercapai (nama|null), kosong }
export function suasana(c, pilih = 0) {
  const ambil = a => a[((pilih % a.length) + a.length) % a.length];
  const ang = c.anggaran || [];
  const jebol = ang.filter(a => a.rasio > 1).sort((a, b) => (b.terpakai - b.batas) - (a.terpakai - a.batas))[0];
  if (jebol) {
    const x = rp(jebol.terpakai - jebol.batas);
    return { ekspresi: 'panik', kalimat: ambil([`${jebol.nama} jebol ${x}!`, `Aduh, ${jebol.nama} lewat ${x}!`, `${jebol.nama} bocor ${x}. Rem dulu!`]) };
  }
  // Tanpa pemasukan sama sekali (mis. awal bulan sebelum gajian) Clawd tidak panik terus-menerus.
  if (c.masuk > 0 && c.keluar > c.masuk) {
    return { ekspresi: 'panik', kalimat: ambil(['Keluar lebih besar dari masuk!', 'Gawat, pengeluaran lewat pemasukan!', 'Dompet megap-megap. Rem dulu!']) };
  }
  const was = ang.filter(a => a.rasio >= 0.8).sort((a, b) => b.rasio - a.rasio)[0];
  if (was) {
    const sisa = was.batas - was.terpakai;
    return {
      ekspresi: 'waspada',
      kalimat: ambil(sisa > 0
        ? [`${was.nama} tinggal ${rp(sisa)}.`, `Hati-hati, ${was.nama} sisa ${rp(sisa)}.`, `${was.nama} hampir habis, pelan-pelan.`]
        : [`${was.nama} sudah pas batas.`, `${was.nama} habis. Tahan dulu ya.`, `Stop dulu belanja ${was.nama}.`]),
    };
  }
  if (c.targetTercapai) return { ekspresi: 'rayakan', kalimat: ambil([`Target ${c.targetTercapai} tercapai!`, `Hore, ${c.targetTercapai} terkumpul!`, 'Target tercapai! Capitku bangga.']) };
  if (c.streak > 0 && c.streak % 7 === 0 && c.adaTxHariIni) {
    return { ekspresi: 'rayakan', kalimat: ambil([`Streak ${c.streak} hari! Capitku bangga.`, `${c.streak} hari beruntun! Hebat!`, 'Rajin banget! Capitku tepuk tangan.']) };
  }
  if (c.masukHariIni) return { ekspresi: 'rayakan', kalimat: ambil(['Asyik, ada pemasukan baru!', 'Cuan masuk! Capitku joget.', 'Pemasukan tercatat. Mantap!']) };
  if (c.kosong) return { ekspresi: 'ngantuk', kalimat: ambil(['Masih sepi. Yuk catat pertama!', 'Belum ada catatan di sini.', 'Zzz… bangunkan aku dengan catatan.']) };
  if (c.bulanIni && c.jam >= 19 && !c.adaTxHariIni) {
    return { ekspresi: 'ngantuk', kalimat: ambil(['Hari ini belum ada catatan. Ada jajan?', 'Sudah malam. Ada yang terlewat?', 'Zzz… catat dulu sebelum tidur?']) };
  }
  return { ekspresi: 'senang', kalimat: ambil(['Masih aman, lanjut!', 'Keuangan adem. Capit terus!', 'Mantap, semua terkendali.', 'Catat terus, aku jaga.']) };
}

// ---------- streak & lencana ----------
export function hitungStreak(hari, hariIni) {
  let d = hari.has(hariIni) ? hariIni : tambahHari(hariIni, -1), n = 0;
  while (hari.has(d)) { n++; d = tambahHari(d, -1); }
  return n;
}
export function streakTerpanjang(hari) {
  let best = 0;
  for (const h of hari) {
    if (hari.has(tambahHari(h, -1))) continue;
    let n = 0;
    for (let d = h; hari.has(d); d = tambahHari(d, 1)) n++;
    best = Math.max(best, n);
  }
  return best;
}
// Bulan yang sudah lewat dengan pemasukan > 0 dan pengeluaran < pemasukan.
export function adaBulanHijau(transaksi, bulanIni) {
  const m = new Map();
  for (const t of transaksi) {
    const ym = t.tanggal.slice(0, 7);
    if (ym >= bulanIni || t.tipe === 'transfer') continue;
    const x = m.get(ym) || { masuk: 0, keluar: 0 };
    x[t.tipe] += t.nominal;
    m.set(ym, x);
  }
  return [...m.values()].some(x => x.masuk > 0 && x.keluar < x.masuk);
}
export const LENCANA = [
  { id: 'pertama', ikon: '✏️', nama: 'Capit Pertama', ket: 'Mencatat transaksi pertama' },
  { id: 'streak3', ikon: '🔥', nama: 'Tiga Hari', ket: 'Mencatat 3 hari berturut-turut' },
  { id: 'streak7', ikon: '⭐', nama: 'Seminggu Penuh', ket: 'Mencatat 7 hari berturut-turut' },
  { id: 'streak30', ikon: '🏆', nama: 'Sebulan Rajin', ket: 'Mencatat 30 hari berturut-turut' },
  { id: 'streak100', ikon: '👑', nama: 'Raja Capit', ket: 'Mencatat 100 hari berturut-turut' },
  { id: 'tx100', ikon: '📒', nama: 'Pencatat Rajin', ket: '100 transaksi tercatat' },
  { id: 'anggaran', ikon: '🎯', nama: 'Perencana', ket: 'Membuat anggaran pertama' },
  { id: 'hijau', ikon: '🌱', nama: 'Bulan Hijau', ket: 'Sebulan pengeluaran di bawah pemasukan' },
  { id: 'target', ikon: '🐷', nama: 'Penabung Ulung', ket: 'Mencapai target tabungan' },
];
export function lencanaDidapat({ jumlahTx, terpanjang, adaAnggaran, bulanHijau, targetTercapai }) {
  const s = new Set();
  if (jumlahTx >= 1) s.add('pertama');
  for (const n of [3, 7, 30, 100]) if (terpanjang >= n) s.add('streak' + n);
  if (jumlahTx >= 100) s.add('tx100');
  if (adaAnggaran) s.add('anggaran');
  if (bulanHijau) s.add('hijau');
  if (targetTercapai) s.add('target');
  return s;
}

// ---------- transaksi berulang ----------
// Tanggal jatuh tempo yang belum dibuat sampai hariIni. Hari 31 di bulan pendek → hari terakhir bulan itu.
export function jatuhTempo(r, hariIni) {
  const out = [], bIni = hariIni.slice(0, 7);
  for (let m = geserBulan(r.terakhir, 1); m <= bIni && out.length < 120; m = geserBulan(m, 1)) {
    const tgl = `${m}-${pad(Math.min(r.hari, hariDalamBulan(m)))}`;
    if (tgl > hariIni) break;
    out.push(tgl);
  }
  return out;
}
// Saat aturan dilanjutkan: lewati jatuh tempo yang sudah lewat, mulai dari yang berikutnya.
export function terakhirSaatLanjut(hari, hariIni) {
  const ym = hariIni.slice(0, 7);
  return `${ym}-${pad(Math.min(hari, hariDalamBulan(ym)))}` <= hariIni ? ym : geserBulan(ym, -1);
}

// ---------- pencarian ----------
export function cocokCari(t, q) {
  q = q.trim().toLowerCase();
  if (!q) return true;
  if ((t.catatan || '').toLowerCase().includes(q)) return true;
  // Hanya dianggap nominal bila isinya angka (boleh "Rp", titik, spasi): "25.000" → 25000.
  if (/^(rp)?[\d.\s]+$/.test(q)) {
    const d = q.replace(/\D/g, '');
    return d !== '' && String(t.nominal).includes(d);
  }
  return false;
}

// ---------- CSV ----------
function sel(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah formula injection di Sheets/Excel
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function keCsv({ transaksi, kategori, dompet }) {
  const k = new Map(kategori.map(x => [x.id, x.nama]));
  const d = new Map(dompet.map(x => [x.id, x.nama]));
  const baris = [...transaksi]
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.dibuat - b.dibuat)
    .map(t => [t.tanggal, t.tipe, t.nominal, k.get(t.kategoriId) ?? '', d.get(t.dompetId) ?? '', d.get(t.keDompetId) ?? '', t.catatan].map(sel).join(','));
  return '﻿' + ['tanggal,tipe,nominal,kategori,dompet,ke_dompet,catatan', ...baris].join('\r\n') + '\r\n';
}

// ---------- validasi impor ----------
const RE_TGL = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const RE_BLN = /^\d{4}-(0[1-9]|1[0-2])$/;
const JENIS = ['tunai', 'bank', 'e-wallet', 'tabungan'];
const isStr = v => typeof v === 'string' && v.trim() !== '';
// Warna dipakai di atribut style, jadi hanya hex 6 digit yang diterima dari file impor.
const warna = (v, cadangan) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : cadangan);
const isInt = (v, min) => Number.isSafeInteger(v) && v >= min && v <= MAKS_NOMINAL;

export function validasiImpor(obj) {
  const galat = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, galat: ['Bukan file cadangan Capit Duit.'] };
  if (!Number.isInteger(obj.versiSkema) || obj.versiSkema < 1) return { ok: false, galat: ['versiSkema tidak ada atau tidak valid.'] };
  if (obj.versiSkema > VERSI_SKEMA) return { ok: false, galat: [`File dari versi aplikasi yang lebih baru (skema ${obj.versiSkema}).`] };
  for (const k of ['transaksi', 'kategori', 'dompet']) if (!Array.isArray(obj[k])) galat.push(`Bagian "${k}" tidak ada.`);
  if (galat.length) return { ok: false, galat };

  const cek = (nama, arr, fn) => {
    const ids = new Set();
    const out = [];
    arr.forEach((x, i) => {
      if (!x || typeof x !== 'object' || !isStr(x.id) || ids.has(x.id)) { galat.push(`${nama} #${i + 1}: id kosong atau ganda.`); return; }
      ids.add(x.id);
      const hasil = fn(x);
      if (typeof hasil === 'string') galat.push(`${nama} #${i + 1}: ${hasil}`);
      else out.push(hasil);
    });
    return out;
  };

  const dompet = cek('Dompet', obj.dompet, x => {
    if (!isStr(x.nama)) return 'nama kosong.';
    if (!JENIS.includes(x.jenis)) return 'jenis tidak dikenal.';
    if (!isInt(x.saldoAwal, 0)) return 'saldoAwal harus bilangan bulat ≥ 0.';
    return { id: x.id, nama: x.nama.trim(), jenis: x.jenis, saldoAwal: x.saldoAwal, warna: warna(x.warna, '#D97757'), urutan: Number(x.urutan) || 0, arsip: !!x.arsip };
  });
  const kategori = cek('Kategori', obj.kategori, x => {
    if (!isStr(x.nama)) return 'nama kosong.';
    if (x.tipe !== 'masuk' && x.tipe !== 'keluar') return 'tipe harus masuk/keluar.';
    return { id: x.id, nama: x.nama.trim(), tipe: x.tipe, warna: warna(x.warna, '#8A84A0'), ikon: isStr(x.ikon) ? x.ikon.slice(0, 8) : '📦', urutan: Number(x.urutan) || 0, arsip: !!x.arsip };
  });
  const dIds = new Set(dompet.map(d => d.id));
  const kTipe = new Map(kategori.map(k => [k.id, k.tipe]));

  // Transaksi & aturan berulang punya bentuk yang sama.
  const bentukTx = x => {
    if (!['masuk', 'keluar', 'transfer'].includes(x.tipe)) return 'tipe tidak dikenal.';
    if (!isInt(x.nominal, 1)) return 'nominal harus bilangan bulat > 0.';
    if (!dIds.has(x.dompetId)) return 'dompet tidak ditemukan.';
    if (x.tipe === 'transfer') {
      if (!dIds.has(x.keDompetId) || x.keDompetId === x.dompetId) return 'dompet tujuan transfer tidak valid.';
    } else if (kTipe.get(x.kategoriId) !== x.tipe) return 'kategori tidak ditemukan atau tipenya tidak cocok.';
    return {
      tipe: x.tipe, nominal: x.nominal, dompetId: x.dompetId,
      kategoriId: x.tipe === 'transfer' ? null : x.kategoriId,
      keDompetId: x.tipe === 'transfer' ? x.keDompetId : null,
      catatan: typeof x.catatan === 'string' ? x.catatan.slice(0, 200) : '',
    };
  };
  const transaksi = cek('Transaksi', obj.transaksi, x => {
    if (typeof x.tanggal !== 'string' || !RE_TGL.test(x.tanggal)) return 'tanggal harus YYYY-MM-DD.';
    const b = bentukTx(x);
    if (typeof b === 'string') return b;
    const t = { id: x.id, ...b, tanggal: x.tanggal, dibuat: Number.isFinite(x.dibuat) ? x.dibuat : keDate(x.tanggal).getTime() };
    if (isStr(x.berulangId)) t.berulangId = x.berulangId;
    return t;
  });
  const anggaran = cek('Anggaran', Array.isArray(obj.anggaran) ? obj.anggaran : [], x => {
    if (kTipe.get(x.kategoriId) !== 'keluar') return 'kategori tidak ditemukan.';
    if (typeof x.bulan !== 'string' || !RE_BLN.test(x.bulan)) return 'bulan harus YYYY-MM.';
    if (!isInt(x.batas, 1)) return 'batas harus bilangan bulat > 0.';
    return { id: x.id, kategoriId: x.kategoriId, bulan: x.bulan, batas: x.batas };
  });
  const berulang = cek('Transaksi berulang', Array.isArray(obj.berulang) ? obj.berulang : [], x => {
    if (!Number.isInteger(x.hari) || x.hari < 1 || x.hari > 31) return 'hari harus 1–31.';
    if (typeof x.terakhir !== 'string' || !RE_BLN.test(x.terakhir)) return 'terakhir harus YYYY-MM.';
    const b = bentukTx(x);
    if (typeof b === 'string') return b;
    return { id: x.id, ...b, hari: x.hari, terakhir: x.terakhir, aktif: x.aktif !== false };
  });
  const target = cek('Target', Array.isArray(obj.target) ? obj.target : [], x => {
    if (!isStr(x.nama)) return 'nama kosong.';
    if (!isInt(x.target, 1)) return 'target harus bilangan bulat > 0.';
    if (!isInt(x.terkumpul ?? 0, 0)) return 'terkumpul harus bilangan bulat ≥ 0.';
    const tenggat = typeof x.tenggat === 'string' && RE_TGL.test(x.tenggat) ? x.tenggat : '';
    const tercapaiPada = typeof x.tercapaiPada === 'string' && RE_TGL.test(x.tercapaiPada) ? x.tercapaiPada : null;
    return { id: x.id, nama: x.nama.trim(), target: x.target, terkumpul: x.terkumpul ?? 0, tenggat, tercapaiPada };
  });

  if (!galat.length && !dompet.some(d => !d.arsip)) galat.push('Minimal harus ada satu dompet aktif.');
  if (galat.length) return { ok: false, galat: galat.slice(0, 5).concat(galat.length > 5 ? [`…dan ${galat.length - 5} masalah lain.`] : []) };

  const p = obj.pengaturan && typeof obj.pengaturan === 'object' ? obj.pengaturan : {};
  const pengaturan = {
    tema: ['sistem', 'terang', 'gelap'].includes(p.tema) ? p.tema : 'sistem',
    animasi: p.animasi === 'hemat' ? 'hemat' : 'penuh',
    getar: p.getar !== false,
    jamPengingat: typeof p.jamPengingat === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(p.jamPengingat) ? p.jamPengingat : '',
    dompetTerakhir: dIds.has(p.dompetTerakhir) ? p.dompetTerakhir : null,
  };
  const bagian = [`${transaksi.length} transaksi`, `${kategori.length} kategori`, `${dompet.length} dompet`];
  if (anggaran.length) bagian.push(`${anggaran.length} anggaran`);
  if (berulang.length) bagian.push(`${berulang.length} transaksi berulang`);
  if (target.length) bagian.push(`${target.length} target`);
  return { ok: true, data: { transaksi, kategori, dompet, anggaran, berulang, target, pengaturan }, ringkasan: bagian.join(', ') };
}
