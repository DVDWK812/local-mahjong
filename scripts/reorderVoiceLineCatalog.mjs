import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, '../src/music/voice_lines');
const GROUP_ORDER = ['personal', 'actions', 'special-game', 'score', 'yakuman', 'regular-yaku', 'special-yaku', 'dora', 'tiles'];
const GROUP_KEY_ORDER = {
  personal: ['flavor.win', 'flavor.lose', 'flavor.close_game', 'game.start', 'game.end', 'result.second_place', 'result.third_place', 'result.fourth_place', 'yaku.tenpai', 'yaku.noten', 'game.draw'],
  actions: ['action.ron', 'action.tsumo', 'action.riichi', 'action.double_riichi', 'action.chi', 'action.pon', 'action.kan', 'action.ankan', 'action.kakan', 'action.nuki'],
};
const PERSONAL_KEYS = new Set(['game.start', 'game.end', 'game.draw', 'result.second_place', 'result.third_place', 'result.fourth_place', 'yaku.tenpai', 'yaku.noten']);
const SETTLEMENT_YAKU = new Set(['yaku.triple_yakuman', 'yaku.quadruple_yakuman', 'yaku.quintuple_yakuman', 'yaku.sextuple_yakuman']);
const YAKUMAN_YAKU = new Set(['yaku.tenhou', 'yaku.chiihou', 'yaku.kokushi_13_wait', 'yaku.suukantsu', 'yaku.junsei_chuuren']);
const REGULAR_YAKU = new Set(['yaku.riichi', 'yaku.ippatsu', 'yaku.chankan', 'yaku.rinshan_kaihou', 'yaku.haitei', 'yaku.houtei', 'yaku.ton', 'yaku.shaa', 'yaku.nan', 'yaku.pei', 'yaku.haku', 'yaku.hatsu', 'yaku.chun', 'yaku.pinfu', 'yaku.tanyao', 'yaku.iipeikou', 'yaku.chanta', 'yaku.honroutou', 'yaku.toitoi', 'yaku.sanankou', 'yaku.sanshoku', 'yaku.ittsu', 'yaku.sankantsu', 'yaku.sanshoku_doukou', 'yaku.junchan', 'yaku.chinitsu', 'yaku.honitsu', 'yaku.chiitoitsu', 'yaku.shousangen', 'yaku.ryanpeikou']);

export function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) { if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; } else if (character === '"') quoted = false; else field += character; continue; }
    if (character === '"') { quoted = true; continue; }
    if (character === ',') { row.push(field); field = ''; continue; }
    if (character === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; continue; }
    field += character;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function escapeCsv(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export function serializeCsv(headers, rows, bom) { return `${bom ? '\uFEFF' : ''}${[headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')}\r\n`; }

export function voiceLineGroup(row) {
  const key = row.key;
  if (key.startsWith('tile.')) return 'tiles';
  if (key === 'yaku.dora' || /^yaku\.dora_(?:\d+|many)$/.test(key)) return 'dora';
  if (row.category === 'flavor' || PERSONAL_KEYS.has(key)) return 'personal';
  if (row.category === 'action') return 'actions';
  if (row.category === 'game') return 'special-game';
  if (row.category === 'score' || SETTLEMENT_YAKU.has(key)) return 'score';
  if (row.category === 'yakuman' || YAKUMAN_YAKU.has(key)) return 'yakuman';
  if (REGULAR_YAKU.has(key)) return 'regular-yaku';
  return 'special-yaku';
}

export function mapRows(headers, values) {
  const keyIndex = headers.indexOf('key');
  if (keyIndex < 0) throw new Error('CSV is missing key column.');
  return values.filter((row) => row.some((cell) => cell !== '')).map((values) => ({ key: values[keyIndex] ?? '', category: values[headers.indexOf('category')] ?? '', values }));
}

export function assertUniqueKeys(rows, label) {
  const seen = new Set();
  for (const row of rows) {
    if (!row.key) throw new Error(`${label} contains an empty key.`);
    if (seen.has(row.key)) throw new Error(`${label} contains duplicate key: ${row.key}`);
    seen.add(row.key);
  }
  return seen;
}

export function reorderMasterRows(rows) {
  assertUniqueKeys(rows, 'Master CSV');
  const indexed = rows.map((row, index) => {
    const groupId = voiceLineGroup(row); const keyOrder = GROUP_KEY_ORDER[groupId]?.indexOf(row.key) ?? -1;
    return { row, index, group: GROUP_ORDER.indexOf(groupId), keyOrder: keyOrder < 0 ? Number.MAX_SAFE_INTEGER : keyOrder };
  });
  if (indexed.some((item) => item.group < 0)) throw new Error('Master CSV contains an unclassified voice line.');
  return indexed.sort((left, right) => left.group - right.group || left.keyOrder - right.keyOrder || left.index - right.index).map((item) => item.row);
}

export function reorderPackRows(rows, masterKeys, label) {
  const keys = assertUniqueKeys(rows, label);
  if (keys.size !== masterKeys.length || masterKeys.some((key) => !keys.has(key))) throw new Error(`${label} key set does not match the master CSV.`);
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return masterKeys.map((key) => byKey.get(key));
}

async function readRows(file) {
  const text = await fs.readFile(file, 'utf8'); const bom = text.startsWith('\uFEFF'); const [headers, ...values] = parseCsv(text.replace(/^\uFEFF/, ''));
  return { headers, rows: mapRows(headers, values), bom };
}

async function writeRows(file, headers, rows, bom) { await fs.writeFile(file, serializeCsv(headers, rows.map((row) => row.values), bom), 'utf8'); }

/** Reorders existing rows only. Pack row values are keyed and copied verbatim. */
export async function reorderVoiceLineCatalog(root = defaultRoot) {
  const masterFile = path.join(root, 'mahjong_voice_lines.csv');
  const master = await readRows(masterFile); const orderedMaster = reorderMasterRows(master.rows); const masterKeys = orderedMaster.map((row) => row.key);
  await writeRows(masterFile, master.headers, orderedMaster, master.bom);
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, entry.name, 'voice_lines.csv');
    try {
      const pack = await readRows(file);
      await writeRows(file, pack.headers, reorderPackRows(pack.rows, masterKeys, `${entry.name}/voice_lines.csv`), pack.bom);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
  }
  return { total: masterKeys.length, groups: Object.fromEntries(GROUP_ORDER.map((group) => [group, orderedMaster.filter((row) => voiceLineGroup(row) === group).length])) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  reorderVoiceLineCatalog().then((result) => console.log(`Reordered ${result.total} VoiceLines.`)).catch((error) => { console.error(error); process.exitCode = 1; });
}
