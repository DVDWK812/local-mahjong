import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VOICE_PACK_REPOSITORY, VoicePackRepository } from '../../audio/voice/VoicePackRepository';
import { GenerationPlanDialog, VoiceManagementScreen, generatePlanTargets, generationOutcome, generationTargetCount, generationTargetKeys, ttsOverrideForDraft } from './VoiceManagementScreen';

describe('VoiceManagementScreen', () => {
  it('作为独立界面显示当前校长的 148 条可编辑语音与生成摘要', () => {
    const html = renderToStaticMarkup(<VoiceManagementScreen packId="xiaozhang" voiceVolume={0.8} onBack={() => undefined} />);
    expect(html).toContain('语音管理');
    expect(html).toContain('← 返回');
    expect(html).toContain('校长');
    expect(html).toContain('中文 · 148 条语音');
    expect(html).toContain('立直');
    expect(html).toContain('高级发音');
    expect(html).toContain('placeholder="动作或台词"');
    expect(html).not.toContain('placeholder="动作、台词或 key"');
    expect(html).toContain('试听始终播放已生成的音频版本');
    expect(html).toContain('已生成 148');
    for (const heading of ['个性化 / 对局', '核心动作', '特殊对局', '结算等级', '役满', '常规役种', '特殊役', '宝牌', '出牌报牌']) {
      expect(html).toContain(`voice-management-screen__group-title">${heading}`);
    }
    expect((html.match(/voice-management-screen__row" role="row"/g) ?? []).length).toBe(148);
  });

  it('未知 Pack 显示可恢复错误，不会导致页面崩溃', () => {
    const html = renderToStaticMarkup(<VoiceManagementScreen packId="removed-pack" voiceVolume={0.8} onBack={() => undefined} />);
    expect(html).toContain('当前语音包不可用');
    expect(html).toContain('← 返回');
  });

  it('缺失音频在独立列表中禁用试听', () => {
    const repository = new VoicePackRepository({
      index: { schemaVersion: 1, packs: [{ id: 'missing', name: '缺失音频角色', locale: 'zh-CN', path: 'missing' }] },
      packMetadata: { '../../music/voice_lines/missing/pack.json': { id: 'missing', name: '缺失音频角色', locale: 'zh-CN', voiceId: 'voice', modelId: 'model' } },
      manifests: { '../../music/voice_lines/missing/manifest.json': { character: 'missing', voiceId: 'voice', voices: { 'action.riichi': { file: 'audio/action_riichi.mp3' } } } },
      voiceLines: { '../../music/voice_lines/missing/voice_lines.json': [{ key: 'action.riichi', category: 'action', action: 'riichi', line: '立直', tts_text: '立直', locale: 'zh-CN', character: 'missing', emotion: 'firm' }] },
      audio: {},
    });
    const html = renderToStaticMarkup(<VoiceManagementScreen packId="missing" voiceVolume={0.8} onBack={() => undefined} repository={repository} />);
    expect(html).toContain('△ 音频缺失');
    expect(html).toContain('disabled=""');
  });

  it('新建的空音频 Pack 仍展示完整 114 条，并全部禁用试听', () => {
    const lines = Array.from({ length: 114 }, (_, index) => ({ key: `action.new_${index}`, category: 'action', action: 'new', line: '新台词', tts_text: '新台词', locale: 'zh-CN', character: 'new', emotion: 'firm' }));
    const repository = new VoicePackRepository({
      index: { schemaVersion: 1, packs: [{ id: 'new-001', name: '新角色', locale: 'zh-CN', path: 'new-001' }] },
      packMetadata: { '../../music/voice_lines/new-001/pack.json': { id: 'new-001', name: '新角色', locale: 'zh-CN', voiceId: 'voice', modelId: 'fishaudio-s21pro-flash' } },
      manifests: { '../../music/voice_lines/new-001/manifest.json': { character: 'new-001', voiceId: 'voice', voices: {} } },
      voiceLines: { '../../music/voice_lines/new-001/voice_lines.json': lines }, audio: {},
    });
    const html = renderToStaticMarkup(<VoiceManagementScreen packId="new-001" voiceVolume={0.8} onBack={() => undefined} repository={repository} />);
    expect(html).toContain('新角色');
    expect(html).toContain('中文 · 114 条语音');
    expect(html).toContain('已生成 0');
    expect(html).toContain('未生成 114');
    expect((html.match(/disabled=""/g) ?? []).length).toBe(114);
  });

  it('生成成功或失败均不会触发导航；可恢复错误保留在当前管理页', () => {
    expect(generationOutcome({ success: true, generated: 1, failed: 0, skipped: 0, items: [] })).toEqual({ remainInManagement: true, error: null });
    expect(generationOutcome({ success: false, generated: 0, failed: 1, skipped: 0, items: [], error: { code: 'API_KEY_UNAVAILABLE', message: '未找到 Fish Audio API Key。' } }))
      .toEqual({ remainInManagement: true, error: 'API_KEY_UNAVAILABLE: 未找到 Fish Audio API Key。' });
    expect(generationOutcome({ success: false, generated: 0, failed: 1, skipped: 0, items: [] }))
      .toEqual(expect.objectContaining({ remainInManagement: true }));
  });

  it('高级发音输入为空或与台词相同即恢复为 Python fallback 的默认发音', () => {
    const line = { line: '自摸！' };
    expect(ttsOverrideForDraft(line, '')).toBe('');
    expect(ttsOverrideForDraft(line, '  自摸！  ')).toBe('');
    expect(ttsOverrideForDraft(line, '<|phoneme_start|>zi4 mo1<|phoneme_end|>')).toBe('<|phoneme_start|>zi4 mo1<|phoneme_end|>');
  });

  it('生成确认弹窗显示实际目标数量与运行中 key 级进度，0 条时不显示进度', () => {
    const plan = {
      packId: 'xiaozhang', total: 148, unchanged: 114, changed: 1, new: 32, missing: 1, apiCalls: 34,
      items: [
        { key: 'tile.m1', line: '一万', file: 'audio/tile_m1.mp3', status: 'new' as const, reason: 'new' },
        { key: 'action.riichi', line: '立直', file: 'audio/action_riichi.mp3', status: 'changed' as const, reason: 'changed' },
        { key: 'action.ron', line: '荣和', file: 'audio/action_ron.mp3', status: 'missing' as const, reason: 'missing' },
      ],
    };
    expect(generationTargetCount(plan)).toBe(34);
    expect(generationTargetKeys(plan)).toEqual(['tile.m1', 'action.riichi', 'action.ron']);
    const running = renderToStaticMarkup(<GenerationPlanDialog plan={plan} lines={[]} selectedKeys={undefined} generating progress={{ completed: 0, total: 34 }} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(running).toContain('预计消耗次数：34 次');
    expect(running).toContain('当前进度：0/34');
    expect(running).not.toContain('预计 Fish Audio API 请求');
    const nothingToDo = renderToStaticMarkup(<GenerationPlanDialog plan={{ ...plan, changed: 0, new: 0, missing: 0, apiCalls: 0, items: [] }} lines={[]} selectedKeys={undefined} generating progress={{ completed: 0, total: 0 }} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(nothingToDo).not.toContain('当前进度');
  });

  it('逐 key 调用既有生成接口，成功或最终失败都推进进度', async () => {
    const plan = {
      packId: 'xiaozhang', total: 2, unchanged: 0, changed: 1, new: 1, missing: 0, apiCalls: 2,
      items: [
        { key: 'action.riichi', line: '立直', file: 'audio/action_riichi.mp3', status: 'changed' as const, reason: 'changed' },
        { key: 'tile.m1', line: '一万', file: 'audio/tile_m1.mp3', status: 'new' as const, reason: 'new' },
      ],
    };
    const calls: unknown[][] = []; const progress: Array<{ completed: number; total: number; key: string | null }> = [];
    const service = {
      previewGeneration: async () => plan,
      generate: async (packId: string, keys?: readonly string[], overrides?: readonly unknown[]) => {
        calls.push([packId, keys, overrides]);
        return keys?.[0] === 'action.riichi'
          ? { success: true, generated: 1, failed: 0, skipped: 0, items: [{ key: 'action.riichi', file: 'audio/action_riichi.mp3', status: 'generated', error: null }] }
          : { success: false, generated: 0, failed: 1, skipped: 0, items: [{ key: 'tile.m1', file: 'audio/tile_m1.mp3', status: 'failed', error: 'final failure' }] };
      },
    };
    const result = await generatePlanTargets(service, 'xiaozhang', plan, [{ key: 'tile.m1', ttsText: '一万' }], (next, key) => progress.push({ ...next, key }));
    expect(calls).toEqual([
      ['xiaozhang', ['action.riichi'], []],
      ['xiaozhang', ['tile.m1'], [{ key: 'tile.m1', ttsText: '一万' }]],
    ]);
    expect(progress).toEqual([
      { completed: 0, total: 2, key: null },
      { completed: 1, total: 2, key: 'action.riichi' },
      { completed: 2, total: 2, key: 'tile.m1' },
    ]);
    expect(result).toMatchObject({ success: false, generated: 1, failed: 1 });
  });
});
