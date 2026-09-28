import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from './logic.js';

const tx = (tipe, nominal, tanggal, extra = {}) => ({ id: Math.random().toString(36), tipe, nominal, tanggal, dompetId: 'a', kategoriId: tipe === 'transfer' ? null : 'k', keDompetId: null, catatan: '', dibuat: 0, ...extra });

test('format rupiah & singkatan', () => {
  assert.equal(L.rp(1250000), 'Rp 1.250.000');
  assert.equal(L.rp(-35000), '−Rp 35.000');
  assert.equal(L.singkat(3017500), '3,02 jt');
  assert.equal(L.singkat(350000), '350 rb');
  assert.equal(L.singkat(317500), '317,5 rb');
  assert.equal(L.singkat(999_960), '1 jt');
  assert.equal(L.singkat(900), '900');
  assert.equal(L.fmtTanggal('2026-09-28'), 'Sen, 28 Sep');
});

test('tanggal & bulan', () => {
  assert.equal(L.geserBulan('2026-01', -1), '2025-12');
  assert.equal(L.geserBulan('2026-12', 1), '2027-01');
  assert.equal(L.hariDalamBulan('2028-02'), 29);
  assert.equal(L.tambahHari('2026-02-28', 1), '2026-03-01');
  assert.equal(L.akhirBulan('2026-09'), '2026-09-30');
});

test('saldo = awal + masuk − keluar − transfer keluar + transfer masuk', () => {
  const dompet = [{ id: 'a', saldoAwal: 100 }, { id: 'b', saldoAwal: 0 }];
  const s = L.saldoDompet([tx('masuk', 50, '2026-09-01'), tx('keluar', 30, '2026-09-02'), tx('transfer', 40, '2026-09-03', { keDompetId: 'b' })], dompet);
  assert.equal(s.get('a'), 80);
  assert.equal(s.get('b'), 40);
  assert.equal(s.get('a') + s.get('b'), 120); // transfer tidak mengubah total
});

test('ringkas mengabaikan transfer & di luar rentang', () => {
  const r = L.ringkas([tx('masuk', 6500000, '2026-09-25'), tx('keluar', 25000, '2026-09-28'), tx('transfer', 99, '2026-09-10', { keDompetId: 'b' }), tx('keluar', 1, '2026-10-01')], '2026-09-01', '2026-09-30');
  assert.deepEqual(r, { masuk: 6500000, keluar: 25000 });
});

test('rentang minggu dimulai Senin', () => {
  const r = L.rentang('minggu', '2026-09-27'); // Minggu
  assert.equal(r.awal, '2026-09-21');
  assert.equal(r.akhir, '2026-09-27');
  const b = L.batang([tx('keluar', 10, '2026-09-22')], 'minggu', r);
  assert.equal(b.length, 7);
  assert.equal(b[0].label, 'Sen');
  assert.equal(b[1].nilai, 10);
  assert.equal(L.rentang('bulan', '2026-09-15').banding, 'Agustus');
});

test('status & persen anggaran konsisten', () => {
  assert.equal(L.statusAnggaran(0.62), 'aman');
  assert.equal(L.statusAnggaran(0.87), 'waspada');
  assert.equal(L.statusAnggaran(1), 'waspada');
  assert.equal(L.statusAnggaran(1.06), 'jebol');
  assert.equal(L.persenAnggaran(0.7996), 79);
  assert.equal(L.persenAnggaran(1.002), 101);
  assert.equal(L.persenAnggaran(1.0583), 106);
});

test('Clawd: urutan ekspresi sesuai PRD', () => {
  const ang = (nama, batas, terpakai) => ({ nama, batas, terpakai, rasio: terpakai / batas });
  const hib = L.suasana({ anggaran: [ang('Belanja', 700000, 610000), ang('Hiburan', 300000, 317500)] });
  assert.equal(hib.ekspresi, 'panik');
  assert.equal(hib.kalimat, 'Hiburan jebol Rp 17.500!');
  assert.equal(L.suasana({ anggaran: [ang('Belanja', 700000, 610000)] }).kalimat, 'Belanja tinggal Rp 90.000.');
  assert.equal(L.suasana({ masuk: 100, keluar: 200 }).ekspresi, 'panik');
  assert.equal(L.suasana({ masuk: 0, keluar: 200 }).ekspresi, 'senang'); // belum gajian: tidak panik
  assert.equal(L.suasana({ streak: 7, adaTxHariIni: true }).ekspresi, 'rayakan');
  assert.equal(L.suasana({ masukHariIni: true }).ekspresi, 'rayakan');
  assert.equal(L.suasana({ kosong: true }).ekspresi, 'ngantuk');
  assert.equal(L.suasana({ bulanIni: true, jam: 20, adaTxHariIni: false }).kalimat, 'Hari ini belum ada catatan. Ada jajan?');
  assert.equal(L.suasana({ bulanIni: true, jam: 18, adaTxHariIni: false }).ekspresi, 'senang');
  assert.notEqual(L.suasana({}, 0).kalimat, L.suasana({}, 1).kalimat);
});

test('streak', () => {
  const s = new Set(['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-20']);
  assert.equal(L.hitungStreak(s, '2026-09-28'), 3);
  assert.equal(L.hitungStreak(s, '2026-09-29'), 3); // hari ini belum catat, streak masih hidup
  assert.equal(L.hitungStreak(s, '2026-09-30'), 0);
  assert.equal(L.streakTerpanjang(s), 3);
});

test('transaksi berulang: jatuh tempo & akhir bulan', () => {
  assert.deepEqual(L.jatuhTempo({ hari: 31, terakhir: '2026-01' }, '2026-04-15'), ['2026-02-28', '2026-03-31']);
  assert.deepEqual(L.jatuhTempo({ hari: 5, terakhir: '2026-09' }, '2026-09-28'), []);
  assert.deepEqual(L.jatuhTempo({ hari: 5, terakhir: '2026-08' }, '2026-09-05'), ['2026-09-05']);
  assert.equal(L.terakhirSaatLanjut(5, '2026-09-28'), '2026-09');
  assert.equal(L.terakhirSaatLanjut(30, '2026-09-28'), '2026-08');
});

test('pencarian catatan & nominal', () => {
  const t = tx('keluar', 25000, '2026-09-28', { catatan: 'Kopi susu' });
  assert.ok(L.cocokCari(t, 'kopi'));
  assert.ok(L.cocokCari(t, '25.000'));
  assert.ok(L.cocokCari(t, 'Rp 25000'));
  assert.ok(!L.cocokCari(t, 'teh 2'));
});

test('CSV escape & formula injection', () => {
  const csv = L.keCsv({ transaksi: [tx('keluar', 5, '2026-09-01', { catatan: '=SUM(A1), "x"' })], kategori: [{ id: 'k', nama: 'Makan' }], dompet: [{ id: 'a', nama: 'Tunai' }] });
  assert.ok(csv.startsWith('﻿tanggal,'));
  assert.ok(csv.includes(`"'=SUM(A1), ""x"""`));
});

test('validasi impor', () => {
  const ok = {
    versiSkema: 1,
    dompet: [{ id: 'a', nama: 'Tunai', jenis: 'tunai', saldoAwal: 0 }, { id: 'b', nama: 'Bank', jenis: 'bank', saldoAwal: 5 }],
    kategori: [{ id: 'k', nama: 'Makan', tipe: 'keluar' }],
    transaksi: [tx('keluar', 1000, '2026-09-28'), tx('transfer', 5, '2026-09-28', { keDompetId: 'b' })],
  };
  const r = L.validasiImpor(ok);
  assert.ok(r.ok, r.galat?.join());
  assert.equal(r.ringkasan, '2 transaksi, 1 kategori, 2 dompet');
  assert.equal(L.validasiImpor({ ...ok, versiSkema: 99 }).ok, false);
  assert.equal(L.validasiImpor({ ...ok, transaksi: [tx('keluar', 1.5, '2026-09-28')] }).ok, false);
  assert.equal(L.validasiImpor({ ...ok, transaksi: [tx('transfer', 5, '2026-09-28', { keDompetId: 'a' })] }).ok, false);
  assert.equal(L.validasiImpor({ ...ok, transaksi: [tx('masuk', 5, '2026-09-28')] }).ok, false); // kategori keluar dipakai masuk
  assert.equal(L.validasiImpor({ ...ok, dompet: ok.dompet.map(d => ({ ...d, arsip: true })) }).ok, false);
  assert.equal(L.validasiImpor([]).ok, false);
  assert.equal(L.validasiImpor({ ...ok, dompet: ok.dompet.map(d => ({ ...d, saldoAwal: -1 })) }).ok, false);
  assert.equal(L.validasiImpor({ ...ok, dompet: ok.dompet.map(d => ({ ...d, warna: 'red;background:url(x)' })) }).data.dompet[0].warna, '#D97757');
});
