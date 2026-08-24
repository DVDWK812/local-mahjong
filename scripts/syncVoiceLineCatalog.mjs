import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TILE_KEY = /^tile\.(?:m|p|s)[1-9]$|^tile\.z[1-7]$/;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const generationContract = JSON.parse(readFileSync(path.join(scriptDirectory, '../src/audio/voice/voiceSynthesisSettings.contract.json'), 'utf8'));
const GENERATION_COLUMNS = generationContract.columns;
const GENERATION_DEFAULTS = GENERATION_COLUMNS.map((column) => String(generationContract.defaults[column]));

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

/** Adds the stable generation fields once, without touching any existing cells. */
function ensureGenerationColumns(headers, rows) {
  let changed = false;
  for (const [index, column] of GENERATION_COLUMNS.entries()) {
    if (headers.includes(column)) continue;
    headers.push(column);
    for (const row of rows) row.push(GENERATION_DEFAULTS[index]);
    changed = true;
  }
  return changed;
}

/** Adds only missing tile catalogue rows, preserving every existing user-owned cell verbatim. */
export async function syncVoiceLineCatalog(root) {
  const masterPath = path.join(root, 'mahjong_voice_lines.csv');
  let masterText;
  try { masterText = await fs.readFile(masterPath, 'utf8'); } catch { return 0; }
  const masterBom = masterText.startsWith('\uFEFF'); const [masterHeaders, ...masterRows] = parse(masterText.replace(/^\uFEFF/, ''));
  const masterChanged = ensureGenerationColumns(masterHeaders, masterRows);
  if (masterChanged) await fs.writeFile(masterPath, serialize(masterHeaders, masterRows, masterBom), 'utf8');
  const keyIndex = masterHeaders.indexOf('key');
  if (keyIndex < 0) return 0;
  const additions = masterRows.filter((row) => TILE_KEY.test(row[keyIndex] ?? ''));
  if (additions.length !== 0 && additions.length !== 34) throw new Error('Tile voice catalogue must contain exactly 34 entries.');
  let changed = 0;
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, entry.name, 'voice_lines.csv');
    let text;
    try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
    const bom = text.startsWith('\uFEFF'); const [headers, ...rows] = parse(text.replace(/^\uFEFF/, ''));
    const settingsChanged = ensureGenerationColumns(headers, rows);
    const packKey = headers.indexOf('key');
    if (packKey < 0) continue;
    const existing = new Set(rows.map((row) => row[packKey] ?? ''));
    const missing = additions.filter((row) => !existing.has(row[keyIndex] ?? ''));
    if (!missing.length && !settingsChanged) continue;
    const values = missing.map((source) => headers.map((header) => source[masterHeaders.indexOf(header)] ?? ''));
    await fs.writeFile(file, serialize(headers, [...rows, ...values], bom), 'utf8');
    changed += missing.length;
  }
  return changed;
}
