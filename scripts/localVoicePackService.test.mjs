import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalVoicePackService, VoicePackServiceError, renameWithWindowsRetries } from './localVoicePackService.mjs';

const temporaryRoots = [];
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mahjong-voice-pack-')); temporaryRoots.push(root);
  const voiceRoot = path.join(root, 'voice_lines'); await fs.mkdir(voiceRoot);
  const master = path.join(voiceRoot, 'mahjong_voice_lines.csv');
  const rows = ['key,category,action,line,tts_text,locale,character,emotion'];
  for (let index = 0; index < 145; index += 1) rows.push(`action.test_${index},action,test,测试,测试,zh-CN,default,firm`);
  await fs.writeFile(master, `${rows.join('\n')}\n`, 'utf8');
  return { root: voiceRoot, master, service: new LocalVoicePackService({ root: voiceRoot, masterCsv: master, now: () => new Date('2026-08-22T00:00:00Z') }) };
}
afterEach(async () => { await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe('LocalVoicePackService', () => {
  it('retries transient Windows EPERM locks before a pack deletion rename', async () => {
    let attempts = 0; const delays = [];
    await renameWithWindowsRetries({ rename: async () => { attempts += 1; if (attempts < 3) { const error = new Error('busy'); error.code = 'EPERM'; throw error; } } }, 'from', 'to', async (delay) => { delays.push(delay); });
    expect(attempts).toBe(3); expect(delays).toEqual([100, 200]);
  });

  it('原子创建标准 Pack，复制 145 条母版且生成可发现 index', async () => {
    const { root, master, service } = await fixture();
    const result = await service.createPack({ displayName: '冷静女声', voiceId: 'voice-id-2', modelId: 'fishaudio-s21pro-flash' });
    expect(result).toMatchObject({ pack: { id: 'voice-20260822-001', name: '冷静女声', locale: 'zh-CN' }, lineCount: 145 });
    const created = path.join(root, result.pack.id);
    expect(JSON.parse(await fs.readFile(path.join(created, 'pack.json'), 'utf8'))).toMatchObject({ id: result.pack.id, name: '冷静女声', provider: 'fish-audio', voiceId: 'voice-id-2', modelId: 'fishaudio-s21pro-flash', version: 1 });
    expect(await fs.readFile(path.join(created, 'voice_lines.csv'), 'utf8')).toBe(await fs.readFile(master, 'utf8'));
    expect(JSON.parse(await fs.readFile(path.join(created, 'manifest.json'), 'utf8'))).toEqual({ character: result.pack.id, voiceId: 'voice-id-2', voices: {} });
    expect(await fs.readdir(path.join(created, 'audio'))).toEqual([]);
    expect(await service.listPacks()).toContainEqual(result.pack);
    const detail = await service.getPack(result.pack.id);
    expect(detail).toMatchObject({
      meta: { id: result.pack.id, name: '冷静女声', voiceId: 'voice-id-2' },
      manifest: { voices: {} }, generationCache: {}, failedKeys: [],
    });
    expect(detail.voiceLines).toHaveLength(145);
  });

  it('只生成安全 ASCII ID，重复创建使用安全后缀', async () => {
    const { service } = await fixture();
    expect((await service.createPack({ displayName: 'Test Voice', voiceId: 'voice-a', modelId: 'fishaudio-s21pro-flash' })).pack.id).toBe('test-voice-001');
    expect((await service.createPack({ displayName: 'Test Voice', voiceId: 'voice-b', modelId: 'fishaudio-s21pro-flash' })).pack.id).toBe('test-voice-002');
    await expect(service.createPack({ displayName: '../escape', voiceId: 'voice-c', modelId: 'fishaudio-s21pro-flash' })).rejects.toBeInstanceOf(VoicePackServiceError);
  });

  it('空字段、缺失母版和创建失败都不会留下半成品目录', async () => {
    const { root, service } = await fixture();
    await expect(service.createPack({ displayName: '', voiceId: 'voice', modelId: 'fishaudio-s21pro-flash' })).rejects.toBeInstanceOf(VoicePackServiceError);
    await expect(service.createPack({ displayName: '角色', voiceId: '', modelId: 'fishaudio-s21pro-flash' })).rejects.toBeInstanceOf(VoicePackServiceError);
    await expect(service.createPack({ displayName: '角色', voiceId: 'voice', modelId: '' })).rejects.toThrow('必须选择');
    const broken = new LocalVoicePackService({ root, masterCsv: path.join(root, 'missing.csv') });
    await expect(broken.createPack({ displayName: '不会创建', voiceId: 'voice', modelId: 'fishaudio-s21pro-flash' })).rejects.toThrow();
    expect((await fs.readdir(root)).filter((name) => name.includes('creating'))).toEqual([]);
  });

  it('索引拒绝无效母版时回滚已原子移动的 Pack', async () => {
    const { root, master, service } = await fixture();
    await fs.writeFile(master, 'key,line\naction.invalid,测试\n', 'utf8');
    await expect(service.createPack({ displayName: '索引失败', voiceId: 'voice', modelId: 'fishaudio-s21pro-flash' })).rejects.toThrow('索引刷新失败');
    expect((await fs.readdir(root)).filter((name) => name === 'voice-20260822-001')).toEqual([]);
  });

  it('只解析 manifest 明确声明的 MP3，拒绝路径穿越和未声明文件', async () => {
    const { service, root } = await fixture();
    const created = await service.createPack({ displayName: '试听', voiceId: 'voice-test', modelId: 'fishaudio-s21pro-flash' });
    const audio = path.join(root, created.pack.id, 'audio', 'action_riichi.mp3');
    await fs.writeFile(audio, 'ID3 test', 'utf8');
    const manifestFile = path.join(root, created.pack.id, 'manifest.json');
    await fs.writeFile(manifestFile, JSON.stringify({ character: created.pack.id, voiceId: 'voice-test', voices: { 'action.riichi': { file: 'audio/action_riichi.mp3' } } }), 'utf8');
    await expect(service.getAudioFile(created.pack.id, 'action_riichi.mp3')).resolves.toBe(audio);
    await expect(service.getAudioFile(created.pack.id, '../secret.mp3')).rejects.toThrow('文件名无效');
    await expect(service.getAudioFile(created.pack.id, 'unlisted.mp3')).rejects.toThrow('未找到');
  });

  it('删除用户 Pack 后立即重建索引；内置校长角色始终受服务端保护', async () => {
    const { service, root } = await fixture();
    const created = await service.createPack({ displayName: '测试删除', voiceId: 'voice-delete', modelId: 'fishaudio-s21pro-flash' });
    await fs.writeFile(path.join(root, created.pack.id, 'audio', 'action_riichi.mp3'), 'ID3 test', 'utf8');
    await expect(service.deletePack(created.pack.id)).resolves.toEqual({ deletedPackId: created.pack.id });
    await expect(fs.access(path.join(root, created.pack.id))).rejects.toThrow();
    expect(await service.listPacks()).not.toContainEqual(expect.objectContaining({ id: created.pack.id }));
    await expect(service.deletePack('xiaozhang')).rejects.toThrow('内置角色无法删除');
  });

  it('EPERM rename 重试后仍可完成 Pack 删除', async () => {
    const { service, root, master } = await fixture();
    const created = await service.createPack({ displayName: '重试删除', voiceId: 'voice-retry', modelId: 'model' });
    let renames = 0; const retrying = new LocalVoicePackService({ root, masterCsv: master, sleep: async () => undefined, indexGenerator: async () => undefined, fileSystem: {
      stat: fs.stat,
      rename: async (...args) => { renames += 1; if (renames < 3) { const error = new Error('locked'); error.code = 'EPERM'; throw error; } return fs.rename(...args); },
      rm: fs.rm,
    } });
    await expect(retrying.deletePack(created.pack.id)).resolves.toEqual({ deletedPackId: created.pack.id });
    expect(renames).toBe(3);
  });

  it('EPERM rename 会 fallback 到 fs.rm；仍被占用时返回 PACK_IN_USE', async () => {
    const { service, root, master } = await fixture();
    const fallback = await service.createPack({ displayName: 'Fallback 删除', voiceId: 'voice-fallback', modelId: 'model' });
    const lockedRename = async () => { const error = new Error('locked'); error.code = 'EPERM'; throw error; };
    const fallbackService = new LocalVoicePackService({ root, masterCsv: master, sleep: async () => undefined, indexGenerator: async () => undefined, fileSystem: { stat: fs.stat, rename: lockedRename, rm: fs.rm } });
    await expect(fallbackService.deletePack(fallback.pack.id)).resolves.toEqual({ deletedPackId: fallback.pack.id });
    await expect(fs.access(path.join(root, fallback.pack.id))).rejects.toThrow();

    const blocked = await service.createPack({ displayName: '占用删除', voiceId: 'voice-blocked', modelId: 'model' });
    const blockedService = new LocalVoicePackService({ root, masterCsv: master, sleep: async () => undefined, indexGenerator: async () => undefined, fileSystem: { stat: fs.stat, rename: lockedRename, rm: async () => { const error = new Error('still locked'); error.code = 'EBUSY'; throw error; } } });
    await expect(blockedService.deletePack(blocked.pack.id)).rejects.toMatchObject({ code: 'PACK_IN_USE', status: 423 });
    await expect(fs.stat(path.join(root, blocked.pack.id))).resolves.toMatchObject({ isDirectory: expect.any(Function) });
  });

  it('删除不存在的 Pack 会明确失败，不会静默修改索引', async () => {
    const { service } = await fixture();
    await expect(service.deletePack('missing-pack')).rejects.toThrow('不存在');
    expect(await service.listPacks()).toEqual([]);
  });
});
