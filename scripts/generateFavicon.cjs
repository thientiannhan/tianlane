const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeChunk(type, data) {
  const len = data ? data.length : 0;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  if (data) data.copy(chunk, 8);
  const typeAndData = chunk.slice(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function encodePng(width, height, rgbaBuffer) {
  const header = Buffer.from('\x89PNG\r\n\x1a\n', 'binary');
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const rawScanlines = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    rawScanlines[y * (stride + 1)] = 0; // Filter 0 (None)
    rgbaBuffer.copy(rawScanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const idat = writeChunk('IDAT', zlib.deflateSync(rawScanlines, { level: 9 }));
  const iend = writeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([header, writeChunk('IHDR', ihdr), idat, iend]);
}

const logoPath = path.join(__dirname, '../public/tianlan-logo.png');
const srcBuf = fs.readFileSync(logoPath);
let pos = 8;
const idatChunks = [];
while (pos < srcBuf.length) {
  const len = srcBuf.readUInt32BE(pos);
  const type = srcBuf.slice(pos + 4, pos + 8).toString('ascii');
  if (type === 'IDAT') idatChunks.push(srcBuf.slice(pos + 8, pos + 8 + len));
  pos += 12 + len;
}

const raw = zlib.inflateSync(Buffer.concat(idatChunks));
const width = 1536;
const height = 1536;
const bpp = 4;
const stride = width * bpp + 1;
const uncompressed = Buffer.alloc(width * height * 4);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// 1. Defilter PNG scanlines
for (let y = 0; y < height; y++) {
  const filterType = raw[y * stride];
  const scanline = raw.slice(y * stride + 1, (y + 1) * stride);
  const rowStart = y * width * 4;
  const prevRowStart = (y - 1) * width * 4;

  for (let x = 0; x < width * 4; x++) {
    const rawVal = scanline[x];
    const left = x >= bpp ? uncompressed[rowStart + x - bpp] : 0;
    const up = y > 0 ? uncompressed[prevRowStart + x] : 0;
    const upLeft = (y > 0 && x >= bpp) ? uncompressed[prevRowStart + x - bpp] : 0;

    let val = 0;
    if (filterType === 0) val = rawVal;
    else if (filterType === 1) val = (rawVal + left) & 0xff;
    else if (filterType === 2) val = (rawVal + up) & 0xff;
    else if (filterType === 3) val = (rawVal + Math.floor((left + up) / 2)) & 0xff;
    else if (filterType === 4) val = (rawVal + paeth(left, up, upLeft)) & 0xff;

    uncompressed[rowStart + x] = val;
  }
}

// 2. Downsample and apply smooth rounded squircle mask
function generateRounded(targetSize, radius) {
  const outRgba = Buffer.alloc(targetSize * targetSize * 4);

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const srcX0 = Math.floor((x / targetSize) * width);
      const srcX1 = Math.floor(((x + 1) / targetSize) * width);
      const srcY0 = Math.floor((y / targetSize) * height);
      const srcY1 = Math.floor(((y + 1) / targetSize) * height);

      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
      const stepX = Math.max(1, Math.floor((srcX1 - srcX0) / 4));
      const stepY = Math.max(1, Math.floor((srcY1 - srcY0) / 4));

      for (let sy = srcY0; sy < srcY1; sy += stepY) {
        for (let sx = srcX0; sx < srcX1; sx += stepX) {
          const idx = (sy * width + sx) * 4;
          sumR += uncompressed[idx];
          sumG += uncompressed[idx + 1];
          sumB += uncompressed[idx + 2];
          sumA += uncompressed[idx + 3];
          count++;
        }
      }

      let r = count > 0 ? Math.round(sumR / count) : 0;
      let g = count > 0 ? Math.round(sumG / count) : 0;
      let b = count > 0 ? Math.round(sumB / count) : 0;
      let a = count > 0 ? Math.round(sumA / count) : 0;

      // Distance to corner (rounded corners)
      let dx = 0;
      let dy = 0;
      if (x < radius) dx = radius - x;
      else if (x >= targetSize - radius) dx = x - (targetSize - radius - 1);

      if (y < radius) dy = radius - y;
      else if (y >= targetSize - radius) dy = y - (targetSize - radius - 1);

      if (dx > 0 && dy > 0) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius + 0.5) {
          a = 0;
        } else if (dist > radius - 0.5) {
          const factor = 1 - (dist - (radius - 0.5));
          a = Math.round(a * Math.max(0, Math.min(1, factor)));
        }
      }

      const outIdx = (y * targetSize + x) * 4;
      outRgba[outIdx] = r;
      outRgba[outIdx + 1] = g;
      outRgba[outIdx + 2] = b;
      outRgba[outIdx + 3] = a;
    }
  }

  return { png: encodePng(targetSize, targetSize, outRgba), size: targetSize };
}

// Generate multiple sizes
const res192 = generateRounded(192, 42);
fs.writeFileSync(path.join(__dirname, '../public/favicon.png'), res192.png);
fs.writeFileSync(path.join(__dirname, '../public/favicon-192.png'), res192.png);
console.log('Saved public/favicon.png (' + res192.png.length + ' bytes)');

const res64 = generateRounded(64, 14);
fs.writeFileSync(path.join(__dirname, '../public/favicon-64.png'), res64.png);

const res48 = generateRounded(48, 11);
fs.writeFileSync(path.join(__dirname, '../public/favicon-48.png'), res48.png);

const res32 = generateRounded(32, 7);
fs.writeFileSync(path.join(__dirname, '../public/favicon-32.png'), res32.png);
console.log('Saved public/favicon-32.png (' + res32.png.length + ' bytes)');

const res16 = generateRounded(16, 4);
fs.writeFileSync(path.join(__dirname, '../public/favicon-16.png'), res16.png);
console.log('Saved public/favicon-16.png (' + res16.png.length + ' bytes)');

// Build valid ICO containing 48, 32, 16
function createIco(images) {
  const count = images.length;
  const headerLen = 6;
  const dirEntryLen = 16;
  let offset = headerLen + count * dirEntryLen;

  const header = Buffer.alloc(headerLen);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4); // count

  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(dirEntryLen);
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // width
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // height
    entry.writeUInt8(0, 2); // palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.png.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // image offset
    entries.push(entry);
    offset += img.png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map(i => i.png)]);
}

const icoBuf = createIco([res48, res32, res16]);
fs.writeFileSync(path.join(__dirname, '../public/favicon.ico'), icoBuf);
console.log('Saved public/favicon.ico (' + icoBuf.length + ' bytes)');
