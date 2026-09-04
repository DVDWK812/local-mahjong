import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const sourceDirectory = 'src/assets/tiles';
export const outputDirectory = 'src/presentation3d/assets/tiles/faces-transparent';
const tileFileName = /^(?:[mps][1-9]|z[1-7]|placeholder)\.png$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Audited from the common 74 × 104 source artwork. The old tile body, border,
// corners, and drop shadow all live outside this physical print area.
export const TILE_GLYPH_PRINT_REGION = Object.freeze({ left: 8, top: 10, right: 66, bottom: 94 });
const MATTE_DISTANCE_START = 9;
const MATTE_DISTANCE_END = 18;
const FULL_INK_DISTANCE = 300;
const MIN_VISIBLE_ALPHA = 9;
const INTENTIONALLY_BLANK_GLYPH_FILES = new Set(['z5.png']);

function readChunks(bytes) {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('Expected PNG signature.');
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += length + 12;
  }
  return chunks;
}

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= upDistance && leftDistance <= upperLeftDistance
    ? left
    : upDistance <= upperLeftDistance ? up : upperLeft;
}

export function decodeRgbaPng(bytes) {
  const chunks = readChunks(bytes);
  const header = chunks.find((chunk) => chunk.type === 'IHDR')?.data;
  if (!header) throw new Error('PNG is missing IHDR.');
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  if (header[8] !== 8 || header[9] !== 6 || header[10] !== 0 || header[11] !== 0) {
    throw new Error('Transparent tile generation only supports non-interlaced RGBA PNG assets.');
  }
  const stride = width * 4;
  const encoded = Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data));
  const filtered = inflateSync(encoded);
  const pixels = Buffer.alloc(stride * height);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[inputOffset++];
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = filtered[inputOffset++];
      const left = x >= 4 ? pixels[rowOffset + x - 4] : 0;
      const up = y > 0 ? pixels[rowOffset - stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[rowOffset - stride + x - 4] : 0;
      const adjustment = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : (() => { throw new Error(`Unsupported PNG filter ${filter}.`); })();
      pixels[rowOffset + x] = (value + adjustment) & 0xff;
    }
  }
  return { width, height, pixels };
}

function paperColorFor(pixels, width, height) {
  const colorCounts = new Map();
  const { left, top, right, bottom } = TILE_GLYPH_PRINT_REGION;
  for (let y = top; y < Math.min(bottom, height); y += 1) {
    for (let x = left; x < Math.min(right, width); x += 1) {
      const offset = (y * width + x) * 4;
      const key = `${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`;
      colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
    }
  }
  // The old PNG is a composited card: its paper color is the dominant exact
  // interior color even on dense p9/s9 artwork, unlike side gutters that may
  // themselves be covered by a glyph.
  const [paperKey] = [...colorCounts.entries()]
    .sort((left, right) => right[1] - left[1])[0] ?? [];
  if (!paperKey) throw new Error('Could not sample the source tile paper color.');
  return paperKey.split(',').map(Number);
}

function smoothstep(start, end, value) {
  const progress = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return progress * progress * (3 - 2 * progress);
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function isInsidePrintRegion(x, y) {
  const { left, top, right, bottom } = TILE_GLYPH_PRINT_REGION;
  return x >= left && x < right && y >= top && y < bottom;
}

/**
 * Extracts only ink from the old composited PNG. This deliberately does not
 * color-key "white": it first excludes the physical card body, then measures
 * each remaining pixel against that asset's sampled paper matte. Partial-alpha
 * pixels are de-matted back to foreground ink so their old white matte cannot
 * form a halo over the 3D ivory material.
 */
export function extractTileGlyph(pixels, width, height) {
  const output = Buffer.alloc(pixels.length);
  const paper = paperColorFor(pixels, width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isInsidePrintRegion(x, y)) continue;
      const offset = (y * width + x) * 4;
      const sourceAlpha = pixels[offset + 3] / 255;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const distance = Math.hypot(red - paper[0], green - paper[1], blue - paper[2]);
      const coverage = Math.min(1, distance / FULL_INK_DISTANCE);
      const alpha = sourceAlpha
        * smoothstep(MATTE_DISTANCE_START, MATTE_DISTANCE_END, distance)
        * coverage;
      const alphaByte = Math.round(alpha * 255);
      if (alphaByte < MIN_VISIBLE_ALPHA) continue;

      // c = a * ink + (1 - a) * paper; solve for ink before storing straight alpha.
      output[offset] = clampChannel((red - paper[0] * (1 - alpha)) / alpha);
      output[offset + 1] = clampChannel((green - paper[1] * (1 - alpha)) / alpha);
      output[offset + 2] = clampChannel((blue - paper[2] * (1 - alpha)) / alpha);
      output[offset + 3] = alphaByte;
    }
  }
  return { pixels: output, paper };
}

export function inspectTileGlyph({ width, height, pixels }) {
  let alphaPixelCount = 0;
  let outsidePrintRegionAlphaCount = 0;
  let maxComponentPixels = 0;
  const visited = new Uint8Array(width * height);
  const indexFor = (x, y) => y * width + x;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = indexFor(x, y);
      if (pixels[index * 4 + 3] > 0) {
        alphaPixelCount += 1;
        if (!isInsidePrintRegion(x, y)) outsidePrintRegionAlphaCount += 1;
      }
      if (visited[index] || pixels[index * 4 + 3] < MIN_VISIBLE_ALPHA) continue;
      let componentPixels = 0;
      const queue = [index];
      visited[index] = 1;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        componentPixels += 1;
        const currentX = current % width;
        const currentY = Math.floor(current / width);
        for (const [nextX, nextY] of [[currentX - 1, currentY], [currentX + 1, currentY], [currentX, currentY - 1], [currentX, currentY + 1]]) {
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = indexFor(nextX, nextY);
          if (visited[next] || pixels[next * 4 + 3] < MIN_VISIBLE_ALPHA) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
      maxComponentPixels = Math.max(maxComponentPixels, componentPixels);
    }
  }
  return { alphaPixelCount, outsidePrintRegionAlphaCount, maxComponentPixels };
}

export function assertTileGlyphAsset(fileName, asset) {
  const { width, height } = asset;
  const inspection = inspectTileGlyph(asset);
  if (width !== 74 || height !== 104) throw new Error(`${fileName}: expected 74 × 104 RGBA glyph asset.`);
  if (inspection.outsidePrintRegionAlphaCount !== 0) throw new Error(`${fileName}: ink escaped the print region.`);
  if (!INTENTIONALLY_BLANK_GLYPH_FILES.has(fileName) && inspection.alphaPixelCount < 80) {
    throw new Error(`${fileName}: no usable glyph pixels were extracted.`);
  }
  if (inspection.maxComponentPixels > 3600) {
    throw new Error(`${fileName}: detected a card-body silhouette rather than isolated ink.`);
  }
  return inspection;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
  return result;
}

export function encodeRgbaPng(width, height, pixels) {
  const stride = width * 4;
  const filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const targetOffset = y * (stride + 1);
    filtered[targetOffset] = 0;
    pixels.copy(filtered, targetOffset + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(filtered)), chunk('IEND', Buffer.alloc(0))]);
}

export function generateTransparentTileFaces({ source = sourceDirectory, output = outputDirectory } = {}) {
  mkdirSync(output, { recursive: true });
  const inspections = [];
  for (const fileName of readdirSync(source).filter((name) => tileFileName.test(name))) {
    const { width, height, pixels } = decodeRgbaPng(readFileSync(join(source, fileName)));
    const extracted = extractTileGlyph(pixels, width, height);
    const asset = { width, height, pixels: extracted.pixels };
    inspections.push({ fileName, paper: extracted.paper, ...assertTileGlyphAsset(fileName, asset) });
    writeFileSync(join(output, basename(fileName)), encodeRgbaPng(width, height, extracted.pixels));
  }
  return inspections;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inspections = generateTransparentTileFaces();
  console.log(`Generated ${inspections.length} ink-only transparent tile glyph assets.`);
}
