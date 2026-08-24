import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { LocalGeneratedVoiceRegistry } from './localGeneratedVoiceRegistry.mjs';

it('generated voice registry is persistent, recovers from invalid JSON, and upserts voice IDs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'voice-registry-'));
  try {
    await writeFile(path.join(root, 'generated_voices.json'), '{not json', 'utf8');
    const registry = new LocalGeneratedVoiceRegistry({ root, now: () => new Date('2026-08-25T00:00:00.000Z') });
    expect(await registry.list()).toEqual([]);
    await registry.upsert({ voiceId: 'voice-clone', name: '克隆', source: 'clone' });
    await registry.upsert({ voiceId: 'voice-design', name: '设计', source: 'design' });
    await registry.upsert({ voiceId: 'voice-clone', name: '更新后的克隆', source: 'clone' });
    const reloaded = new LocalGeneratedVoiceRegistry({ root });
    expect((await reloaded.list())).toHaveLength(2);
    expect((await reloaded.list()).find((voice) => voice.voiceId === 'voice-clone')?.name).toBe('更新后的克隆');
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('imports existing local Packs once, deduplicates voice IDs, and preserves user-created metadata', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'voice-registry-packs-'));
  const writePack = async (id, name, voiceId) => { await mkdir(path.join(root, id)); await writeFile(path.join(root, id, 'pack.json'), JSON.stringify({ id, name, voiceId }), 'utf8'); };
  try {
    await writePack('xiaozhang', '校长', 'voice-shared'); await writePack('mambo', '曼波', 'voice-mambo'); await writePack('yaya', '雅雅', 'voice-shared');
    const registry = new LocalGeneratedVoiceRegistry({ root, now: () => new Date('2026-08-25T00:00:00.000Z') });
    const imported = await registry.list();
    expect(imported).toHaveLength(2);
    expect(imported.find((voice) => voice.voiceId === 'voice-shared')).toMatchObject({ name: '校长', source: 'existing', linkedPackIds: ['xiaozhang', 'yaya'] });
    await registry.upsert({ voiceId: 'voice-shared', name: '清泉少女', source: 'design' });
    expect((await registry.list()).find((voice) => voice.voiceId === 'voice-shared')).toMatchObject({ name: '清泉少女', source: 'design', linkedPackIds: ['xiaozhang', 'yaya'] });
    await rm(path.join(root, 'mambo'), { recursive: true, force: true });
    expect((await registry.list()).some((voice) => voice.voiceId === 'voice-mambo')).toBe(true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
