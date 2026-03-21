#!/usr/bin/env node
// Generates assets/icon.ico (32x32, gold #D4AF37) and assets/icon.png (256x256 minimal PNG)
'use strict';
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

// ── PNG: 256x256 gold square (generated first so ICO can embed it) ────────────
const zlib = require('zlib');

const PNG_W = 256, PNG_H = 256;

const pngSig = Buffer.from([137,80,78,71,13,10,26,10]);

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function crc32(buf) {
  const table = makeCrcTable();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let crcTable = null;
function makeCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c;
  }
  return crcTable;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(PNG_W, 0);
ihdr.writeUInt32BE(PNG_H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const raw = Buffer.alloc((1 + PNG_W * 3) * PNG_H);
for (let y = 0; y < PNG_H; y++) {
  const rowStart = y * (1 + PNG_W * 3);
  raw[rowStart] = 0;
  for (let x = 0; x < PNG_W; x++) {
    const px = rowStart + 1 + x * 3;
    raw[px + 0] = 212; raw[px + 1] = 175; raw[px + 2] = 55;
  }
}
const compressed = zlib.deflateSync(raw);
const pngData = Buffer.concat([pngSig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);

fs.writeFileSync(path.join(assetsDir, 'icon.png'), pngData);
console.log('Created assets/icon.png');

// ── ICO: 256x256 embedding PNG data (Vista ICO format) ───────────────────────
// width=0 and height=0 in the dir entry means 256 in ICO spec
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type = 1 (icon)
icoHeader.writeUInt16LE(1, 4); // count = 1

const dirEntry = Buffer.alloc(16);
dirEntry[0] = 0;       // width: 0 = 256
dirEntry[1] = 0;       // height: 0 = 256
dirEntry[2] = 0;       // color count
dirEntry[3] = 0;       // reserved
dirEntry.writeUInt16LE(1,  4);                // planes
dirEntry.writeUInt16LE(32, 6);                // bit count
dirEntry.writeUInt32LE(pngData.length, 8);    // size of image data
dirEntry.writeUInt32LE(6 + 16,         12);   // offset

const icoFile = Buffer.concat([icoHeader, dirEntry, pngData]);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoFile);
console.log('Created assets/icon.ico');

