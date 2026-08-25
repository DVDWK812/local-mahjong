import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, serializeCsv } from './reorderVoiceLineCatalog.mjs';

export const DEPRECATED_VOICE_LINE_KEYS = Object.freeze([
  'yaku.chinroutou',
  'yaku.honroutou_variant',
  'yaku.honroutou_duplicate',
]);

const deprecatedKeys = new Set(DEPRECATED_VOICE_LINE_KEYS);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, '../src/music/voice_lines');

function removeKeyedRows(text, label) {
  const bom = text.startsWith('\uFEFF');
  const [headers, ...rows] = parseCsv(text.replace(/^\uFEFF/, ''));
  const keyIndex = headers.indexOf('key');
  if (keyIndex < 0) throw new Error(`${label} is missing its key column.`);
  const removed = rows.filter((row) => deprecatedKeys.has(row[keyIndex] ?? '')).map((row) => row[keyIndex]);
  return { text: serializeCsv(headers, rows.filter((row) => !deprecatedKeys.has(row[keyIndex] ?? '')), bom), removed };
}

function removeKeyedMetadata(value) {
  if (Array.isArray(value)) return value.filter((entry) => !deprecatedKeys.has(entry?.key));
  if (!value || typeof value !== 'object') return value;
  const next = { ...value };
  for (const key of DEPRECATED_VOICE_LINE_KEYS) delete next[key];
  if (next.voices && typeof next.voices === 'object' && !Array.isArray(next.voices)) {
    next.voices = { ...next.voices };
    for (const key of DEPRECATED_VOICE_LINE_KEYS) delete next.voices[key];
  }
  for (const property of ['items', 'failed', 'entries', 'records']) {
    if (Array.isArray(next[property])) next[property] = next[property].filter((entry) => !deprecatedKeys.has(entry?.key));
  }
  return next;
}

async function updateJson(file) {
  let parsed;
  try { parsed = JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error?.code === 'ENOENT') return; throw error; }
  const updated = removeKeyedMetadata(parsed);
  if (JSON.stringify(updated) !== JSON.stringify(parsed)) await fs.writeFile(file, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
}

async function updateCsv(file, required) {
  let text;
  try { text = await fs.readFile(file, 'utf8'); } catch (error) { if (error?.code === 'ENOENT' && !required) return []; throw error; }
  const updated = removeKeyedRows(text, file);
  if (required && updated.removed.length !== 0 && updated.removed.length !== DEPRECATED_VOICE_LINE_KEYS.length) throw new Error(`${file} contains only part of the deprecated VoiceLine key set.`);
  if (updated.removed.length) await fs.writeFile(file, updated.text, 'utf8');
  return updated.removed;
}

/** Removes only confirmed redundant keys from source rows, pack metadata, and their three derived MP3s. */
export async function removeDeprecatedVoiceLines(root = defaultRoot) {
  const masterRemoved = await updateCsv(path.join(root, 'mahjong_voice_lines.csv'), true);
  // This compatibility sheet has historically mirrored the master key set.
  await updateCsv(path.join(root, 'mahjong_voice_lines_xiaozhang.csv'), false);
  const packs = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packDirectory = path.join(root, entry.name);
    try { await fs.access(path.join(packDirectory, 'pack.json')); } catch { continue; }
    const removed = await updateCsv(path.join(packDirectory, 'voice_lines.csv'), true);
    await Promise.all(['manifest.json', '.voice_cache.json', 'generation_log.json', 'failed.json'].map((name) => updateJson(path.join(packDirectory, name))));
    await Promise.all(DEPRECATED_VOICE_LINE_KEYS.map((key) => fs.rm(path.join(packDirectory, 'audio', `${key.replaceAll('.', '_')}.mp3`), { force: true })));
    packs.push({ id: entry.name, removed });
  }
  return { masterRemoved, packs };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  removeDeprecatedVoiceLines().then((result) => console.log(`Removed ${result.masterRemoved.length} deprecated VoiceLines from ${result.packs.length} pack(s).`)).catch((error) => { console.error(error); process.exitCode = 1; });
}
