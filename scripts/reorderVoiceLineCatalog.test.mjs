import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapRows, parseCsv, reorderMasterRows, reorderPackRows } from './reorderVoiceLineCatalog.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const catalogRoot = path.resolve(scriptDirectory, '../src/music/voice_lines');
const masterFile = path.join(catalogRoot, 'mahjong_voice_lines.csv');

async function readRows(file) {
  const text = await fs.readFile(file, 'utf8');
  const [headers, ...values] = parseCsv(text.replace(/^\uFEFF/, ''));
  return mapRows(headers, values);
}

function valuesByKey(rows) {
  return new Map(rows.map((row) => [row.key, [...row.values]]));
}

function expectReorderToPreserveEveryRow(before, after) {
  expect(after).toHaveLength(before.length);
  expect(new Set(after.map((row) => row.key)).size).toBe(after.length);
  expect(new Set(after.map((row) => row.key))).toEqual(new Set(before.map((row) => row.key)));
  const original = valuesByKey(before);
  for (const row of after) expect(row.values).toEqual(original.get(row.key));
}

describe('reorderVoiceLineCatalog', () => {
  it('reorders the real master catalog without changing any row content or key membership', async () => {
    const before = await readRows(masterFile);
    const after = reorderMasterRows(before);

    expectReorderToPreserveEveryRow(before, after);
    expect(after).toHaveLength(145);
    expect(after.map((row) => row.key).slice(-34)).toEqual([
      ...Array.from({ length: 9 }, (_, index) => `tile.m${index + 1}`),
      ...Array.from({ length: 9 }, (_, index) => `tile.p${index + 1}`),
      ...Array.from({ length: 9 }, (_, index) => `tile.s${index + 1}`),
      ...Array.from({ length: 7 }, (_, index) => `tile.z${index + 1}`),
    ]);
  });

  it('uses master key order for every pack while preserving each pack\'s custom row values', async () => {
    const master = reorderMasterRows(await readRows(masterFile));
    const masterKeys = master.map((row) => row.key);
    const packs = (await fs.readdir(catalogRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());

    for (const pack of packs) {
      const file = path.join(catalogRoot, pack.name, 'voice_lines.csv');
      try {
        const before = await readRows(file);
        const after = reorderPackRows(before, masterKeys, `${pack.name}/voice_lines.csv`);
        expectReorderToPreserveEveryRow(before, after);
        expect(after.map((row) => row.key)).toEqual(masterKeys);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  });
});
