# Capit Duit

PWA pencatat keuangan pribadi (Android/Chrome), offline, tanpa akun.

## Jalankan lokal

```bash
npm start
```

Buka http://localhost:5173. Tidak ada dependensi; cukup Node.js.

```bash
npm test
```

Menguji logika inti di `logic.js` (saldo, statistik, anggaran, ekspresi Clawd, streak, transaksi berulang, impor, CSV).

## Pasang di HP

1. Publikasikan lewat GitHub Pages (Settings → Pages → Deploy from a branch → `main` / root). HTTPS wajib.
2. Buka link di Chrome Android → menu ⋮ → **Instal aplikasi**.

**Setiap kali mengubah file**, naikkan `VERSI` di `sw.js` (mis. `capit-duit-v2`). Tanpa itu HP tetap memakai versi lama dari cache.

## Berkas

| File | Isi |
|---|---|
| `index.html` | Kerangka, sprite Clawd, navigasi bawah |
| `app.js` | Semua layar, sheet, motion, PIN, cadangan |
| `logic.js` | Fungsi murni (diuji `test.mjs`) |
| `db.js` | IndexedDB |
| `sw.js` | Service worker cache-first (aset + Google Fonts) |
| `tools/icons.mjs` | Membuat ikon PNG Clawd: `npm run icons` |

## Batasan yang disengaja

- **Pengingat 20.00**: PWA hanya bisa memberi notifikasi saat aplikasi masih hidup di latar. Pengingat tepat waktu butuh versi APK (Capacitor), yang memerlukan Android Studio.
- **PIN**: layar privasi, bukan enkripsi. Lupa PIN = hapus data lalu pulihkan dari file cadangan.
- **Clawd** adalah maskot milik Anthropic; aman untuk pemakaian pribadi, ganti bila dipublikasikan.
