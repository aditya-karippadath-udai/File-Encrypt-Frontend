import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createShieldPNG(width, height) {
  // RGBA buffer
  const rgba = Buffer.alloc(width * height * 4);

  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) / 32;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Distance from center normalized
      const nx = (x - cx) / (width * 0.46);
      const ny = (y - cy) / (height * 0.46);

      // Rounded rectangle / shield boundary
      const inCard = Math.abs(nx) < 0.95 && Math.abs(ny) < 0.95;
      const cornerDist = Math.max(Math.abs(nx) - 0.7, 0) ** 2 + Math.max(Math.abs(ny) - 0.7, 0) ** 2;

      if (inCard && cornerDist < 0.08) {
        // Deep blue to navy gradient background
        const grad = 0.5 + 0.5 * (y / height);
        let r = Math.round(15 + 20 * grad);
        let g = Math.round(23 + 35 * grad);
        let b = Math.round(42 + 70 * grad);
        let a = 255;

        // Shield / lock emblem in center
        const dx = (x - cx) / scale;
        const dy = (y - cy) / scale;

        // Outer shield contour: |dx| <= 9 && dy >= -8 && dy <= (8 - (dx*dx)/15)
        const inShield = Math.abs(dx) <= 8 && dy >= -8 && dy <= (9 - (dx * dx) / 10);
        const inShieldBorder = Math.abs(dx) <= 9 && dy >= -9 && dy <= (10 - (dx * dx) / 9);

        if (inShieldBorder && !inShield) {
          // Blue highlight border
          r = 37;
          g = 99;
          b = 235;
        } else if (inShield) {
          // Shield inner body
          r = 30;
          g = 41;
          b = 59;

          // Lock shackle: circle top
          const shackleDist = Math.sqrt(dx * dx + (dy + 2) * (dy + 2));
          const inShackle = shackleDist <= 3.6 && shackleDist >= 2.0 && dy <= -2;
          // Lock body: rect from dy = -2 to 4, |dx| <= 4
          const inLockBody = Math.abs(dx) <= 4.2 && dy >= -2 && dy <= 4.2;
          // Keyhole
          const inKeyhole = (dx * dx + (dy - 0.5) * (dy - 0.5) <= 1.0) || (Math.abs(dx) <= 0.6 && dy >= 0.5 && dy <= 2.2);

          if (inShackle) {
            r = 96;
            g = 165;
            b = 250; // light blue
          } else if (inKeyhole) {
            r = 15;
            g = 23;
            b = 42; // dark keyhole
          } else if (inLockBody) {
            r = 37;
            g = 99;
            b = 235; // vibrant royal blue
          }
        }

        rgba[idx] = r;
        rgba[idx + 1] = g;
        rgba[idx + 2] = b;
        rgba[idx + 3] = a;
      } else {
        // Transparent
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
      }
    }
  }

  return encodeRawPNG(rgba, width, height);
}

function encodeRawPNG(rgba, width, height) {
  // Raw scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0; // Filter: None
    rgba.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idatData = zlib.deflateSync(scanlines);

  // PNG Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA (6)
  ihdr[10] = 0; // Compression: 0
  ihdr[11] = 0; // Filter: 0
  ihdr[12] = 0; // Interlace: 0
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', idatData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  // CRC32 over type + data
  const crcTarget = chunk.subarray(4, 8 + len);
  const crc = crc32(crcTarget);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// Standard CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createICO(pngBuffers) {
  // Minimal standard ICO container wrapping PNG image(s)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = ICO
  header.writeUInt16LE(1, 4); // Number of images: 1

  const png = pngBuffers[0];
  const dirEntry = Buffer.alloc(16);
  dirEntry[0] = 32; // Width
  dirEntry[1] = 32; // Height
  dirEntry[2] = 0;  // Colors: 0 if >= 8bpp
  dirEntry[3] = 0;  // Reserved
  dirEntry.writeUInt16LE(1, 4);  // Color planes
  dirEntry.writeUInt16LE(32, 6); // Bits per pixel
  dirEntry.writeUInt32LE(png.length, 8); // Image size in bytes
  dirEntry.writeUInt32LE(6 + 16, 12);   // Image offset

  return Buffer.concat([header, dirEntry, png]);
}

const iconsDir = path.resolve('src-tauri', 'icons');
const publicDir = path.resolve('public');

fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const png32 = createShieldPNG(32, 32);
const png128 = createShieldPNG(128, 128);
const png256 = createShieldPNG(256, 256);
const png512 = createShieldPNG(512, 512);

fs.writeFileSync(path.join(iconsDir, '32x32.png'), png32);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), png128);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), png256);
fs.writeFileSync(path.join(iconsDir, 'icon.png'), png512);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), createICO([png32]));
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), png512); // Fallback binary representation

fs.writeFileSync(path.join(publicDir, 'icon.png'), png512);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createICO([png32]));

console.log('Successfully generated all application icons.');
