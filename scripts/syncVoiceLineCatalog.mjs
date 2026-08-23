import { promises as fs } from 'node:fs';
import path from 'node:path';

const TILE_KEY = /^tile\.(?:m|p|s)[1-9]$|^tile\.z[1-7]$/;

function parse(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) { if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; } else if (character === '"') quoted = false; else field += character; continue; }
    if (character === '"') { quoted = true; continue; }
    if (character === ',') { row.push(field); field = ''; continue; }
    if (character === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; continue; }
    field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function escape(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function serialize(headers, rows, bom) { return `${bom ? '\uFEFF' : ''}${[headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')}\r\n`; }

/** Adds only missing tile catalogue rows, preserving every existing user-owned cell verbatim. */
export async function syncVoiceLineCatalog(root) {
  const masterPath = path.join(root, 'mahjong_voice_lines.csv');
  let masterText;
  try { masterText = await fs.readFile(masterPath, 'utf8'); } catch { return 0; }
  const [masterHeaders, ...masterRows] = parse(masterText.replace(/^\uFEFF/, ''));
  const keyIndex = masterHeaders.indexOf('key');
  if (keyIndex < 0) return 0;
  const additions = masterRows.filter((row) => TILE_KEY.test(row[keyIndex] ?? ''));
  if (additions.length === 0) return 0;
  if (additions.length !== 34) throw new Error('Tile voice catalogue must contain exactly 34 entries.');
  let changed = 0;
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, entry.name, 'voice_lines.csv');
    let text;
    try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
    const bom = text.startsWith('\uFEFF'); const [headers, ...rows] = parse(text.replace(/^\uFEFF/, ''));
    const packKey = headers.indexOf('key');
    if (packKey < 0) continue;
    const existing = new Set(rows.map((row) => row[packKey] ?? ''));
    const missing = additions.filter((row) => !existing.has(row[keyIndex] ?? ''));
    if (!missing.length) continue;
    const values = missing.map((source) => headers.map((header) => source[masterHeaders.indexOf(header)] ?? ''));
    await fs.writeFile(file, serialize(headers, [...rows, ...values], bom), 'utf8');
    changed += missing.length;
  }
  return changed;
}
