# Capit Duit

PWA pencatat keuangan pribadi (Android/Chrome), offline, tanpa akun.

## Pasang di HP

buka https://ayanodsu.github.io/Capit-duit/ 
untuk install klik ikonn titik tiga crome lalu pilih install

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
