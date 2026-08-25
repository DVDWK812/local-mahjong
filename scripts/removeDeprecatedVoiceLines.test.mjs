import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEPRECATED_VOICE_LINE_KEYS, removeDeprecatedVoiceLines } from './removeDeprecatedVoiceLines.mjs';

const roots = [];
const retainedKeys = ['yakuman.chinroutou', 'yaku.honroutou'];
const header = 'key,category,action,line,tts_text,locale,character,emotion';
const rowFor = (key) => `${key},yaku,${key.split('.')[1]},${key.includes('chinroutou') ? '清老头' : '混老头'},TTS-${key},zh-CN,test,neutral`;

afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe('removeDeprecatedVoiceLines', () => {
  it('removes only the three confirmed redundant keys while retaining all other rows, metadata, and audio', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-removal-')); roots.push(root);
    const keys = [...retainedKeys, ...DEPRECATED_VOICE_LINE_KEYS];
    const csv = `${header}\n${keys.map(rowFor).join('\n')}\n`;
    await fs.writeFile(path.join(root, 'mahjong_voice_lines.csv'), csv, 'utf8');
    await fs.writeFile(path.join(root, 'mahjong_voice_lines_xiaozhang.csv'), csv, 'utf8');
    const pack = path.join(root, 'custom'); const audio = path.join(pack, 'audio');
    await fs.mkdir(audio, { recursive: true });
    await fs.writeFile(path.join(pack, 'pack.json'), JSON.stringify({ id: 'custom', name: '测试', locale: 'zh-CN', voiceId: 'voice', modelId: 'model' }), 'utf8');
    await fs.writeFile(path.join(pack, 'voice_lines.csv'), csv.replaceAll(',test,neutral', ',custom,neutral'), 'utf8');
    await fs.writeFile(path.join(pack, 'manifest.json'), JSON.stringify({ character: 'custom', voices: Object.fromEntries(keys.map((key) => [key, { file: `audio/${key.replaceAll('.', '_')}.mp3` }])) }), 'utf8');
    await fs.writeFile(path.join(pack, '.voice_cache.json'), JSON.stringify(Object.fromEntries(keys.map((key) => [key, { key, file: `${key.replaceAll('.', '_')}.mp3` }])), null, 2), 'utf8');
    await fs.writeFile(path.join(pack, 'generation_log.json'), JSON.stringify(keys.map((key) => ({ key, status: 'generated' })), null, 2), 'utf8');
    await fs.writeFile(path.join(pack, 'failed.json'), JSON.stringify({ failed: DEPRECATED_VOICE_LINE_KEYS.map((key) => ({ key })) }), 'utf8');
    await Promise.all(keys.map((key) => fs.writeFile(path.join(audio, `${key.replaceAll('.', '_')}.mp3`), key, 'utf8')));

    const result = await removeDeprecatedVoiceLines(root);
    expect(result.masterRemoved).toEqual(DEPRECATED_VOICE_LINE_KEYS);
    expect(result.packs).toEqual([{ id: 'custom', removed: DEPRECATED_VOICE_LINE_KEYS }]);
    for (const file of [path.join(root, 'mahjong_voice_lines.csv'), path.join(root, 'mahjong_voice_lines_xiaozhang.csv'), path.join(pack, 'voice_lines.csv')]) {
      const content = await fs.readFile(file, 'utf8');
      for (const key of DEPRECATED_VOICE_LINE_KEYS) expect(content).not.toContain(key);
      for (const key of retainedKeys) expect(content).toContain(key);
    }
    for (const file of ['manifest.json', '.voice_cache.json', 'generation_log.json', 'failed.json']) {
      const content = await fs.readFile(path.join(pack, file), 'utf8');
      for (const key of DEPRECATED_VOICE_LINE_KEYS) expect(content).not.toContain(key);
    }
    for (const key of DEPRECATED_VOICE_LINE_KEYS) await expect(fs.access(path.join(audio, `${key.replaceAll('.', '_')}.mp3`))).rejects.toMatchObject({ code: 'ENOENT' });
    for (const key of retainedKeys) expect(await fs.readFile(path.join(audio, `${key.replaceAll('.', '_')}.mp3`), 'utf8')).toBe(key);
  });
});
