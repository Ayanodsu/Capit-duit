import * as db from './db.js';
import {
  VERSI_SKEMA, BULAN, MAKS_NOMINAL, LENCANA, angka, rp, singkat, isoHari, tambahHari, selisihHari, keDate, fmtTanggal, fmtJam,
  namaBulan, geserBulan, akhirBulan, saldoDompet, ringkas, totalPerKategori, rentang, batang, rataRata, pemakaianAnggaran,
  statusAnggaran, persenAnggaran, suasana, hitungStreak, streakTerpanjang, adaBulanHijau, lencanaDidapat, jatuhTempo,
  terakhirSaatLanjut, cocokCari, keCsv, validasiImpor,
} from './logic.js';

// ================= konstanta =================
const KATEGORI_AWAL = [
  ['keluar', 'Makan & Minum', '🍜', '#FFB020'], ['keluar', 'Transport', '🛵', '#3DA5FF'], ['keluar', 'Belanja', '🛍️', '#FF5FA2'],
  ['keluar', 'Tagihan', '💡', '#8B6CFF'], ['keluar', 'Hiburan', '🎬', '#00C2D1'], ['keluar', 'Kesehatan', '💊', '#12A874'],
  ['keluar', 'Pendidikan', '📚', '#D97757'], ['keluar', 'Lainnya', '📦', '#8A84A0'],
  ['masuk', 'Gaji', '💰', '#12A874'], ['masuk', 'Bonus', '🎁', '#FFB020'], ['masuk', 'Hadiah', '🎀', '#FF5FA2'], ['masuk', 'Lainnya', '📦', '#8A84A0'],
];
// Cabai (#E23B52) sengaja tidak ada: merah hanya untuk anggaran jebol.
const WARNA = ['#D97757', '#FFB020', '#3DA5FF', '#FF5FA2', '#8B6CFF', '#00C2D1', '#12A874', '#8A84A0'];
const GRADIEN = { '#FFB020': '#FF7A45', '#3DA5FF': '#8B6CFF', '#00C2D1': '#12A874', '#FF5FA2': '#8B6CFF', '#D97757': '#FF5FA2', '#8B6CFF': '#3DA5FF', '#12A874': '#00C2D1', '#8A84A0': '#231B33' };
const gradien = w => `linear-gradient(120deg, ${w}, ${GRADIEN[w] || w})`;
const IKON = ['🍜', '☕', '🍔', '🛒', '🛵', '🚌', '⛽', '🛍️', '👕', '💡', '📱', '🏠', '🎬', '🎮', '🎵', '💊', '🏥', '📚', '🎓', '📦',
  '💰', '🎁', '🎀', '💼', '📈', '🐱', '✈️', '💇', '🧾', '🎉', '❤️', '🙏'];
const JENIS = { tunai: 'Tunai', bank: 'Bank', 'e-wallet': 'E-wallet', tabungan: 'Tabungan' };
const TIPE = { keluar: 'Keluar', masuk: 'Masuk', transfer: 'Transfer' };
const TAB = ['beranda', 'statistik', 'dompet', 'anggaran'];
const SPRITE = { senang: 'clawd-happy', rayakan: 'clawd-party', ngantuk: 'clawd-sleep', waspada: 'clawd-worry', panik: 'clawd-panic', netral: 'clawd' };
const TIPS_DOMPET = ['Transfer tidak dihitung sebagai pengeluaran.', 'Saldo dihitung dari semua transaksi.', 'Dompet lama? Arsipkan saja.'];
const SET_AWAL = { id: 'app', tema: 'sistem', animasi: 'penuh', getar: true, jamPengingat: '', cadanganTerakhir: null, versiSkema: VERSI_SKEMA, dompetTerakhir: null, pinHash: null, pinSalt: null };

// ================= state =================
// ponytail: semua data di memori; nyaman sampai puluhan ribu transaksi, pindah ke query per-bulan via indeks bila lebih.
const S = { transaksi: [], kategori: [], dompet: [], anggaran: [], berulang: [], target: [], set: { ...SET_AWAL } };
const ui = { tab: 'beranda', bulan: isoHari().slice(0, 7), statMode: 'bulan', mingguRef: isoHari(), pilih: 0, intro: true, rw: { q: '', kat: '', dom: '' }, katTipe: 'keluar' };

// ================= util =================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const uid = () => crypto.randomUUID();
const mqHemat = matchMedia('(prefers-reduced-motion: reduce)');
const penuh = () => S.set.animasi !== 'hemat' && !mqHemat.matches;
const getar = pola => { if (S.set.getar) navigator.vibrate?.(pola); };
const digit = v => String(v ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
const nilaiRp = sel => Number(digit($(sel)?.value)) || 0;
const bulanIni = () => isoHari().slice(0, 7);
const tglPanjang = iso => { const d = keDate(iso); return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
const byId = (wadah, id) => wadah?.querySelector(`[data-id="${CSS.escape(id)}"]`);

const kat = id => S.kategori.find(k => k.id === id);
const dom = id => S.dompet.find(d => d.id === id);
const urut = arr => [...arr].sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama, 'id'));
const dompetAktif = () => urut(S.dompet.filter(d => !d.arsip));
const kategoriTipe = (tipe, ikut) => urut(S.kategori.filter(k => k.tipe === tipe && (!k.arsip || k.id === ikut)));
const urutTx = arr => arr.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.dibuat - a.dibuat);
const txBulan = ym => S.transaksi.filter(t => t.tanggal.startsWith(ym));
const saldo = () => saldoDompet(S.transaksi, S.dompet);
const totalSaldo = () => { const s = saldo(); return dompetAktif().reduce((n, d) => n + s.get(d.id), 0); };
const urutanBaru = arr => arr.reduce((m, x) => Math.max(m, x.urutan), -1) + 1;
const kategoriDipakai = id => S.transaksi.some(t => t.kategoriId === id) || S.berulang.some(r => r.kategoriId === id);
const dompetDipakai = id => S.transaksi.some(t => t.dompetId === id || t.keDompetId === id) || S.berulang.some(r => r.dompetId === id || r.keDompetId === id);

async function simpan(store, obj) {
  await db.put(store, obj);
  const a = S[store], i = a.findIndex(x => x.id === obj.id);
  if (i < 0) a.push(obj); else a[i] = obj;
}
async function buang(store, id) {
  await db.del(store, id);
  S[store] = S[store].filter(x => x.id !== id);
}
async function simpanSet(patch) {
  const baru = { ...S.set, ...patch };
  await db.put('pengaturan', baru);
  S.set = baru;
}

// ================= kebiasaan & Clawd =================
const dibuatHari = t => isoHari(new Date(t.dibuat));
// Transaksi dari aturan berulang dibuat otomatis, jadi tidak dihitung sebagai "mencatat".
const hariCatat = () => new Set(S.transaksi.filter(t => !t.berulangId).map(dibuatHari));
const streakSekarang = () => hitungStreak(hariCatat(), isoHari());
const adaCatatanHariIni = () => { const hi = isoHari(); return S.transaksi.some(t => !t.berulangId && (t.tanggal === hi || dibuatHari(t) === hi)); };

function lencanaSekarang() {
  return lencanaDidapat({
    jumlahTx: S.transaksi.length,
    terpanjang: streakTerpanjang(hariCatat()),
    adaAnggaran: S.anggaran.length > 0,
    bulanHijau: adaBulanHijau(S.transaksi, bulanIni()),
    targetTercapai: S.target.some(t => t.terkumpul >= t.target),
  });
}

const anggaranBulan = ym => pemakaianAnggaran(S.transaksi, S.anggaran, ym).map(a => ({ ...a, nama: kat(a.kategoriId)?.nama ?? '?' }));

function moodBeranda() {
  const hi = isoHari(), ini = ui.bulan === bulanIni();
  const { masuk, keluar } = ringkas(S.transaksi, `${ui.bulan}-01`, akhirBulan(ui.bulan));
  const tercapai = S.target.find(t => t.tercapaiPada && t.terkumpul >= t.target && selisihHari(t.tercapaiPada, hi) <= 3);
  return suasana({
    anggaran: anggaranBulan(ui.bulan), masuk, keluar, bulanIni: ini, jam: new Date().getHours(),
    adaTxHariIni: ini && adaCatatanHariIni(),
    masukHariIni: ini && S.transaksi.some(t => t.tipe === 'masuk' && dibuatHari(t) === hi),
    streak: ini ? streakSekarang() : 0,
    targetTercapai: ini ? tercapai?.nama ?? null : null,
    kosong: !txBulan(ui.bulan).length,
  }, ui.pilih);
}
const moodAnggaran = () => suasana({ anggaran: anggaranBulan(ui.bulan) }, ui.pilih);

// Dipanggil sebelum & sesudah aksi; bila ada lencana baru atau streak kelipatan 7 → konfeti. Mengembalikan teks tambahan untuk toast.
function potretRayakan() { return { lencana: lencanaSekarang(), streak: streakSekarang() }; }
function cekRayakan(sebelum) {
  const baru = [...lencanaSekarang()].filter(id => !sebelum.lencana.has(id)).map(id => LENCANA.find(l => l.id === id));
  const s = streakSekarang();
  const streakBaru = s !== sebelum.streak && s > 0 && s % 7 === 0;
  if (!baru.length && !streakBaru) return '';
  konfeti($('.screen:not([hidden]) .peek svg, .screen:not([hidden]) .gelembung svg'));
  if (baru.length) return ` · Lencana baru: ${baru[0].ikon} ${baru[0].nama}!`;
  return ` · Streak ${s} hari!`;
}

// ================= komponen =================
const clawd = (ek, cls = '') => `<svg class="clawd ${cls}" viewBox="0 -4 24 21" aria-hidden="true"><use href="#${SPRITE[ek]}"/></svg>`;
const btnTutup = '<button class="ikon-btn" data-act="tutup" aria-label="Tutup">✕</button>';
const btnKembali = '<button class="ikon-btn" data-act="tutup" aria-label="Kembali">←</button>';
const ikonKat = k => `<span class="ic" style="--c:${k?.warna || '#8A84A0'}" aria-hidden="true">${esc(k?.ikon || '📦')}</span>`;
const navBulan = () => `<div class="navbulan">
  <button class="ikon-btn" data-act="bulan-geser" data-v="-1" aria-label="Bulan sebelumnya">‹</button>
  <button class="chip" data-act="pilih-bulan" aria-label="Pilih bulan">${namaBulan(ui.bulan)} ▾</button>
  <button class="ikon-btn" data-act="bulan-geser" data-v="1" aria-label="Bulan berikutnya">›</button></div>`;
const kosong = pesan => `<div class="kosong">${clawd('ngantuk', 'besar')}<p>${esc(pesan)}</p><button class="btn utama" data-act="catat">Catat transaksi pertama</button></div>`;
const seg = (act, pilihan, aktif, extra = '') => `<div class="seg" role="group">${Object.entries(pilihan).map(([v, l]) =>
  `<button data-act="${act}" data-v="${v}" aria-pressed="${v === aktif}" ${extra}>${l}</button>`).join('')}</div>`;

function waktuRelatif(t) {
  const hi = isoHari();
  if (t.tanggal === hi) return fmtJam(t.dibuat);
  if (t.tanggal === tambahHari(hi, -1)) return 'Kemarin';
  return fmtTanggal(t.tanggal);
}

function barisTx(t, waktu) {
  const d = dom(t.dompetId);
  if (t.tipe === 'transfer') {
    return `<li><button class="tx" data-act="ubah-tx" data-id="${esc(t.id)}"><span class="ic" style="--c:#8B6CFF" aria-hidden="true">⇄</span>
      <span class="tx-main"><b>${esc(t.catatan || 'Transfer')}</b><small>${esc(d?.nama)} → ${esc(dom(t.keDompetId)?.nama)} · ${waktu}</small></span>
      <em class="nom">${angka(t.nominal)}</em></button></li>`;
  }
  const k = kat(t.kategoriId);
  const sub = [t.catatan ? k?.nama : null, S.dompet.length > 1 ? d?.nama : null].filter(Boolean).map(esc).concat(waktu).join(' · ');
  const masuk = t.tipe === 'masuk';
  return `<li><button class="tx" data-act="ubah-tx" data-id="${esc(t.id)}">${ikonKat(k)}
    <span class="tx-main"><b>${esc(t.catatan || k?.nama)}</b><small>${sub}${t.berulangId ? ' · 🔁' : ''}</small></span>
    <em class="nom ${masuk ? 'in' : 'out'}">${masuk ? '+' : '−'}${angka(t.nominal)}</em></button></li>`;
}

function grupPerHari(txs) {
  const grup = new Map();
  for (const t of txs) (grup.get(t.tanggal) || grup.set(t.tanggal, []).get(t.tanggal)).push(t);
  return [...grup].map(([tgl, arr]) => {
    const net = arr.reduce((n, t) => n + (t.tipe === 'masuk' ? t.nominal : t.tipe === 'keluar' ? -t.nominal : 0), 0);
    return `<div class="hari-head"><span>${fmtTanggal(tgl)}</span><span class="${net > 0 ? 'in' : ''}">${net > 0 ? '+' : net < 0 ? '−' : ''}${angka(net)}</span></div>
      <ul class="daftar-tx">${arr.map(t => barisTx(t, fmtJam(t.dibuat))).join('')}</ul>`;
  }).join('');
}

// ================= layar =================
function perluCadangan() {
  if (!S.transaksi.length) return '';
  const hi = isoHari(), akhir = S.set.cadanganTerakhir;
  if (hi.endsWith('-01') && akhir !== hi) return 'Tanggal 1! Yuk cadangkan data.';
  const acuan = akhir || isoHari(new Date(S.transaksi.reduce((m, t) => Math.min(m, t.dibuat), Infinity)));
  return selisihHari(acuan, hi) > 30 ? 'Sudah sebulan belum dicadangkan.' : '';
}

function renderBeranda() {
  const el = $('#s-beranda');
  const { masuk, keluar } = ringkas(S.transaksi, `${ui.bulan}-01`, akhirBulan(ui.bulan));
  const daftar = urutTx(txBulan(ui.bulan)).slice(0, 10);
  const m = moodBeranda();
  const bln = BULAN[Number(ui.bulan.slice(5)) - 1];
  const cadang = perluCadangan();
  el.innerHTML = `
    <header class="top">
      <h1>Halo!</h1>
      <button class="chip streak" data-act="lencana" aria-label="Streak ${streakSekarang()} hari, lihat lencana">🔥 ${streakSekarang()}</button>
      <span class="spasi"></span>
      <button class="chip" data-act="pilih-bulan" aria-label="Pilih bulan">${namaBulan(ui.bulan)} ▾</button>
      <button class="ikon-btn" data-act="pengaturan" aria-label="Pengaturan">⚙️</button>
    </header>
    <div class="kartu-saldo">
      <button class="peek" data-act="clawd" aria-label="Ketuk Clawd">${clawd(m.ekspresi)}</button>
      <small>Total saldo · ${dompetAktif().length} dompet</small>
      <div class="besar num" id="saldo-total">${rp(totalSaldo())}</div>
      <div class="dua">
        <span>↑ Masuk ${bln}<b class="num">${rp(masuk)}</b></span>
        <span>↓ Keluar ${bln}<b class="num">${rp(keluar)}</b></span>
      </div>
    </div>
    <button class="gelembung ${m.ekspresi}" data-act="clawd">${clawd(m.ekspresi)}<span>${esc(m.kalimat)}</span></button>
    ${cadang ? `<button class="banner" data-act="ekspor-json">💾 ${cadang} <b>Cadangkan</b></button>` : ''}
    <div class="judul-daftar"><h2>Transaksi terakhir</h2><button class="teks" data-act="riwayat">Lihat semua</button></div>
    ${daftar.length ? `<ul class="daftar-tx">${daftar.map(t => barisTx(t, waktuRelatif(t))).join('')}</ul>` : kosong(`${namaBulan(ui.bulan)} belum ada catatan.`)}`;
  if (ui.intro) { ui.intro = false; el.classList.add('intro'); setTimeout(() => el.classList.remove('intro'), 900); }
}

function renderStatistik() {
  const el = $('#s-statistik');
  const r = rentang(ui.statMode, ui.statMode === 'minggu' ? ui.mingguRef : `${ui.bulan}-01`);
  const lalu = rentang(ui.statMode, r.sebelum);
  const per = totalPerKategori(S.transaksi, r.awal, r.akhir);
  const total = [...per.values()].reduce((a, b) => a + b, 0);
  const totalLalu = ringkas(S.transaksi, lalu.awal, lalu.akhir).keluar;
  const adaTx = S.transaksi.some(t => t.tanggal >= r.awal && t.tanggal <= r.akhir);
  const nav = ui.statMode === 'bulan' ? navBulan() : `<div class="navbulan">
    <button class="ikon-btn" data-act="periode-geser" data-v="-1" aria-label="Sebelumnya">‹</button><span class="chip">${r.label}</span>
    <button class="ikon-btn" data-act="periode-geser" data-v="1" aria-label="Berikutnya">›</button></div>`;
  let isi;
  if (!adaTx) isi = kosong('Belum ada transaksi di periode ini.');
  else {
    const baris = [...per].map(([id, v]) => ({ k: kat(id), v })).sort((a, b) => b.v - a.v);
    let acc = 0;
    const stops = baris.map(b => { const a = acc; acc += (b.v / total) * 100; return `${b.k?.warna || '#8A84A0'} ${a}% ${acc}%`; }).join(',');
    let banding = '';
    if (totalLalu > 0) {
      const d = Math.round(((total - totalLalu) / totalLalu) * 100);
      banding = d < 0 ? `<p class="banding in">↓ ${-d}% dari ${r.banding}</p>` : d > 0 ? `<p class="banding out">↑ ${d}% dari ${r.banding}</p>` : `<p class="banding">Sama dengan ${r.banding}</p>`;
    } else banding = `<p class="banding">Belum ada pengeluaran ${r.banding.startsWith('minggu') ? '' : 'di '}${r.banding} untuk dibandingkan.</p>`;
    const bars = batang(S.transaksi, ui.statMode, r);
    const maks = Math.max(0, ...bars.map(b => b.nilai));
    const iMaks = maks > 0 ? bars.findIndex(b => b.nilai === maks) : -1;
    const jeda = Math.min(40, 400 / bars.length);
    const labelTampil = i => bars.length <= 12 || i === 0 || (i + 1) % 5 === 0;
    isi = `
      ${banding}
      <div class="donut-wrap">
        <div class="donut" style="background:${total ? `conic-gradient(${stops})` : 'var(--garis)'}"></div>
        <div class="donut-tengah"><b class="num">Rp ${singkat(total)}</b><span>keluar</span></div>
      </div>
      ${baris.length ? `<ul class="legenda num">${baris.map(b => `<li><i style="background:${b.k?.warna || '#8A84A0'}"></i>
        <span>${esc(b.k?.ikon)} ${esc(b.k?.nama)}</span><span>${angka(b.v)}</span><em>${Math.round((b.v / total) * 100)}%</em></li>`).join('')}</ul>`
        : '<p class="muted tengah">Belum ada pengeluaran di periode ini.</p>'}
      <div class="kartu batang-kartu">
        <div class="judul-daftar"><h2>${ui.statMode === 'tahun' ? 'Per bulan' : 'Per hari'}</h2><span class="muted">rata-rata ${singkat(rataRata(bars, isoHari()))}</span></div>
        <div class="bars" style="--n:${bars.length}">${bars.map((b, i) => `<div class="bar${i === iMaks ? ' hi' : ''}" title="${esc(b.label)}: ${rp(b.nilai)}" style="--h:${maks ? (b.nilai / maks) * 100 : 0}%">
          ${i === iMaks ? `<span class="puncak">${singkat(b.nilai)}</span>` : ''}
          <i style="--d:${Math.round(i * jeda)}ms"></i></div>`).join('')}</div>
        <div class="bars-lbl" style="--n:${bars.length}">${bars.map((b, i) => `<span>${labelTampil(i) ? b.label : ''}</span>`).join('')}</div>
      </div>`;
  }
  el.innerHTML = `<header class="top"><h1>Statistik</h1></header>
    ${seg('stat-mode', { minggu: 'Minggu', bulan: 'Bulan', tahun: 'Tahun' }, ui.statMode)}
    ${nav}${isi}`;
}

function kartuTarget(t) {
  const r = Math.min(1, t.terkumpul / t.target), sisa = t.target - t.terkumpul;
  let ket = `Sisa ${rp(sisa)}`;
  if (sisa <= 0) ket = 'Tercapai! 🎉';
  else if (t.tenggat) {
    const hari = selisihHari(isoHari(), t.tenggat);
    if (hari < 0) ket = `Lewat tenggat · sisa ${rp(sisa)}`;
    else {
      const perBulan = Math.ceil(sisa / Math.max(1, Math.round(hari / 30.44)) / 1000) * 1000;
      ket = `Sisa ${rp(sisa)} · ±${rp(perBulan)}/bulan`;
    }
  }
  return `<button class="kartu item" data-act="ubah-target" data-id="${esc(t.id)}">
    <div class="atas"><b>🐷 ${esc(t.nama)}</b><span class="${sisa <= 0 ? 'in' : ''}">${Math.floor(r * 100)}%</span></div>
    <div class="track"><i style="--w:${r * 100}%;background:var(--daun)"></i></div>
    <small class="num">${rp(t.terkumpul)} / ${rp(t.target)}${t.tenggat ? ` · sampai ${tglPanjang(t.tenggat)}` : ''}</small>
    <small>${ket}</small></button>`;
}

function renderDompet() {
  const el = $('#s-dompet'), s = saldo(), aktif = dompetAktif(), arsip = urut(S.dompet.filter(d => d.arsip));
  const kartu = d => `<button class="kartu-dompet${d.arsip ? ' arsip' : ''}" data-act="ubah-dompet" data-id="${esc(d.id)}" style="background:${gradien(d.warna)}">
    <span><small>${JENIS[d.jenis]}</small><b>${esc(d.nama)}</b></span><em class="num">${rp(s.get(d.id))}</em></button>`;
  el.innerHTML = `<header class="top"><h1>Dompet</h1><span class="spasi"></span><button class="chip" data-act="dompet-baru">+ Tambah</button></header>
    <div class="kartu-gelap"><small>Total saldo</small><b class="num">${rp(totalSaldo())}</b></div>
    <div class="tumpuk">${aktif.map(kartu).join('')}</div>
    ${aktif.length > 1 ? '<button class="btn garis lebar" data-act="transfer">⇄ Transfer antar dompet</button>'
      : '<p class="muted tengah">Tambah dompet kedua untuk bisa transfer.</p>'}
    <button class="gelembung" data-act="clawd">${clawd('netral')}<span>${TIPS_DOMPET[ui.pilih % TIPS_DOMPET.length]}</span></button>
    ${arsip.length ? `<details class="arsip-list"><summary>Diarsipkan (${arsip.length})</summary><div class="tumpuk">${arsip.map(kartu).join('')}</div></details>` : ''}
    <div class="judul-daftar"><h2>Target tabungan</h2><button class="teks" data-act="target-baru">+ Target</button></div>
    ${S.target.length ? `<div class="tumpuk">${S.target.map(kartuTarget).join('')}</div>`
      : '<p class="muted">Punya impian? Misalnya “HP baru Rp 4.000.000”. Buat target dan pantau kemajuannya.</p>'}`;
}

function renderAnggaran() {
  const el = $('#s-anggaran');
  const urutKat = new Map(urut(S.kategori).map((k, i) => [k.id, i]));
  const pakai = anggaranBulan(ui.bulan).sort((a, b) => urutKat.get(a.kategoriId) - urutKat.get(b.kategoriId));
  const tanpa = kategoriTipe('keluar').filter(k => !pakai.some(a => a.kategoriId === k.id));
  const totalBatas = pakai.reduce((n, a) => n + a.batas, 0), totalPakai = pakai.reduce((n, a) => n + a.terpakai, 0);
  const bisaSalin = !pakai.length && S.anggaran.some(a => a.bulan === geserBulan(ui.bulan, -1));
  const m = moodAnggaran();
  const baris = a => {
    const st = statusAnggaran(a.rasio), k = kat(a.kategoriId), sisa = a.batas - a.terpakai;
    return `<button class="kartu item" data-act="ubah-anggaran" data-id="${esc(a.kategoriId)}">
      <div class="atas"><span>${esc(k?.ikon)} ${esc(k?.nama)}</span><span class="st-${st}">${persenAnggaran(a.rasio)}%</span></div>
      <div class="track${st === 'jebol' ? ' jebol' : ''}"><i class="bg-${st}" style="--w:${Math.min(100, a.rasio * 100)}%"></i></div>
      <small class="num">${angka(a.terpakai)} / ${angka(a.batas)} · ${sisa >= 0 ? `sisa ${angka(sisa)}` : `jebol ${angka(-sisa)}`}</small></button>`;
  };
  el.innerHTML = `<header class="top"><h1>Anggaran</h1></header>${navBulan()}
    <div class="kartu-gelap"><small>Terpakai bulan ini</small>
      <b class="num">${rp(totalPakai)} <span class="redup">/ ${angka(totalBatas)}</span></b>
      <div class="track"><i style="--w:${totalBatas ? Math.min(100, (totalPakai / totalBatas) * 100) : 0}%;background:linear-gradient(90deg,var(--madu),var(--permen))"></i></div></div>
    ${pakai.length ? `<button class="gelembung ${m.ekspresi}" data-act="clawd">${clawd(m.ekspresi)}<span>${esc(m.kalimat)}</span></button>` : ''}
    ${bisaSalin ? '<button class="btn garis lebar" data-act="salin-anggaran">📋 Salin anggaran bulan lalu</button>' : ''}
    ${pakai.length ? `<div class="tumpuk">${pakai.map(baris).join('')}</div>`
      : `<div class="kosong">${clawd('netral', 'besar')}<p>Belum ada anggaran untuk ${namaBulan(ui.bulan)}. Pilih kategori di bawah untuk memberi batas.</p></div>`}
    ${tanpa.length ? `<h2 class="sub">Tanpa anggaran</h2><div class="chips">${tanpa.map(k =>
      `<button class="chip" data-act="ubah-anggaran" data-id="${esc(k.id)}">${esc(k.ikon)} ${esc(k.nama)} +</button>`).join('')}</div>` : ''}`;
}

const RENDER = { beranda: renderBeranda, statistik: renderStatistik, dompet: renderDompet, anggaran: renderAnggaran };
function refresh() {
  RENDER[ui.tab]();
  for (const l of layers) l.render?.();
}

function tampilkanTab() {
  for (const t of TAB) $(`#s-${t}`).hidden = t !== ui.tab;
  for (const b of $$('#tabbar [data-act="tab"]')) {
    if (b.dataset.v === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  RENDER[ui.tab]();
  scrollTo(0, 0);
}
function keTab(tab) {
  if (tab === ui.tab || !TAB.includes(tab)) return;
  const maju = TAB.indexOf(tab) > TAB.indexOf(ui.tab);
  const ganti = () => { ui.tab = tab; tampilkanTab(); };
  if (penuh() && document.startViewTransition) {
    document.documentElement.dataset.arah = maju ? 'maju' : 'mundur';
    document.startViewTransition(ganti);
  } else ganti();
}

// ================= layer (sheet & halaman) + tombol kembali Android =================
const layers = [];
let tungguPop = [];
function bukaLayer(html, jenis = 'sheet', opsi = {}) {
  const el = document.createElement('div');
  el.className = `layer ${jenis}`;
  el.innerHTML = (jenis === 'sheet' ? '<div class="backdrop" data-act="tutup"></div>' : '') +
    `<div class="panel" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
  Object.assign(el, opsi);
  $('#layers').append(el);
  layers.push(el);
  history.pushState({ n: layers.length }, '');
  el.getBoundingClientRect(); // paksa layout supaya transisi masuk berjalan
  el.classList.add('buka');
  $('.panel', el).focus({ preventScroll: true });
  return el;
}
function tutupLayer() {
  if (!layers.length) return Promise.resolve();
  return new Promise(ok => { tungguPop.push(ok); history.back(); });
}
function lepasLayer(el) {
  el.onTutup?.();
  el.classList.remove('buka');
  setTimeout(() => el.remove(), 320);
}
addEventListener('popstate', e => {
  const n = e.state?.n ?? 0;
  while (layers.length > n) lepasLayer(layers.pop());
  tungguPop.splice(0).forEach(f => f());
});
const layerAtas = () => layers[layers.length - 1];

// ================= toast =================
let toastTimer, aksiUrungkan = null;
function toast(pesan, urungkan = null) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(pesan)}</span>${urungkan ? '<button data-act="urungkan">Urungkan</button>' : ''}`;
  aksiUrungkan = urungkan;
  t.classList.remove('muncul');
  t.getBoundingClientRect();
  t.classList.add('muncul');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('muncul'); aksiUrungkan = null; }, urungkan ? 5000 : 2200);
}

// ================= motion =================
function lompat(el) {
  if (!el || !penuh()) return;
  el.style.transformOrigin = '50% 100%';
  el.animate([
    { transform: 'none' },
    { transform: 'translateY(2px) scale(1.12,.85)', offset: 0.18 },
    { transform: 'translateY(-14px) scale(.94,1.08)', offset: 0.5 },
    { transform: 'translateY(0) scale(1.08,.92)', offset: 0.82 },
    { transform: 'none' },
  ], { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

function koinTerbang(dari, ke) {
  if (!penuh() || !dari || !ke) return;
  const a = dari.getBoundingClientRect(), b = ke.getBoundingClientRect();
  const x0 = a.left + a.width * 0.7, y0 = a.top + a.height * 0.4, x1 = b.right - 48, y1 = b.top + b.height / 2;
  const cy = Math.min(y0, y1) - 90;
  const koin = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  koin.setAttribute('viewBox', '0 0 8 8');
  koin.setAttribute('class', 'koin');
  koin.innerHTML = '<use href="#coin"/>';
  $('#fx').append(koin);
  const frames = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, u = 1 - t; // kurva kuadratik melengkung ke atas
    const x = x0 + (x1 - x0) * t, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    frames.push({ transform: `translate(${x - 11}px,${y - 11}px) scale(${1 + Math.sin(t * Math.PI) * 0.3})`, opacity: t > 0.9 ? 0 : 1 });
  }
  koin.animate(frames, { duration: 700, easing: 'ease-in-out' }).onfinish = () => koin.remove();
}

function gulirAngka(el, dari, ke) {
  if (!el) return;
  if (!penuh() || dari === ke) { el.textContent = rp(ke); return; }
  const t0 = performance.now();
  const langkah = now => {
    const p = Math.min(1, (now - t0) / 700), e = 1 - (1 - p) ** 3;
    el.textContent = rp(Math.round(dari + (ke - dari) * e));
    if (p < 1) requestAnimationFrame(langkah);
  };
  requestAnimationFrame(langkah);
}

function konfeti(dari) {
  if (!penuh()) return;
  const r = dari?.getBoundingClientRect() ?? { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0 };
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('i');
    p.className = 'konfeti';
    p.style.background = WARNA[i % 7];
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    $('#fx').append(p);
    const sudut = (-160 + Math.random() * 140) * (Math.PI / 180), v = 70 + Math.random() * 110;
    const dx = Math.cos(sudut) * v, dy = Math.sin(sudut) * v, rot = (Math.random() - 0.5) * 720;
    p.animate([
      { transform: 'translate(0,0)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${dx * 1.4}px,${dy + 260 + Math.random() * 120}px) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 1100, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => p.remove();
  }
}

function keluarBaris(li) {
  if (!li) return Promise.resolve();
  const h = li.offsetHeight;
  const frames = penuh()
    ? [{ transform: 'none', opacity: 1, height: `${h}px` }, { transform: 'translateX(-60%)', opacity: 0, height: `${h}px`, offset: 0.6 }, { transform: 'translateX(-60%)', opacity: 0, height: '0px' }]
    : [{ opacity: 1 }, { opacity: 0 }];
  const durasi = penuh() ? 250 : 150;
  li.style.overflow = 'hidden';
  li.animate(frames, { duration: durasi, easing: 'ease-in', fill: 'forwards' });
  // Timer, bukan animation.finished: animasi bisa dijeda browser (tab di latar) dan tidak boleh menahan alur.
  return new Promise(r => setTimeout(r, durasi));
}

function wadahAktif() {
  const atas = layerAtas();
  return atas?.classList.contains('page') ? atas : $(`#s-${ui.tab}`);
}
function sorot(id) {
  byId(wadahAktif(), id)?.closest('li')?.classList.add('baru');
}

// ================= Catat =================
let form = null;
function dompetDefault() {
  const d = dom(S.set.dompetTerakhir);
  return d && !d.arsip ? d.id : dompetAktif()[0]?.id ?? null;
}
function bukaCatat(tx = null, preset = {}) {
  form = tx
    ? { id: tx.id, tipe: tx.tipe, digit: String(tx.nominal), kategoriId: tx.kategoriId, dompetId: tx.dompetId, keDompetId: tx.keDompetId, tanggal: tx.tanggal, catatan: tx.catatan || '', ulangi: false, asli: tx }
    : { tipe: 'keluar', digit: '', kategoriId: null, dompetId: dompetDefault(), keDompetId: null, tanggal: isoHari(), catatan: '', ulangi: false, ...preset };
  aturTujuanTransfer();
  $('#fab').classList.add('buka');
  const el = bukaLayer('<div class="catat"></div>', 'sheet', { onTutup: () => { form = null; $('#fab').classList.remove('buka'); } });
  el.classList.add('sheet-catat');
  form.el = el;
  renderCatat();
}
function aturTujuanTransfer() {
  if (form.tipe !== 'transfer') return;
  if (!form.keDompetId || form.keDompetId === form.dompetId) form.keDompetId = dompetAktif().find(d => d.id !== form.dompetId)?.id ?? null;
}
const opsiDompet = (pilih, saldoMap) => {
  const daftar = dompetAktif();
  const d = dom(pilih);
  if (d?.arsip) daftar.push(d);
  return daftar.map(x => `<option value="${esc(x.id)}" ${x.id === pilih ? 'selected' : ''}>${esc(x.nama)} · ${saldoMap.get(x.id) < 0 ? '−' : ''}${angka(saldoMap.get(x.id))}</option>`).join('');
};

function renderCatat() {
  const f = form, s = saldo();
  const tengah = f.tipe === 'transfer'
    ? `<div class="transfer">
        <label class="field"><span>Dari</span><select data-f="dompetId">${opsiDompet(f.dompetId, s)}</select></label>
        <button class="ikon-btn" data-act="tukar" aria-label="Tukar asal dan tujuan">⇄</button>
        <label class="field"><span>Ke</span><select data-f="keDompetId">${opsiDompet(f.keDompetId, s)}</select></label>
      </div><p class="hint" id="hint-transfer"></p>`
    : `<div class="grid-kat">${kategoriTipe(f.tipe, f.kategoriId).map(k =>
        `<button class="kat" data-act="kat-pilih" data-id="${esc(k.id)}" aria-pressed="${k.id === f.kategoriId}">${ikonKat(k)}<span>${esc(k.nama)}</span></button>`).join('')}</div>`;
  $('.catat', f.el).innerHTML = `
    <div class="sheet-head"><h2>${f.id ? 'Ubah transaksi' : 'Catat'}</h2>
      ${f.tipe !== 'transfer' ? '<button class="teks" data-act="kat-baru">+ Kategori</button>' : ''}
      ${f.id ? '<button class="teks bahaya" data-act="hapus-tx">Hapus</button>' : ''}${btnTutup}</div>
    ${seg('tipe', TIPE, f.tipe)}
    <output class="nominal num" id="nominal" aria-live="polite"></output>
    ${tengah}
    <div class="fields">
      ${f.tipe !== 'transfer' ? `<label class="field"><span aria-hidden="true">👛</span><select data-f="dompetId" aria-label="Dompet">${opsiDompet(f.dompetId, s)}</select></label>` : ''}
      <label class="field"><span aria-hidden="true">📅</span><input type="date" data-f="tanggal" value="${f.tanggal}" aria-label="Tanggal" required></label>
    </div>
    <div class="fields">
      <label class="field lebar"><span aria-hidden="true">✏️</span><input data-f="catatan" value="${esc(f.catatan)}" placeholder="Catatan (opsional)" maxlength="80" enterkeyhint="done" autocomplete="off" aria-label="Catatan"></label>
      ${f.id ? '' : `<label class="field cek"><input type="checkbox" data-f="ulangi" ${f.ulangi ? 'checked' : ''}><span>🔁 Tiap bulan</span></label>`}
    </div>
    <div class="keypad num">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'].map(k =>
      `<button data-act="key" data-v="${k}" class="${k === '000' ? 'k000' : ''}">${k}</button>`).join('')}
      <button data-act="key" data-v="del" aria-label="Hapus angka">⌫</button></div>
    <button class="btn utama lebar simpan" data-act="simpan-tx">${f.id ? 'Simpan perubahan' : 'Simpan'}</button>`;
  perbaruiNominal(false);
}
function bisaSimpan() {
  const f = form;
  if (!f || !(Number(f.digit) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(f.tanggal) || !dom(f.dompetId)) return false;
  if (f.tipe === 'transfer') return !!dom(f.keDompetId) && f.keDompetId !== f.dompetId;
  return kat(f.kategoriId)?.tipe === f.tipe;
}
function perbaruiNominal(pop) {
  const out = $('#nominal', form.el);
  const n = Number(form.digit || 0);
  out.textContent = rp(n);
  out.classList.toggle('kecil', form.digit.length > 9);
  if (pop && penuh()) out.animate([{ transform: 'scale(1.08)' }, { transform: 'none' }], { duration: 120, easing: 'ease-out' });
  $('.simpan', form.el).disabled = !bisaSimpan();
  const hint = $('#hint-transfer', form.el);
  if (hint) hint.textContent = form.dompetId === form.keDompetId ? 'Dompet asal dan tujuan tidak boleh sama.' : '';
}
function ketik(k) {
  let d = form.digit;
  if (k === 'del') d = d.slice(0, -1);
  else {
    d = (d + k).replace(/^0+/, '');
    if (d.length > 12) { getar([20, 30, 20]); return; }
  }
  form.digit = d;
  getar(10);
  perbaruiNominal(true);
}

async function simpanTx() {
  if (!bisaSimpan()) return;
  const f = form, lama = f.asli;
  const tx = {
    id: f.id || uid(), tipe: f.tipe, nominal: Number(f.digit),
    kategoriId: f.tipe === 'transfer' ? null : f.kategoriId, dompetId: f.dompetId,
    keDompetId: f.tipe === 'transfer' ? f.keDompetId : null,
    tanggal: f.tanggal, catatan: f.catatan.trim(), dibuat: lama?.dibuat ?? Date.now(),
  };
  if (lama?.berulangId) tx.berulangId = lama.berulangId;
  const sebelum = potretRayakan(), saldoLama = totalSaldo();
  let aturan = null;
  if (!lama && f.ulangi) {
    aturan = { id: uid(), tipe: tx.tipe, nominal: tx.nominal, kategoriId: tx.kategoriId, dompetId: tx.dompetId, keDompetId: tx.keDompetId,
      catatan: tx.catatan, hari: Number(tx.tanggal.slice(8)), terakhir: tx.tanggal.slice(0, 7), aktif: true };
    tx.berulangId = aturan.id;
    await db.putMulti({ transaksi: [tx], berulang: [aturan] });
    S.transaksi.push(tx);
    S.berulang.push(aturan);
  } else await simpan('transaksi', tx);
  if (S.set.dompetTerakhir !== tx.dompetId) await simpanSet({ dompetTerakhir: tx.dompetId });
  const susulan = aturan ? await jalankanBerulang(true) : 0; // tanggal lampau: jatuh tempo yang terlewat langsung dibuat
  await tutupLayer();
  if (!lama) ui.bulan = tx.tanggal.slice(0, 7); // tampilkan bulan transaksi yang baru dicatat
  refresh();
  const ekstra = cekRayakan(sebelum);
  reaksiSimpan(tx, saldoLama);
  const pesan = lama ? 'Diperbarui' : aturan ? `Tersimpan, diulang tiap bulan${susulan ? ` (+${susulan} jatuh tempo)` : ''}` : 'Tersimpan';
  toast(pesan + ekstra, async () => {
    if (lama) await simpan('transaksi', lama);
    else if (!aturan) await buang('transaksi', tx.id);
    if (aturan) {
      for (const t of S.transaksi.filter(x => x.berulangId === aturan.id)) await buang('transaksi', t.id);
      await buang('berulang', aturan.id);
    }
    refresh();
  });
}
function reaksiSimpan(tx, saldoLama) {
  sorot(tx.id);
  if (layers.length) return;
  if (ui.tab === 'beranda') {
    koinTerbang($('#s-beranda .kartu-saldo'), byId($('#s-beranda'), tx.id));
    gulirAngka($('#saldo-total'), saldoLama, totalSaldo());
    lompat($('#s-beranda .peek svg'));
  } else if (ui.tab === 'dompet' && tx.tipe === 'transfer') {
    koinTerbang(byId($('#s-dompet'), tx.dompetId), byId($('#s-dompet'), tx.keDompetId));
  }
}
async function hapusTx() {
  const tx = form.asli;
  await buang('transaksi', tx.id);
  await tutupLayer();
  toast('Transaksi dihapus', async () => { await simpan('transaksi', tx); refresh(); sorot(tx.id); });
  await keluarBaris(byId(wadahAktif(), tx.id)?.closest('li'));
  if (!S.transaksi.includes(tx)) refresh(); // bila sudah diurungkan selama animasi, refresh sudah terjadi
}

// ================= form dompet / kategori / anggaran / target =================
function bukaDompet(d = null) {
  const s = saldo();
  const dipakai = d && dompetDipakai(d.id);
  const warna = d?.warna && GRADIEN[d.warna] ? d.warna : WARNA[S.dompet.length % 6];
  const el = bukaLayer(`<div class="sheet-head"><h2>${d ? 'Ubah dompet' : 'Dompet baru'}</h2>${btnTutup}</div>
    <label class="isian"><span>Nama</span><input id="f-nama" maxlength="24" value="${esc(d?.nama ?? '')}" placeholder="mis. Rekening Gaji" autocomplete="off"></label>
    <div class="label">Jenis</div>${seg('fs-set', JENIS, d?.jenis ?? 'tunai', 'data-k="jenis"')}
    <label class="isian"><span>Saldo awal</span><input class="rp-input" id="f-saldo" inputmode="numeric" value="${d ? angka(d.saldoAwal) : ''}" placeholder="0" autocomplete="off"></label>
    ${d ? `<p class="muted kecil">Saldo sekarang ${rp(s.get(d.id))} = saldo awal + semua transaksinya.</p>` : ''}
    <div class="label">Warna</div>
    <div class="pilih-warna">${Object.keys(GRADIEN).map(w => `<button data-act="fs-set" data-k="warna" data-v="${w}" aria-pressed="${w === warna}" style="background:${gradien(w)}" aria-label="Warna ${w}"></button>`).join('')}</div>
    <div class="aksi">
      ${d ? (d.arsip ? '<button class="btn garis" data-act="arsip-dompet">Aktifkan</button>' : '<button class="btn garis" data-act="arsip-dompet">Arsipkan</button>') : ''}
      ${d && !dipakai ? '<button class="btn bahaya" data-act="hapus-dompet">Hapus</button>' : ''}
      <button class="btn utama" data-act="simpan-dompet">Simpan</button>
    </div>
    ${d && dipakai ? '<p class="muted kecil">Dompet yang punya transaksi hanya bisa diarsipkan.</p>' : ''}`);
  el.fs = { jenis: d?.jenis ?? 'tunai', warna };
  el.dompet = d;
}
async function simpanDompet(el) {
  const nama = $('#f-nama', el).value.trim();
  if (!nama) { toast('Nama dompet belum diisi.'); return; }
  const d = el.dompet;
  const obj = { id: d?.id ?? uid(), nama, jenis: el.fs.jenis, saldoAwal: nilaiRp('#f-saldo'), warna: el.fs.warna, urutan: d?.urutan ?? urutanBaru(S.dompet), arsip: d?.arsip ?? false };
  await simpan('dompet', obj);
  await tutupLayer();
  refresh();
  toast(d ? 'Dompet diperbarui' : 'Dompet ditambahkan');
}
async function arsipDompet(el) {
  const d = el.dompet;
  if (!d.arsip) {
    if (dompetAktif().length <= 1) { toast('Minimal harus ada satu dompet aktif.'); return; }
    const s = saldo().get(d.id);
    if (s !== 0 && !confirm(`Saldo ${rp(s)} di "${d.nama}" tidak lagi dihitung di total. Arsipkan?`)) return;
  }
  await simpan('dompet', { ...d, arsip: !d.arsip });
  await tutupLayer();
  refresh();
  toast(d.arsip ? 'Dompet diaktifkan' : 'Dompet diarsipkan');
}
async function hapusDompet(el) {
  const d = el.dompet;
  if (dompetDipakai(d.id)) return;
  if (!d.arsip && dompetAktif().length <= 1) { toast('Minimal harus ada satu dompet aktif.'); return; }
  await buang('dompet', d.id);
  await tutupLayer();
  refresh();
  toast('Dompet dihapus', async () => { await simpan('dompet', d); refresh(); });
}

function bukaKategori(k = null, tipe = 'keluar', onSimpan = null) {
  const fs = { tipe: k?.tipe ?? tipe, ikon: k?.ikon ?? IKON[0], warna: k?.warna ?? WARNA[1] };
  const ikon = IKON.includes(fs.ikon) ? IKON : [fs.ikon, ...IKON];
  const dipakai = k && kategoriDipakai(k.id);
  const el = bukaLayer(`<div class="sheet-head"><h2>${k ? 'Ubah kategori' : 'Kategori baru'}</h2>${btnTutup}</div>
    ${k ? '' : `<div class="label">Jenis</div>${seg('fs-set', { keluar: 'Pengeluaran', masuk: 'Pemasukan' }, fs.tipe, 'data-k="tipe"')}`}
    <label class="isian"><span>Nama</span><input id="f-nama" maxlength="24" value="${esc(k?.nama ?? '')}" placeholder="mis. Kopi" autocomplete="off"></label>
    <div class="label">Ikon</div>
    <div class="pilih-ikon">${ikon.map(i => `<button data-act="fs-set" data-k="ikon" data-v="${esc(i)}" aria-pressed="${i === fs.ikon}">${esc(i)}</button>`).join('')}</div>
    <div class="label">Warna</div>
    <div class="pilih-warna">${WARNA.map(w => `<button data-act="fs-set" data-k="warna" data-v="${w}" aria-pressed="${w === fs.warna}" style="background:${w}" aria-label="Warna ${w}"></button>`).join('')}</div>
    <div class="aksi">
      ${k?.arsip ? '<button class="btn garis" data-act="arsip-kat">Aktifkan</button>' : dipakai ? '<button class="btn garis" data-act="arsip-kat">Arsipkan</button>' : ''}
      ${k && !dipakai ? '<button class="btn bahaya" data-act="hapus-kat">Hapus</button>' : ''}
      <button class="btn utama" data-act="simpan-kat">Simpan</button>
    </div>
    ${dipakai ? '<p class="muted kecil">Kategori yang sudah dipakai hanya bisa diarsipkan.</p>' : ''}`);
  el.fs = fs;
  el.kategori = k;
  el.onSimpan = onSimpan;
}
async function simpanKategori(el) {
  const nama = $('#f-nama', el).value.trim();
  if (!nama) { toast('Nama kategori belum diisi.'); return; }
  const k = el.kategori;
  const obj = { id: k?.id ?? uid(), nama, tipe: k?.tipe ?? el.fs.tipe, warna: el.fs.warna, ikon: el.fs.ikon, urutan: k?.urutan ?? urutanBaru(S.kategori), arsip: k?.arsip ?? false };
  await simpan('kategori', obj);
  const cb = el.onSimpan;
  await tutupLayer();
  cb?.(obj);
  refresh();
  toast(k ? 'Kategori diperbarui' : 'Kategori ditambahkan');
}
async function arsipKategori(el) {
  const k = el.kategori;
  await simpan('kategori', { ...k, arsip: !k.arsip });
  await tutupLayer();
  refresh();
  toast(k.arsip ? 'Kategori diaktifkan' : 'Kategori diarsipkan');
}
async function hapusKategori(el) {
  const k = el.kategori;
  if (kategoriDipakai(k.id)) return;
  const ang = S.anggaran.filter(a => a.kategoriId === k.id);
  for (const a of ang) await buang('anggaran', a.id);
  await buang('kategori', k.id);
  await tutupLayer();
  refresh();
  toast('Kategori dihapus', async () => { await simpan('kategori', k); await db.putBanyak('anggaran', ang); S.anggaran.push(...ang); refresh(); });
}

function bukaAnggaran(kategoriId) {
  const k = kat(kategoriId);
  if (!k) return;
  const a = S.anggaran.find(x => x.bulan === ui.bulan && x.kategoriId === kategoriId);
  const el = bukaLayer(`<div class="sheet-head"><h2>${esc(k.ikon)} ${esc(k.nama)}</h2>${btnTutup}</div>
    <p class="muted">Batas pengeluaran untuk ${namaBulan(ui.bulan)}.</p>
    <label class="isian"><span>Batas (Rp)</span><input class="rp-input" id="f-batas" inputmode="numeric" value="${a ? angka(a.batas) : ''}" placeholder="0" autocomplete="off"></label>
    <div class="aksi">${a ? '<button class="btn bahaya" data-act="hapus-anggaran">Hapus</button>' : ''}<button class="btn utama" data-act="simpan-anggaran">Simpan</button></div>`);
  el.kategoriId = kategoriId;
  el.anggaran = a;
  $('#f-batas', el).focus();
}
async function simpanAnggaran(el) {
  const batas = nilaiRp('#f-batas');
  if (!batas) { toast('Isi batas lebih dari 0.'); return; }
  const sebelum = potretRayakan();
  await simpan('anggaran', { id: el.anggaran?.id ?? uid(), kategoriId: el.kategoriId, bulan: ui.bulan, batas });
  await tutupLayer();
  refresh();
  toast('Anggaran disimpan' + cekRayakan(sebelum));
}
async function hapusAnggaran(el) {
  const a = el.anggaran;
  await buang('anggaran', a.id);
  await tutupLayer();
  refresh();
  toast('Anggaran dihapus', async () => { await simpan('anggaran', a); refresh(); });
}
async function salinAnggaran() {
  const lalu = S.anggaran.filter(a => a.bulan === geserBulan(ui.bulan, -1) && kat(a.kategoriId));
  const baru = lalu.map(a => ({ id: uid(), kategoriId: a.kategoriId, bulan: ui.bulan, batas: a.batas }));
  await db.putBanyak('anggaran', baru);
  S.anggaran.push(...baru);
  refresh();
  toast(`${baru.length} anggaran disalin`);
}

function bukaTarget(t = null) {
  const el = bukaLayer(`<div class="sheet-head"><h2>${t ? 'Ubah target' : 'Target baru'}</h2>${btnTutup}</div>
    <label class="isian"><span>Nama</span><input id="f-nama" maxlength="30" value="${esc(t?.nama ?? '')}" placeholder="mis. HP baru" autocomplete="off"></label>
    <label class="isian"><span>Target (Rp)</span><input class="rp-input" id="f-target" inputmode="numeric" value="${t ? angka(t.target) : ''}" placeholder="4.000.000" autocomplete="off"></label>
    <label class="isian"><span>Sudah terkumpul (Rp)</span><input class="rp-input" id="f-kumpul" inputmode="numeric" value="${t ? angka(t.terkumpul) : ''}" placeholder="0" autocomplete="off"></label>
    <label class="isian"><span>Tenggat (opsional)</span><input type="date" id="f-tenggat" value="${t?.tenggat ?? ''}"></label>
    ${t ? `<div class="setor"><label class="isian"><span>Tambah setoran</span><input class="rp-input" id="f-setor" inputmode="numeric" placeholder="0" autocomplete="off"></label>
      <button class="btn garis" data-act="setor-target">+ Setor</button></div>` : ''}
    <div class="aksi">${t ? '<button class="btn bahaya" data-act="hapus-target">Hapus</button>' : ''}<button class="btn utama" data-act="simpan-target">Simpan</button></div>`);
  el.target = t;
}
async function simpanTarget(el, setor = 0) {
  const nama = $('#f-nama', el).value.trim(), target = nilaiRp('#f-target');
  if (!nama || !target) { toast('Isi nama dan nominal target.'); return; }
  if (setor && !nilaiRp('#f-setor')) { toast('Isi nominal setoran.'); return; }
  const lama = el.target;
  const terkumpul = Math.min(MAKS_NOMINAL, nilaiRp('#f-kumpul') + (setor ? nilaiRp('#f-setor') : 0));
  const tercapai = terkumpul >= target;
  const baruTercapai = tercapai && !(lama && lama.terkumpul >= lama.target);
  const obj = { id: lama?.id ?? uid(), nama, target, terkumpul, tenggat: $('#f-tenggat', el).value || '',
    tercapaiPada: !tercapai ? null : baruTercapai ? isoHari() : lama?.tercapaiPada ?? isoHari() };
  const sebelum = potretRayakan();
  await simpan('target', obj);
  await tutupLayer();
  refresh();
  const ekstra = cekRayakan(sebelum);
  if (baruTercapai) {
    if (!ekstra) konfeti($('#s-dompet .gelembung svg'));
    toast(`Target ${nama} tercapai! 🎉`);
  } else toast((setor ? 'Setoran dicatat' : 'Target disimpan') + ekstra);
}
async function hapusTarget(el) {
  const t = el.target;
  await buang('target', t.id);
  await tutupLayer();
  refresh();
  toast('Target dihapus', async () => { await simpan('target', t); refresh(); });
}

// ================= halaman: riwayat, pengaturan, kategori, berulang, lencana =================
function bukaRiwayat() {
  ui.rw = { q: '', kat: '', dom: '' };
  const el = bukaLayer(`<header class="page-head">${btnKembali}<h1>Riwayat</h1></header>
    <label class="cari"><span aria-hidden="true">🔎</span><input type="search" id="rw-q" placeholder="Cari catatan atau nominal" enterkeyhint="search" autocomplete="off" aria-label="Cari"></label>
    <div class="rw-filter"></div><div class="rw-isi"></div>`, 'page', { render: () => renderRiwayat(el) });
  renderRiwayat(el);
}
function renderRiwayat(el) {
  const q = ui.rw.q.trim();
  const opsiKat = tipe => urut(S.kategori.filter(k => k.tipe === tipe)).map(k => `<option value="${esc(k.id)}" ${k.id === ui.rw.kat ? 'selected' : ''}>${esc(k.ikon)} ${esc(k.nama)}</option>`).join('');
  $('.rw-filter', el).innerHTML = `${q ? '<p class="muted">Mencari di semua bulan</p>' : navBulan()}
    <div class="fields">
      <label class="field"><select data-f="rw-kat" aria-label="Filter kategori"><option value="">Semua kategori</option>
        <optgroup label="Pengeluaran">${opsiKat('keluar')}</optgroup><optgroup label="Pemasukan">${opsiKat('masuk')}</optgroup></select></label>
      <label class="field"><select data-f="rw-dom" aria-label="Filter dompet"><option value="">Semua dompet</option>
        ${urut(S.dompet).map(d => `<option value="${esc(d.id)}" ${d.id === ui.rw.dom ? 'selected' : ''}>${esc(d.nama)}${d.arsip ? ' (arsip)' : ''}</option>`).join('')}</select></label>
    </div>`;
  let tx = q ? S.transaksi.filter(t => cocokCari(t, q)) : txBulan(ui.bulan);
  if (ui.rw.kat) tx = tx.filter(t => t.kategoriId === ui.rw.kat);
  if (ui.rw.dom) tx = tx.filter(t => t.dompetId === ui.rw.dom || t.keDompetId === ui.rw.dom);
  urutTx(tx);
  const BATAS = 500;
  $('.rw-isi', el).innerHTML = tx.length
    ? (q ? `<p class="muted">${tx.length} transaksi ditemukan</p>` : '') + grupPerHari(tx.slice(0, BATAS)) + (tx.length > BATAS ? `<p class="muted tengah">Menampilkan ${BATAS} teratas. Persempit pencarian.</p>` : '')
    : q || ui.rw.kat || ui.rw.dom ? `<div class="kosong">${clawd('ngantuk', 'besar')}<p>Tidak ada yang cocok.</p></div>` : kosong(`${namaBulan(ui.bulan)} belum ada transaksi.`);
}

function bukaPengaturan() {
  const el = bukaLayer(`<header class="page-head">${btnKembali}<h1>Pengaturan</h1></header><div class="set-isi"></div>`, 'page', { render: () => renderPengaturan(el) });
  renderPengaturan(el);
}
function renderPengaturan(el) {
  const s = S.set, notif = 'Notification' in window;
  $('.set-isi', el).innerHTML = `
    <section class="grup"><h2>Tampilan</h2>
      <div class="baris-set kolom"><span>Tema</span>${seg('set-tema', { sistem: 'Ikuti HP', terang: 'Terang', gelap: 'Gelap' }, s.tema)}</div>
      <div class="baris-set kolom"><span>Animasi</span>${seg('set-animasi', { penuh: 'Penuh', hemat: 'Hemat' }, s.animasi)}
        ${mqHemat.matches ? '<small class="muted">“Hapus animasi” di HP aktif, jadi animasi selalu hemat.</small>' : ''}</div>
      <label class="baris-set"><span>Getar halus di keypad</span><input type="checkbox" class="switch" data-f="set-getar" ${s.getar ? 'checked' : ''}></label>
    </section>
    <section class="grup"><h2>Catatan</h2>
      <button class="baris-set" data-act="kategori-page"><span>🏷️ Kategori</span><span class="muted">${S.kategori.filter(k => !k.arsip).length} aktif ›</span></button>
      <button class="baris-set" data-act="berulang-page"><span>🔁 Transaksi berulang</span><span class="muted">${S.berulang.filter(r => r.aktif).length} aktif ›</span></button>
      <button class="baris-set" data-act="lencana"><span>🏅 Streak &amp; lencana</span><span class="muted">🔥 ${streakSekarang()} ›</span></button>
    </section>
    <section class="grup"><h2>Pengingat &amp; keamanan</h2>
      <label class="baris-set"><span>Pengingat harian</span><input type="checkbox" class="switch" data-f="set-pengingat" ${s.jamPengingat ? 'checked' : ''}></label>
      ${s.jamPengingat ? `<label class="baris-set"><span>Jam</span><input type="time" data-f="set-jam" value="${s.jamPengingat}"></label>` : ''}
      <small class="muted">Versi PWA hanya bisa mengingatkan saat aplikasi masih terbuka di latar${notif ? '' : ' (browser ini tidak mendukung notifikasi)'}. Pengingat tepat waktu butuh versi APK. Clawd tetap mengantuk di Beranda bila lewat jam 19.00 belum ada catatan.</small>
      <button class="baris-set" data-act="${s.pinHash ? 'pin-hapus' : 'pin-atur'}"><span>🔒 Kunci PIN</span><span class="muted">${s.pinHash ? 'Aktif · matikan ›' : 'Mati · atur ›'}</span></button>
      ${s.pinHash ? '<button class="baris-set" data-act="pin-atur"><span>Ganti PIN</span><span class="muted">›</span></button>' : ''}
    </section>
    <section class="grup"><h2>Data</h2>
      <button class="baris-set" data-act="ekspor-json"><span>💾 Cadangkan (JSON)</span><span class="muted">${s.cadanganTerakhir ? tglPanjang(s.cadanganTerakhir) : 'belum pernah'} ›</span></button>
      <button class="baris-set" data-act="impor"><span>📂 Pulihkan dari cadangan</span><span class="muted">›</span></button>
      <button class="baris-set" data-act="ekspor-csv"><span>📊 Ekspor CSV (Sheets/Excel)</span><span class="muted">›</span></button>
      <small class="muted">Data hanya ada di HP ini. Simpan file cadangan ke Google Drive minimal sebulan sekali.</small>
    </section>
    <section class="grup tentang">${clawd('senang')}<p><b>Capit Duit</b> · skema data v${VERSI_SKEMA}<br>
      <small class="muted">Clawd adalah maskot milik Anthropic, dipakai untuk keperluan pribadi.</small></p></section>`;
}

function bukaKategoriPage() {
  const el = bukaLayer(`<header class="page-head">${btnKembali}<h1>Kategori</h1><span class="spasi"></span><button class="chip" data-act="kat-baru-page">+ Baru</button></header>
    <div class="kat-isi"></div>`, 'page', { render: () => renderKategoriPage(el) });
  renderKategoriPage(el);
}
function renderKategoriPage(el) {
  $('.kat-isi', el).innerHTML = `${seg('kat-tab', { keluar: 'Pengeluaran', masuk: 'Pemasukan' }, ui.katTipe)}
    <ul class="daftar-tx">${urut(S.kategori.filter(k => k.tipe === ui.katTipe)).map(k => `<li><button class="tx${k.arsip ? ' arsip' : ''}" data-act="ubah-kat" data-id="${esc(k.id)}">
      ${ikonKat(k)}<span class="tx-main"><b>${esc(k.nama)}</b><small>${k.arsip ? 'Diarsipkan' : kategoriDipakai(k.id) ? 'Dipakai' : 'Belum dipakai'}</small></span><em class="muted">›</em></button></li>`).join('')}</ul>`;
}

function bukaBerulangPage() {
  const el = bukaLayer(`<header class="page-head">${btnKembali}<h1>Transaksi berulang</h1></header><div class="rule-isi"></div>`, 'page', { render: () => renderBerulang(el) });
  renderBerulang(el);
}
function renderBerulang(el) {
  $('.rule-isi', el).innerHTML = S.berulang.length
    ? `<ul class="daftar-tx">${S.berulang.map(r => {
      const k = kat(r.kategoriId), nama = r.catatan || (r.tipe === 'transfer' ? 'Transfer' : k?.nama);
      const tujuan = r.tipe === 'transfer' ? `${esc(dom(r.dompetId)?.nama)} → ${esc(dom(r.keDompetId)?.nama)}` : esc(dom(r.dompetId)?.nama);
      return `<li class="rule"><span class="ic" style="--c:${r.tipe === 'transfer' ? '#8B6CFF' : k?.warna || '#8A84A0'}">${r.tipe === 'transfer' ? '⇄' : esc(k?.ikon)}</span>
        <span class="tx-main"><b>${esc(nama)}</b><small class="num">${TIPE[r.tipe]} ${rp(r.nominal)} · tiap tgl ${r.hari} · ${tujuan}</small></span>
        <input type="checkbox" class="switch" data-f="rule-aktif" data-id="${esc(r.id)}" ${r.aktif ? 'checked' : ''} aria-label="Aktifkan ${esc(nama)}">
        <button class="ikon-btn" data-act="hapus-rule" data-id="${esc(r.id)}" aria-label="Hapus aturan ${esc(nama)}">🗑️</button></li>`;
    }).join('')}</ul><p class="muted kecil">Transaksi dibuat otomatis saat aplikasi dibuka pada atau setelah tanggalnya. Tanggal 29–31 di bulan pendek jatuh ke hari terakhir bulan itu.</p>`
    : `<div class="kosong">${clawd('netral', 'besar')}<p>Belum ada. Saat mencatat kos, langganan, atau cicilan, centang “🔁 Tiap bulan”.</p></div>`;
}

function bukaLencana() {
  const punya = lencanaSekarang(), h = hariCatat();
  bukaLayer(`<div class="sheet-head"><h2>Streak &amp; lencana</h2>${btnTutup}</div>
    <div class="streak-besar"><b>🔥 ${hitungStreak(h, isoHari())}</b><span>hari berturut-turut<br><small class="muted">Terpanjang: ${streakTerpanjang(h)} hari</small></span></div>
    <div class="grid-lencana">${LENCANA.map(l => `<div class="lencana${punya.has(l.id) ? ' dapat' : ''}"><span>${l.ikon}</span><b>${l.nama}</b><small>${l.ket}</small></div>`).join('')}</div>`);
}

// ================= cadangan =================
function unduh(nama, isi, tipe) {
  const url = URL.createObjectURL(new Blob([isi], { type: tipe }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nama });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function eksporJson() {
  const { id, pinHash, pinSalt, ...pengaturan } = S.set; // PIN tidak ikut ke file cadangan
  const data = { aplikasi: 'Capit Duit', versiSkema: VERSI_SKEMA, diekspor: new Date().toISOString(),
    transaksi: S.transaksi, kategori: S.kategori, dompet: S.dompet, anggaran: S.anggaran, berulang: S.berulang, target: S.target, pengaturan };
  unduh(`capit-duit-${isoHari()}.json`, JSON.stringify(data), 'application/json');
  await simpanSet({ cadanganTerakhir: isoHari() });
  refresh();
  toast('File cadangan diunduh');
}
async function bacaImpor(file) {
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) { toast('File terlalu besar.'); return; }
  let hasil;
  try { hasil = validasiImpor(JSON.parse(await file.text())); } catch { hasil = { ok: false, galat: ['File bukan JSON yang valid.'] }; }
  if (!hasil.ok) {
    bukaLayer(`<div class="sheet-head"><h2>File tidak bisa dipulihkan</h2>${btnTutup}</div>
      <ul class="galat">${hasil.galat.map(g => `<li>${esc(g)}</li>`).join('')}</ul><p class="muted">Data sekarang tidak diubah.</p>`);
    return;
  }
  const el = bukaLayer(`<div class="sheet-head"><h2>Pulihkan cadangan?</h2>${btnTutup}</div>
    <p class="ringkas-impor">${esc(hasil.ringkasan)}</p>
    <p class="peringatan">Semua data di HP ini (${S.transaksi.length} transaksi) akan <b>ditimpa</b>. Tidak bisa diurungkan.</p>
    <div class="aksi"><button class="btn garis" data-act="tutup">Batal</button><button class="btn bahaya-isi" data-act="pulihkan">Pulihkan</button></div>`);
  el.data = hasil.data;
}
async function pulihkan(el) {
  const { pengaturan, ...stores } = el.data;
  const set = { ...SET_AWAL, ...pengaturan, id: 'app', versiSkema: VERSI_SKEMA, pinHash: S.set.pinHash, pinSalt: S.set.pinSalt, cadanganTerakhir: isoHari() };
  await db.gantiSemua({ ...stores, pengaturan: [set] });
  Object.assign(S, stores, { set });
  terapkanTampilan();
  while (layers.length) await tutupLayer();
  refresh();
  jadwalPengingat();
  toast('Data dipulihkan');
}

// ================= transaksi berulang =================
async function jalankanBerulang(senyap = false) {
  const hi = isoHari();
  let n = 0;
  for (const r of S.berulang) {
    if (!r.aktif) continue;
    const tgl = jatuhTempo(r, hi);
    if (!tgl.length) continue;
    if (!dom(r.dompetId) || (r.tipe === 'transfer' ? !dom(r.keDompetId) : !kat(r.kategoriId))) continue;
    const baru = tgl.map(t => ({ id: uid(), tipe: r.tipe, nominal: r.nominal, kategoriId: r.kategoriId, dompetId: r.dompetId,
      keDompetId: r.keDompetId, tanggal: t, catatan: r.catatan, dibuat: Date.now(), berulangId: r.id }));
    const rr = { ...r, terakhir: tgl[tgl.length - 1].slice(0, 7) };
    await db.putMulti({ transaksi: baru, berulang: [rr] }); // atomik: tidak ada duplikat bila terputus di tengah
    S.transaksi.push(...baru);
    Object.assign(r, rr);
    n += baru.length;
  }
  if (n && !senyap) toast(`${n} transaksi berulang dicatat otomatis`);
  return n;
}

// ================= pengingat (best effort di PWA) =================
let timerPengingat;
function jadwalPengingat() {
  clearTimeout(timerPengingat);
  const jam = S.set.jamPengingat;
  if (!jam || !('Notification' in window) || Notification.permission !== 'granted') return;
  const [h, m] = jam.split(':').map(Number);
  const t = new Date();
  t.setHours(h, m, 0, 0);
  if (t <= new Date()) t.setDate(t.getDate() + 1);
  timerPengingat = setTimeout(async () => {
    if (!adaCatatanHariIni()) {
      const reg = await navigator.serviceWorker?.getRegistration();
      reg?.showNotification('Capit Duit', { body: 'Hari ini belum ada catatan. Ada jajan?', icon: 'icons/icon-192.png', tag: 'pengingat' });
    }
    jadwalPengingat();
  }, t - new Date());
}

// ================= PIN =================
// ponytail: PIN 4 digit hanya layar privasi, bukan enkripsi. Data IndexedDB tetap terbaca oleh siapa pun yang memegang DevTools.
async function hashPin(pin, salt) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function padPin({ judul, batal = false, lupa = false, cek = null }) {
  return new Promise(selesai => {
    const el = $('#kunci');
    let isi = '', sibuk = false;
    el.hidden = false;
    el.innerHTML = `<div class="pin" role="dialog" aria-modal="true" aria-label="${esc(judul)}">${clawd('netral', 'besar')}<h2>${esc(judul)}</h2>
      <div class="titik" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="keypad num">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-pin="${n}">${n}</button>`).join('')}
        ${batal ? '<button data-pin="batal" class="kecil">Batal</button>' : lupa ? '<button data-pin="lupa" class="kecil">Lupa?</button>' : '<span></span>'}
        <button data-pin="0">0</button><button data-pin="del" aria-label="Hapus angka">⌫</button></div></div>`;
    const titik = () => $$('.titik i', el).forEach((t, i) => t.classList.toggle('isi', i < isi.length));
    const tutup = v => { el.hidden = true; el.innerHTML = ''; el.onclick = null; selesai(v); };
    el.onclick = async e => {
      const v = e.target.closest('[data-pin]')?.dataset.pin;
      if (!v || sibuk) return;
      if (v === 'batal') return tutup(null);
      if (v === 'lupa') return lupaPin();
      if (v === 'del') isi = isi.slice(0, -1);
      else if (isi.length < 4) { isi += v; getar(10); }
      titik();
      if (isi.length < 4) return;
      sibuk = true;
      if (!cek || await cek(isi)) return tutup(isi);
      getar([30, 40, 30]);
      $('.titik', el).animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-4px)' }, { transform: 'none' }], { duration: 250 });
      isi = '';
      setTimeout(() => { titik(); sibuk = false; }, 250);
    };
  });
}
let janjiKunci = null;
function kunci() {
  if (!S.set.pinHash) return Promise.resolve();
  if (janjiKunci) return janjiKunci;
  if (!$('#kunci').hidden) return Promise.resolve(); // pad PIN lain sedang terbuka
  janjiKunci = padPin({ judul: 'Masukkan PIN', lupa: true, cek: async p => (await hashPin(p, S.set.pinSalt)) === S.set.pinHash })
    .then(() => { janjiKunci = null; });
  return janjiKunci;
}
async function lupaPin() {
  if (!confirm('Lupa PIN? Satu-satunya cara adalah menghapus SEMUA data di aplikasi ini (pulihkan lagi dari file cadangan). Lanjutkan?')) return;
  await db.gantiSemua({});
  location.reload();
}
async function aturPin() {
  if (S.set.pinHash && !(await padPin({ judul: 'PIN saat ini', batal: true, cek: async p => (await hashPin(p, S.set.pinSalt)) === S.set.pinHash }))) return;
  const p1 = await padPin({ judul: 'PIN baru (4 angka)', batal: true });
  if (!p1) return;
  const p2 = await padPin({ judul: 'Ulangi PIN baru', batal: true, cek: async p => p === p1 });
  if (!p2) return;
  const salt = uid();
  await simpanSet({ pinSalt: salt, pinHash: await hashPin(p1, salt) });
  refresh();
  toast('PIN aktif. Jangan sampai lupa!');
}
async function hapusPin() {
  if (!(await padPin({ judul: 'Masukkan PIN untuk mematikan', batal: true, cek: async p => (await hashPin(p, S.set.pinSalt)) === S.set.pinHash }))) return;
  await simpanSet({ pinHash: null, pinSalt: null });
  refresh();
  toast('Kunci PIN dimatikan');
}

// ================= aksi (event delegation) =================
const layerDari = el => el.closest('.layer');
const AKSI = {
  tab: b => keTab(b.dataset.v),
  catat: () => { if (!form) bukaCatat(); },
  tutup: () => tutupLayer(),
  urungkan: async () => {
    const f = aksiUrungkan;
    aksiUrungkan = null;
    $('#toast').classList.remove('muncul');
    await f?.();
  },
  clawd: b => {
    ui.pilih++;
    const teks = ui.tab === 'anggaran' ? moodAnggaran().kalimat : ui.tab === 'dompet' ? TIPS_DOMPET[ui.pilih % TIPS_DOMPET.length] : moodBeranda().kalimat;
    const g = $(`#s-${ui.tab} .gelembung span`);
    if (g) g.textContent = teks;
    lompat(b.querySelector('svg'));
    if (b.classList.contains('peek')) lompat($(`#s-${ui.tab} .gelembung svg`));
  },
  'pilih-bulan': () => {
    const i = $('#bulan-input');
    i.value = ui.bulan;
    try { i.showPicker(); } catch { i.click(); }
  },
  'bulan-geser': b => { ui.bulan = geserBulan(ui.bulan, Number(b.dataset.v)); refresh(); },
  'periode-geser': b => {
    const n = Number(b.dataset.v);
    if (ui.statMode === 'minggu') ui.mingguRef = tambahHari(ui.mingguRef, 7 * n);
    else ui.bulan = geserBulan(ui.bulan, 12 * n);
    refresh();
  },
  'stat-mode': b => {
    ui.statMode = b.dataset.v;
    if (ui.statMode === 'minggu') ui.mingguRef = ui.bulan === bulanIni() ? isoHari() : akhirBulan(ui.bulan);
    refresh();
  },
  riwayat: () => bukaRiwayat(),
  pengaturan: () => bukaPengaturan(),
  lencana: () => bukaLencana(),

  'ubah-tx': b => { const t = S.transaksi.find(x => x.id === b.dataset.id); if (t && !form) bukaCatat(t); },
  tipe: b => {
    form.tipe = b.dataset.v;
    if (kat(form.kategoriId)?.tipe !== form.tipe) form.kategoriId = null;
    aturTujuanTransfer();
    renderCatat();
  },
  key: b => ketik(b.dataset.v),
  'kat-pilih': b => {
    form.kategoriId = b.dataset.id;
    for (const x of $$('.grid-kat .kat', form.el)) x.setAttribute('aria-pressed', String(x === b));
    if (penuh()) {
      b.animate([{ transform: 'scale(.9)' }, { transform: 'scale(1.06)' }, { transform: 'none' }], { duration: 250, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      b.querySelector('.ic').animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-14deg)' }, { transform: 'rotate(10deg)' }, { transform: 'none' }], { duration: 250 });
    }
    perbaruiNominal(false);
  },
  'kat-baru': () => bukaKategori(null, form.tipe, k => { if (form && form.tipe === k.tipe) { form.kategoriId = k.id; renderCatat(); } }),
  tukar: () => { [form.dompetId, form.keDompetId] = [form.keDompetId, form.dompetId]; renderCatat(); },
  'simpan-tx': () => simpanTx(),
  'hapus-tx': () => hapusTx(),

  'fs-set': b => {
    const el = layerDari(b);
    el.fs[b.dataset.k] = b.dataset.v;
    for (const x of b.parentElement.children) x.setAttribute('aria-pressed', String(x === b));
  },
  'dompet-baru': () => bukaDompet(),
  'ubah-dompet': b => bukaDompet(dom(b.dataset.id)),
  'simpan-dompet': b => simpanDompet(layerDari(b)),
  'arsip-dompet': b => arsipDompet(layerDari(b)),
  'hapus-dompet': b => hapusDompet(layerDari(b)),
  transfer: () => { if (!form) bukaCatat(null, { tipe: 'transfer' }); },

  'ubah-kat': b => bukaKategori(kat(b.dataset.id)),
  'kat-baru-page': () => bukaKategori(null, ui.katTipe),
  'kat-tab': b => { ui.katTipe = b.dataset.v; renderKategoriPage(layerDari(b)); },
  'simpan-kat': b => simpanKategori(layerDari(b)),
  'arsip-kat': b => arsipKategori(layerDari(b)),
  'hapus-kat': b => hapusKategori(layerDari(b)),
  'kategori-page': () => bukaKategoriPage(),

  'ubah-anggaran': b => bukaAnggaran(b.dataset.id),
  'simpan-anggaran': b => simpanAnggaran(layerDari(b)),
  'hapus-anggaran': b => hapusAnggaran(layerDari(b)),
  'salin-anggaran': () => salinAnggaran(),

  'target-baru': () => bukaTarget(),
  'ubah-target': b => bukaTarget(S.target.find(t => t.id === b.dataset.id)),
  'simpan-target': b => simpanTarget(layerDari(b)),
  'setor-target': b => simpanTarget(layerDari(b), 1),
  'hapus-target': b => hapusTarget(layerDari(b)),

  'berulang-page': () => bukaBerulangPage(),
  'hapus-rule': async b => {
    const r = S.berulang.find(x => x.id === b.dataset.id);
    await buang('berulang', r.id);
    refresh();
    toast('Aturan dihapus (transaksi lama tetap ada)', async () => { await simpan('berulang', r); refresh(); });
  },
  'set-tema': async b => { await simpanSet({ tema: b.dataset.v }); terapkanTampilan(); refresh(); },
  'set-animasi': async b => { await simpanSet({ animasi: b.dataset.v }); terapkanTampilan(); refresh(); },
  'pin-atur': () => aturPin(),
  'pin-hapus': () => hapusPin(),
  'ekspor-json': () => eksporJson(),
  'ekspor-csv': () => { unduh(`capit-duit-${isoHari()}.csv`, keCsv(S), 'text/csv;charset=utf-8'); toast('CSV diunduh'); },
  impor: () => $('#impor-input').click(),
  pulihkan: b => pulihkan(layerDari(b)),
};

const jalankan = fn => Promise.resolve().then(fn).catch(err => { console.error(err); toast('Ups, gagal menyimpan. Coba lagi.'); });

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled || b.closest('#kunci')) return;
  const fn = AKSI[b.dataset.act];
  if (fn) jalankan(() => fn(b, e));
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.classList.contains('rp-input')) { const d = digit(t.value); t.value = d ? angka(Number(d)) : ''; }
  if (form && t.dataset.f === 'catatan') form.catatan = t.value;
  if (t.id === 'rw-q') { ui.rw.q = t.value; renderRiwayat(layerDari(t)); }
});

document.addEventListener('change', e => jalankan(async () => {
  const t = e.target, f = t.dataset.f;
  if (t.id === 'bulan-input') { if (/^\d{4}-\d{2}$/.test(t.value)) { ui.bulan = t.value; refresh(); } return; }
  if (t.id === 'impor-input') { const file = t.files[0]; t.value = ''; return bacaImpor(file); }
  if (form && ['dompetId', 'keDompetId', 'tanggal', 'ulangi'].includes(f)) {
    if (f === 'ulangi') form.ulangi = t.checked;
    else if (f === 'tanggal') { form.tanggal = t.value || isoHari(); t.value = form.tanggal; }
    else form[f] = t.value;
    perbaruiNominal(false);
    return;
  }
  if (f === 'rw-kat' || f === 'rw-dom') { ui.rw[f.slice(3)] = t.value; renderRiwayat(layerDari(t)); return; }
  if (f === 'set-getar') { await simpanSet({ getar: t.checked }); getar(10); return; }
  if (f === 'set-pengingat') {
    if (t.checked && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    await simpanSet({ jamPengingat: t.checked ? '20:00' : '' });
    if (t.checked && 'Notification' in window && Notification.permission !== 'granted') toast('Izin notifikasi ditolak. Clawd tetap mengingatkan di Beranda.');
    jadwalPengingat();
    refresh();
    return;
  }
  if (f === 'set-jam' && /^\d{2}:\d{2}$/.test(t.value)) { await simpanSet({ jamPengingat: t.value }); jadwalPengingat(); return; }
  if (f === 'rule-aktif') {
    const r = S.berulang.find(x => x.id === t.dataset.id);
    await simpan('berulang', { ...r, aktif: t.checked, terakhir: t.checked ? terakhirSaatLanjut(r.hari, isoHari()) : r.terakhir });
    toast(t.checked ? 'Dilanjutkan mulai jatuh tempo berikutnya' : 'Dijeda');
  }
}));

document.addEventListener('keydown', e => {
  if (!$('#kunci').hidden) return;
  if (e.key === 'Escape' && layers.length) { tutupLayer(); return; }
  if (!form || layerAtas() !== form.el || e.target.matches('input, select, textarea')) return;
  if (/^\d$/.test(e.key)) ketik(e.key);
  else if (e.key === 'Backspace') ketik('del');
  else if (e.key === 'Enter') { e.preventDefault(); jalankan(simpanTx); }
});

let tersembunyiSejak = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { tersembunyiSejak = Date.now(); return; }
  if (!S.dompet.length) return; // masih di layar sambutan
  if (tersembunyiSejak && Date.now() - tersembunyiSejak > 60_000) kunci();
  jalankan(async () => { await jalankanBerulang(); refresh(); });
});

// ================= tampilan & start =================
function terapkanTampilan() {
  const r = document.documentElement;
  if (S.set.tema === 'sistem') delete r.dataset.theme; else r.dataset.theme = S.set.tema === 'gelap' ? 'dark' : 'light';
  r.dataset.motion = penuh() ? 'penuh' : 'hemat';
}
mqHemat.addEventListener('change', terapkanTampilan);

function sambutan() {
  const el = $('#kunci');
  el.hidden = false;
  el.innerHTML = `<div class="sambutan">${clawd('rayakan', 'besar jalan')}<h1>Halo, aku Clawd!</h1>
    <p>Aku bantu kamu mencatat uang masuk dan keluar. Semua data tersimpan di HP ini saja, tanpa akun.</p>
    <label class="isian"><span>Isi dompet Tunai sekarang (Rp)</span><input class="rp-input" id="f-saldo" inputmode="numeric" placeholder="0" autocomplete="off"></label>
    <button class="btn utama lebar" id="mulai">Mulai</button></div>`;
  return new Promise(ok => {
    $('#mulai').onclick = () => jalankan(async () => {
      const d = { id: uid(), nama: 'Tunai', jenis: 'tunai', saldoAwal: nilaiRp('#f-saldo'), warna: '#FFB020', urutan: 0, arsip: false };
      await simpan('dompet', d);
      await simpanSet({ dompetTerakhir: d.id });
      el.hidden = true;
      el.innerHTML = '';
      ok();
    });
  });
}

async function init() {
  await db.buka();
  const data = await db.semua();
  for (const k of Object.keys(S)) if (k !== 'set') S[k] = data[k] || [];
  S.set = { ...SET_AWAL, ...(data.pengaturan[0] || {}) };
  if (!data.pengaturan.length) await db.put('pengaturan', S.set);
  terapkanTampilan();
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW gagal', err));
  if (!S.kategori.length) {
    const awal = KATEGORI_AWAL.map(([tipe, nama, ikon, warna], i) => ({ id: uid(), nama, tipe, warna, ikon, urutan: i, arsip: false }));
    await db.putBanyak('kategori', awal);
    S.kategori = awal;
  }
  history.replaceState({ n: 0 }, '');
  $('#splash').classList.add('hilang');
  setTimeout(() => $('#splash').remove(), 400);
  if (!S.dompet.length) await sambutan();
  else await kunci();
  await jalankanBerulang();
  $('#app').hidden = false;
  $('#tabbar').hidden = false;
  tampilkanTab();
  jadwalPengingat();
}

init().catch(err => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<p class="fatal">Capit Duit gagal dibuka: ${esc(err.message)}. Coba muat ulang.</p>`);
});
