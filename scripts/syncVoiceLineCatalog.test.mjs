import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncVoiceLineCatalog } from './syncVoiceLineCatalog.mjs';

const roots = [];
const keys = ['m','p','s'].flatMap((suit) => Array.from({ length: 9 }, (_, index) => `tile.${suit}${index + 1}`)).concat(Array.from({ length: 7 }, (_, index) => `tile.z${index + 1}`));
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe('syncVoiceLineCatalog', () => {
  it('only appends missing 34 tile lines and leaves all existing user edits intact', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-catalog-')); roots.push(root);
    const header = 'key,category,action,line,tts_text,locale,character,emotion';
    await fs.writeFile(path.join(root, 'mahjong_voice_lines.csv'), `${header}\nlegacy.one,action,one,母版,母版,zh-CN,default,neutral\n${keys.map((key) => `${key},tile,${key.slice(5)},${key},${key},zh-CN,default,neutral`).join('\n')}\n`, 'utf8');
    await fs.mkdir(path.join(root, 'custom'));
    await fs.writeFile(path.join(root, 'custom', 'voice_lines.csv'), `${header}\nlegacy.one,action,one,用户编辑,用户发音,zh-CN,custom,neutral\n`, 'utf8');
    expect(await syncVoiceLineCatalog(root)).toBe(34);
    const rows = await fs.readFile(path.join(root, 'custom', 'voice_lines.csv'), 'utf8');
    expect(rows).toContain('legacy.one,action,one,用户编辑,用户发音,zh-CN,custom,neutral');
    expect(rows.split(/\r?\n/).filter(Boolean)).toHaveLength(36);
    expect(await syncVoiceLineCatalog(root)).toBe(0);
  });
});
