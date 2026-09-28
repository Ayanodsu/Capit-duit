// Membuat ikon PNG Clawd (192, 512, maskable 512) dari grid piksel sprite. Jalankan: npm run icons
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OREN = '#D97757', MATA = '#2A1A12', PIPI = '#F4A58C';
// Clawd senang, koordinat viewBox "0 -4 24 21": [x, y, w, h, warna]
const RECTS = [
  [2, 0, 20, 12, OREN], [4, 12, 2, 5, OREN], [8, 12, 2, 5, OREN], [14, 12, 2, 5, OREN], [18, 12, 2, 5, OREN],
  [0, 4, 2, 4, OREN], [22, 4, 2, 4, OREN],
  [3, 7, 3, 1, PIPI], [18, 7, 3, 1, PIPI],
  [6, 3, 2, 1, MATA], [5, 4, 1, 1, MATA], [8, 4, 1, 1, MATA], [16, 3, 2, 1, MATA], [15, 4, 1, 1, MATA], [18, 4, 1, 1, MATA],
];
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

function png(size, bg, lebarClawd) {
  const px = Buffer.alloc(size * size * 3);
  const isi = (x0, y0, w, h, c) => {
    const [r, g, b] = rgb(c);
    for (let y = Math.max(0, y0); y < Math.min(size, y0 + h); y++)
      for (let x = Math.max(0, x0); x < Math.min(size, x0 + w); x++) px.set([r, g, b], (y * size + x) * 3);
  };
  isi(0, 0, size, size, bg);
  const s = Math.floor((size * lebarClawd) / 24); // skala bulat supaya piksel tetap tajam
  const ox = Math.floor((size - 24 * s) / 2), oy = Math.floor((size - 17 * s) / 2); // badan+kaki = 17 baris
  for (const [x, y, w, h, c] of RECTS) isi(ox + x * s, oy + y * s, w * s, h * s, c);

  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  const chunk = (tipe, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(tipe), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const dir = new URL('../icons/', import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL('icon-192.png', dir), png(192, '#FFE9DF', 0.72));
writeFileSync(new URL('icon-512.png', dir), png(512, '#FFE9DF', 0.72));
writeFileSync(new URL('icon-maskable-512.png', dir), png(512, '#FFE9DF', 0.52)); // di dalam zona aman 80%
console.log('Ikon dibuat di icons/');
