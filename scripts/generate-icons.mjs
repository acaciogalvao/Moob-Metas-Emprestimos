/**
 * Gerador de ícones PNG PWA em Node.js puro (sem dependências externas).
 * Usa zlib nativo para comprimir os dados de imagem.
 */
import { createDeflate } from 'zlib';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// --- PNG encoder puro ---
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}
function chunk(type, data) {
  const t = Buffer.from(type);
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const c = crc32(Buffer.concat([t, d]));
  return Buffer.concat([u32be(d.length), t, d, u32be(c)]);
}

async function encodePNG(pixels, width, height) {
  // pixels: Uint8Array of RGBA rows
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    rawRows.push(0); // filter type: None
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rawRows.push(pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]);
    }
  }
  const raw = Buffer.from(rawRows);
  const compressed = await new Promise((res, rej) => {
    const chunks = [];
    const d = createDeflate({ level: 9 });
    d.on('data', c => chunks.push(c));
    d.on('end', () => res(Buffer.concat(chunks)));
    d.on('error', rej);
    d.end(raw);
  });
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = chunk('IHDR', Buffer.concat([u32be(width), u32be(height),
    Buffer.from([8,2,0,0,0])])); // 8-bit RGB... wait, we have RGBA, use color type 6
  // redo: color type 6 = RGBA
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type RGBA
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  return Buffer.concat([sig, chunk('IHDR', ihdrData), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

// --- Desenho do ícone ---
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#',''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function setPixel(pixels, width, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  const i = (y * width + x) * 4;
  // Alpha blend over existing pixel
  const sa = a / 255;
  const da = pixels[i+3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa === 0) return;
  pixels[i]   = Math.round((r * sa + pixels[i]   * da * (1 - sa)) / oa);
  pixels[i+1] = Math.round((g * sa + pixels[i+1] * da * (1 - sa)) / oa);
  pixels[i+2] = Math.round((b * sa + pixels[i+2] * da * (1 - sa)) / oa);
  pixels[i+3] = Math.round(oa * 255);
}

function fillRect(pixels, width, x0, y0, w, h, r, g, b, a = 255) {
  for (let y = y0; y < y0+h; y++)
    for (let x = x0; x < x0+w; x++)
      setPixel(pixels, width, x, y, r, g, b, a);
}

function fillCircle(pixels, width, cx, cy, radius, r, g, b, a = 255) {
  const x0 = Math.floor(cx - radius - 1), x1 = Math.ceil(cx + radius + 1);
  const y0 = Math.floor(cy - radius - 1), y1 = Math.ceil(cy + radius + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const alpha = Math.max(0, Math.min(1, radius + 0.5 - dist));
      if (alpha > 0) setPixel(pixels, width, x, y, r, g, b, Math.round(a * alpha));
    }
  }
}

// Draw a thick rounded line segment
function drawLine(pixels, width, x0, y0, x1, y1, thick, r, g, b) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx*dx + dy*dy);
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(pixels, width, x0 + dx*t, y0 + dy*t, thick/2, r, g, b);
  }
}

// Very simple bitmap "M" — draw it as strokes
function drawM(pixels, size, cx, cy, fontH, r, g, b) {
  const thick = Math.max(2, fontH * 0.11);
  const w = fontH * 0.7;
  const top = cy - fontH * 0.42;
  const bot = cy + fontH * 0.42;
  const mid = cy + fontH * 0.05;
  const l = cx - w / 2;
  const r2 = cx + w / 2;
  // Left vertical
  drawLine(pixels, size, l, top, l, bot, thick, r, g, b);
  // Right vertical
  drawLine(pixels, size, r2, top, r2, bot, thick, r, g, b);
  // Left diagonal down
  drawLine(pixels, size, l, top, cx, mid, thick, r, g, b);
  // Right diagonal down
  drawLine(pixels, size, r2, top, cx, mid, thick, r, g, b);
}

async function generateIcon(size, maskable) {
  const pixels = new Uint8Array(size * size * 4);
  const bg = hexToRgb('#0b0f19');
  const amber = hexToRgb('#f59e0b');
  const amberDark = hexToRgb('#b45309');
  const white = [255, 255, 255];

  // Fill background
  fillRect(pixels, size, 0, 0, size, size, ...bg);

  // Safe zone for maskable: 80% of size
  const cx = size / 2, cy = size / 2;
  const circleR = maskable ? size * 0.33 : size * 0.40;

  // Amber circle (gradient approximation: lighter center → darker edge)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x-cx)**2 + (y-cy)**2);
      if (dist < circleR + 1) {
        const t = Math.max(0, Math.min(1, dist / circleR));
        const rr = Math.round(amber[0] * (1-t) + amberDark[0] * t);
        const gg = Math.round(amber[1] * (1-t) + amberDark[1] * t);
        const bb = Math.round(amber[2] * (1-t) + amberDark[2] * t);
        const alpha = Math.max(0, Math.min(255, Math.round((1 - Math.max(0, dist - circleR + 1)) * 255)));
        setPixel(pixels, size, x, y, rr, gg, bb, alpha);
      }
    }
  }

  // White M letter
  const fontH = circleR * 1.15;
  drawM(pixels, size, cx, cy - circleR * 0.05, fontH, ...white);

  // Amber underline (road line)
  const lineY = cy + circleR * 0.58;
  const lineHalfW = circleR * 0.55;
  const lineThick = Math.max(2, size * 0.022);
  drawLine(pixels, size, cx - lineHalfW, lineY, cx + lineHalfW, lineY, lineThick, ...amber);

  return encodePNG(pixels, size, size);
}

const sizes = [192, 512];
for (const size of sizes) {
  process.stdout.write(`Gerando ${size}px... `);
  const normal = await generateIcon(size, false);
  writeFileSync(`${publicDir}/icon-${size}.png`, normal);
  const maskable = await generateIcon(size, true);
  writeFileSync(`${publicDir}/icon-maskable-${size}.png`, maskable);
  console.log('✅');
}
console.log('Ícones PWA gerados com sucesso!');
