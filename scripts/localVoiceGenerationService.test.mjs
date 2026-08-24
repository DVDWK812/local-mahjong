import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalVoiceGenerationService } from './localVoiceGenerationService.mjs';

const roots = [];
async function fixture(runProcess, reindex = async () => undefined) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mahjong-voice-generation-')); roots.push(root);
  const pack = path.join(root, 'safe-pack'); await fs.mkdir(pack);
  await fs.writeFile(path.join(pack, 'voice_lines.json'), JSON.stringify([
    { key: 'action.riichi' }, { key: 'action.ron' }, { key: 'action.tsumo' },
  ]));
  await fs.writeFile(path.join(pack, 'voice_lines.csv'), '\ufeffkey,category,action,line,tts_text,locale,character,emotion\r\naction.riichi,action,riichi,立直,立直,zh-CN,safe,firm\r\naction.ron,action,ron,荣,荣,zh-CN,safe,firm\r\naction.tsumo,action,tsumo,自摸,自摸,zh-CN,safe,firm\r\n');
  return new LocalVoiceGenerationService({ root, generator: path.join(root, 'generate_voice.py'), pythonCommand: 'python-test', runProcess, reindex });
}
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

const plan = (overrides = {}) => ({ kind: 'plan', plan: { packId: 'safe-pack', total: 3, unchanged: 0, changed: 0, new: 3, missing: 0, apiCalls: 3, items: [{ key: 'action.riichi', line: '立直', file: 'action_riichi.mp3', status: 'new', reason: 'no cache entry' }], ...overrides } });
const result = { kind: 'result', result: { success: true, generated: 1, failed: 0, skipped: 0, items: [{ key: 'action.riichi', file: 'action_riichi.mp3', status: 'generated', error: null }] } };
const reply = (value, code = 0) => ({ code, stdout: `${JSON.stringify(value)}\n`, stderr: '' });

describe('LocalVoiceGenerationService', () => {
  it('批量计划保留 Python 的增量 API 次数，单条只传该 key', async () => {
    const calls = [];
    const service = await fixture(async (_command, args) => { calls.push(args); return reply(plan({ total: 1, new: 1, apiCalls: 1 })); });
    const response = await service.previewGeneration('safe-pack', ['action.riichi']);
    expect(response).toMatchObject({ total: 1, new: 1, apiCalls: 1 });
    expect(calls[0]).toContain('--dry-run'); expect(calls[0]).toContain('--keys'); expect(calls[0]).toContain('action.riichi');
  });

  it('全部 unchanged 时不启动实际 Python 生成', async () => {
    let calls = 0;
    const service = await fixture(async () => { calls += 1; return reply(plan({ unchanged: 3, new: 0, apiCalls: 0 })); });
    await expect(service.generate('safe-pack')).resolves.toMatchObject({ generated: 0, skipped: 3, failed: 0 });
    expect(calls).toBe(1);
  });

  it('changed 十条的计划只生成十条，并在完成后重建索引', async () => {
    let step = 0; let indexed = 0;
    const service = await fixture(async () => ++step === 1 ? reply(plan({ total: 10, changed: 10, new: 0, apiCalls: 10 })) : reply(result), async () => { indexed += 1; });
    await expect(service.generate('safe-pack', ['action.riichi'])).resolves.toMatchObject({ generated: 1, failed: 0 });
    expect(indexed).toBe(1);
  });

  it('将 UI 的高级发音编辑写入角色 CSV 后，计划只针对该单条调用生成器', async () => {
    const service = await fixture(async (_command, args) => {
      expect(args).toContain('--keys'); expect(args).toContain('action.riichi');
      return reply(plan({ total: 1, changed: 1, new: 0, apiCalls: 1 }));
    });
    await expect(service.previewGeneration('safe-pack', ['action.riichi'], [{ key: 'action.riichi', ttsText: '<|phoneme_start|>li4 zhi2<|phoneme_end|>' }]))
      .resolves.toMatchObject({ total: 1, changed: 1, apiCalls: 1 });
    const csv = await fs.readFile(path.join(roots.at(-1), 'safe-pack', 'voice_lines.csv'), 'utf8');
    expect(csv).toContain('<|phoneme_start|>li4 zhi2<|phoneme_end|>');
  });

  it('自动保存只写当前角色 CSV：历史默认 tts_text 随 line 规范为空，且绝不调用生成器', async () => {
    let calls = 0; let indexed = 0;
    const service = await fixture(async () => { calls += 1; return reply(plan()); }, async () => { indexed += 1; });
    await service.updateVoiceLines('safe-pack', [{ key: 'action.riichi', line: '哇哦！立直', ttsText: '' }]);
    const csv = await fs.readFile(path.join(roots.at(-1), 'safe-pack', 'voice_lines.csv'), 'utf8');
    expect(csv).toContain('action.riichi,action,riichi,哇哦！立直,,zh-CN');
    expect(calls).toBe(0);
    expect(indexed).toBe(1);
  });

  it('保存单条或统一生成参数只写 CSV，不调用 Python/Fish', async () => {
    let calls = 0; let indexed = 0;
    const service = await fixture(async () => { calls += 1; return reply(plan()); }, async () => { indexed += 1; });
    await service.updateVoiceLines('safe-pack', [
      { key: 'action.riichi', speed: 1.2, volume: -3, stability: 0.8, similarity: 0.9, languageOverride: 'ja-JP', textNormalization: false },
      { key: 'action.ron', speed: 1.2, volume: -3, stability: 0.8, similarity: 0.9, languageOverride: 'ja-JP', textNormalization: false },
      { key: 'action.tsumo', speed: 1.2, volume: -3, stability: 0.8, similarity: 0.9, languageOverride: 'ja-JP', textNormalization: false },
    ]);
    const csv = await fs.readFile(path.join(roots.at(-1), 'safe-pack', 'voice_lines.csv'), 'utf8');
    expect(csv).toContain('speed,volume,stability,similarity,language_override,text_normalization');
    expect(csv).toContain('1.2,-3,0.8,0.9,ja-JP,false');
    expect(calls).toBe(0);
    expect(indexed).toBe(1);
  });

  it('accepts textNormalization=false and pitch unset, preserving false in the CSV', async () => {
    const service = await fixture(async () => reply(plan()));
    await service.updateVoiceLines('safe-pack', [{ key: 'action.riichi', textNormalization: false, pitch: null }]);
    const csv = await fs.readFile(path.join(roots.at(-1), 'safe-pack', 'voice_lines.csv'), 'utf8');
    expect(csv).toContain('text_normalization'); expect(csv).toContain('false'); expect(csv).not.toContain(',null');
  });

  it('参数保存后立即计划时，生成器读取刚写入的 supported speed，而不是旧快照', async () => {
    const service = await fixture(async (_command, args) => {
      expect(args).toContain('--dry-run');
      const csv = await fs.readFile(path.join(roots.at(-1), 'safe-pack', 'voice_lines.csv'), 'utf8');
      expect(csv).toContain('action.riichi,action,riichi,立直,立直,zh-CN,safe,firm,1.15');
      return reply(plan({ total: 1, unchanged: 0, changed: 1, new: 0, apiCalls: 1, items: [{ key: 'action.riichi', line: '立直', file: 'action_riichi.mp3', status: 'changed', reason: 'content fingerprint changed' }] }));
    });
    await service.updateVoiceLines('safe-pack', [{ key: 'action.riichi', speed: 1.15 }]);
    await expect(service.previewGeneration('safe-pack', ['action.riichi']))
      .resolves.toMatchObject({ changed: 1, unchanged: 0, apiCalls: 1 });
  });

  it('拒绝非法 pack、未知 key 与并发生成', async () => {
    let release;
    const waiting = new Promise((resolve) => { release = resolve; });
    const service = await fixture(async (_command, args) => args.includes('--dry-run') ? reply(plan()) : (await waiting, reply(result)));
    await expect(service.previewGeneration('../escape')).rejects.toThrow('角色 ID 无效');
    await expect(service.previewGeneration('safe-pack', ['../escape'])).rejects.toThrow('不属于当前角色');
    const first = service.generate('safe-pack', ['action.riichi']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(service.generate('safe-pack', ['action.ron'])).rejects.toThrow('正在生成');
    release(); await first;
  });

  it('接受 BOM 包裹的纯 JSON，并拒绝日志污染、缺字段和异常退出的响应', async () => {
    const withBom = await fixture(async () => ({ code: 0, stdout: `\ufeff${JSON.stringify(plan({ total: 1, new: 1, apiCalls: 1 }))}\n`, stderr: 'safe diagnostic\n' }));
    await expect(withBom.previewGeneration('safe-pack', ['action.riichi'])).resolves.toMatchObject({ apiCalls: 1 });
    const polluted = await fixture(async () => ({ code: 0, stdout: `normal log\n${JSON.stringify(plan())}\n`, stderr: '' }));
    await expect(polluted.previewGeneration('safe-pack')).rejects.toThrow('GENERATOR_INVALID_RESPONSE');
    let incompleteCalls = 0;
    const incomplete = await fixture(async () => ++incompleteCalls === 1
      ? reply(plan({ total: 1, new: 1, apiCalls: 1 }))
      : reply({ kind: 'result', result: { success: true, generated: 1, failed: 0, items: [] } }));
    await expect(incomplete.generate('safe-pack', ['action.riichi'])).rejects.toThrow('GENERATOR_INVALID_RESPONSE');
    const nonzero = await fixture(async () => ({ code: 2, stdout: '', stderr: 'safe failure\n' }));
    await expect(nonzero.previewGeneration('safe-pack')).rejects.toThrow('GENERATOR_INVALID_RESPONSE');
  });

  it('保留可解析的 Python 失败结果，供 UI 刷新 failed 状态而不泄露进程输出', async () => {
    let call = 0;
    const failedResult = { kind: 'result', result: { success: false, generated: 0, failed: 1, skipped: 0, items: [{ key: 'action.riichi', file: 'action_riichi.mp3', status: 'failed', error: 'HTTP 429' }] } };
    const service = await fixture(async () => ++call === 1 ? reply(plan({ total: 1, new: 1, apiCalls: 1 })) : reply(failedResult, 1));
    await expect(service.generate('safe-pack', ['action.riichi'])).resolves.toMatchObject({ success: false, failed: 1 });
  });
});
