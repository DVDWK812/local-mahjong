import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const voiceLinesRoot = process.env.VOICE_PACKS_ROOT
  ? path.resolve(process.env.VOICE_PACKS_ROOT)
  : path.resolve(scriptDirectory, '../src/music/voice_lines');
const requiredColumns = ['key', 'category', 'action', 'line', 'tts_text', 'locale', 'character', 'emotion'];
const packIdPattern = /^[a-z0-9][a-z0-9_-]*$/;
const localePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"') { quoted = true; continue; }
    if (character === ',') { row.push(field); field = ''; continue; }
    if (character === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (character !== '\r') field += character;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvToRows(csvText) {
  const parsed = parseCsv(csvText);
  const headers = (parsed.shift() ?? []).map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header));
  const missing = requiredColumns.filter((column) => !headers.includes(column));
  if (missing.length) throw new Error(`CSV is missing required column(s): ${missing.join(', ')}`);
  return parsed.filter((row) => row.some((value) => value !== '')).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function isValidMeta(meta) {
  return meta && typeof meta === 'object' && !Array.isArray(meta)
    && typeof meta.id === 'string' && packIdPattern.test(meta.id)
    && typeof meta.name === 'string' && meta.name.trim()
    && typeof meta.locale === 'string' && localePattern.test(meta.locale)
    && typeof meta.voiceId === 'string' && meta.voiceId.trim()
    && typeof meta.modelId === 'string' && meta.modelId.trim();
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export async function generateVoicePackIndex(root = voiceLinesRoot) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const packs = [];
  const diagnostics = [];
  const seenIds = new Set();
  for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
    const packDirectory = path.join(root, entry.name);
    const packFile = path.join(packDirectory, 'pack.json');
    const manifestFile = path.join(packDirectory, 'manifest.json');
    const csvFile = path.join(packDirectory, 'voice_lines.csv');
    try {
      const meta = await readJson(packFile);
      if (!isValidMeta(meta)) throw new Error('pack.json has invalid required metadata.');
      if (seenIds.has(meta.id)) throw new Error(`duplicate pack id: ${meta.id}`);
      if (!packIdPattern.test(entry.name)) throw new Error('pack directory name is not a safe pack path.');
      const manifest = await readJson(manifestFile);
      if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('manifest.json must be an object.');
      const rows = csvToRows(await fs.readFile(csvFile, 'utf8'));
      await fs.writeFile(path.join(packDirectory, 'voice_lines.json'), `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
      seenIds.add(meta.id);
      packs.push({ id: meta.id, name: meta.name.trim(), locale: meta.locale, path: entry.name });
    } catch (error) {
      diagnostics.push({ path: entry.name, message: error instanceof Error ? error.message : 'Unknown pack generation error.' });
    }
  }
  const index = { schemaVersion: 1, packs, diagnostics };
  await fs.writeFile(path.join(root, 'voice_packs.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  console.log(`Generated Voice Pack index: ${packs.length} valid pack(s), ${diagnostics.length} skipped.`);
  for (const entry of diagnostics) console.warn(`Skipped Voice Pack ${entry.path}: ${entry.message}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateVoicePackIndex().catch((error) => { console.error(error); process.exitCode = 1; });
}
