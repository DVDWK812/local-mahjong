import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VOICE_PACK_REPOSITORY, VoicePackRepository } from '../../audio/voice/VoicePackRepository';
import { DisclosureButton, GenerationConfirmationPanel, GenerationSettingsFields, TextControlPalette, VoiceManagementScreen, generatePlanTargets, generationOutcome, generationTargetCount, generationTargetKeys, ttsOverrideForDraft } from './VoiceManagementScreen';
import { textControlProfileForModel } from '../../audio/voice/textControlProfiles';
import { SettingHelpTooltip, settingHelpTooltipPosition } from './SettingHelpTooltip';

describe('VoiceManagementScreen', () => {
  it('作为独立界面显示当前校长的 148 条可编辑语音与生成摘要', () => {
    const html = renderToStaticMarkup(<VoiceManagementScreen packId="xiaozhang" voiceVolume={0.8} onBack={() => undefined} />);
    expect(html).toContain('语音管理');
    expect(html).toContain('← 返回');
    expect(html).toContain('校长');
    expect(html).toContain('中文 · 148 条语音');
    expect(html).toContain('立直');
    expect(html).toContain('统一高级设置');
    expect(html).toContain('高级设置');
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

  it('固定生成确认区域显示实际目标数量与运行中 key 级进度，0 条时不显示进度', () => {
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
    const empty = renderToStaticMarkup(<GenerationConfirmationPanel plan={null} lines={[]} selectedKeys={undefined} generating={false} progress={null} result={null} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(empty).toContain('选择单条“生成/更新”或“一键生成”后');
    const running = renderToStaticMarkup(<GenerationConfirmationPanel plan={plan} lines={[]} selectedKeys={undefined} generating progress={{ completed: 0, total: 34 }} result={null} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(running).toContain('确认批量生成语音');
    expect(running).toContain('预计消耗次数：34 次');
    expect(running).toContain('当前进度：0/34');
    expect(running).not.toContain('预计 Fish Audio API 请求');
    const single = renderToStaticMarkup(<GenerationConfirmationPanel plan={{ ...plan, changed: 1, new: 0, missing: 0, apiCalls: 1, items: [plan.items[1]] }} lines={[{ key: 'action.riichi', category: 'action', action: 'riichi', line: '立直', tts_text: '立直', locale: 'zh-CN', character: 'xiaozhang', emotion: 'firm' }]} selectedKeys={['action.riichi']} generating={false} progress={null} result={null} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(single).toContain('确认生成单条语音'); expect(single).toContain('实际 TTS：立直');
    const nothingToDo = renderToStaticMarkup(<GenerationConfirmationPanel plan={{ ...plan, changed: 0, new: 0, missing: 0, apiCalls: 0, items: [] }} lines={[]} selectedKeys={undefined} generating progress={{ completed: 0, total: 0 }} result={null} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(nothingToDo).not.toContain('当前进度');
    const result = renderToStaticMarkup(<GenerationConfirmationPanel plan={null} lines={[]} selectedKeys={undefined} generating={false} progress={null} result={{ success: false, generated: 3, failed: 1, skipped: 0, items: [], error: { code: 'NETWORK', message: '连接失败' } }} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(result).toContain('语音生成结束'); expect(result).toContain('成功：3'); expect(result).toContain('失败：1'); expect(result).toContain('NETWORK: 连接失败');
  });

  it('确认区域在管理页顶部始终只出现一次，表格不会承载动态确认区', () => {
    const html = renderToStaticMarkup(<VoiceManagementScreen packId="xiaozhang" voiceVolume={0.8} onBack={() => undefined} />);
    expect((html.match(/<aside class="voice-management-screen__generation-panel"/g) ?? []).length).toBe(1);
    expect(html.indexOf('voice-management-screen__generation-panel')).toBeLessThan(html.indexOf('voice-management-screen__table'));
    expect(html).toContain('voice-management-screen__top');
  });

  it('所有高级区域使用带可访问状态和清晰箭头的原生 disclosure button', () => {
    const collapsed = renderToStaticMarkup(<DisclosureButton expanded={false} controlsId="advanced-a" onClick={() => undefined}>高级设置</DisclosureButton>);
    expect(collapsed).toContain('aria-expanded="false"'); expect(collapsed).toContain('aria-controls="advanced-a"'); expect(collapsed).toContain('▼');
    const expanded = renderToStaticMarkup(<DisclosureButton expanded controlsId="advanced-a" onClick={() => undefined}>高级设置</DisclosureButton>);
    expect(expanded).toContain('aria-expanded="true"'); expect(expanded).toContain('▲');
    const palette = renderToStaticMarkup(<TextControlPalette profile={textControlProfileForModel('fishaudio-s21pro-flash')} />);
    expect(palette).toContain('voice-management-screen__disclosure'); expect(palette).toContain('aria-expanded="false"');
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

  it('高级设置明确显示所有生成参数与 Fish 语言覆盖，且不在静态渲染时请求生成', () => {
    const html = renderToStaticMarkup(<GenerationSettingsFields settings={{ speed: 1, volume: 0, stability: 1, similarity: 1, languageOverride: '', textNormalization: true }} locale="zh-CN" onChange={() => undefined} />);
    for (const label of ['语速', '音量', '稳定性', '相似度', '语言覆盖', '文本归一化', '简体中文', '日本語']) expect(html).toContain(label);
    expect(html).toContain('跟随角色语言（zh-CN）');
    expect(html).toContain('文本归一化'); expect(html).toContain('指定这一条语音生成时使用的语言提示');
    expect(html).toContain('voice-management-screen__setting-row');
    expect(html).toContain('voice-management-screen__setting-help-button');
  });

  it('明确不支持的控制不会显示为可编辑参数，避免制造 false changed 预期', () => {
    const html = renderToStaticMarkup(<GenerationSettingsFields settings={{ speed: 1, volume: 0, stability: 1, similarity: 1, languageOverride: '', textNormalization: true }} locale="zh-CN" controls={{ speed: false, volume: false, pitch: false, stability: false, similarity: false, language: true, textNormalization: true, emotion: false, instruction: false }} onChange={() => undefined} />);
    for (const unsupported of ['语速', '音量', '稳定性', '相似度']) expect(html).not.toContain(`aria-label="${unsupported}"`);
    expect(html).toContain('语言覆盖'); expect(html).toContain('文本归一化');
  });

  it('设置说明使用可访问的小型信息图标，并在页面顶部/中部/底部给出可见定位', () => {
    const html = renderToStaticMarkup(<SettingHelpTooltip text="说明文字" />);
    expect(html).toContain('aria-describedby='); expect(html).toContain('说明文字');
    expect(settingHelpTooltipPosition({ left: 20, right: 36, top: 20, bottom: 36 }, 800)).toMatchObject({ placement: 'below' });
    expect(settingHelpTooltipPosition({ left: 20, right: 36, top: 320, bottom: 336 }, 800)).toMatchObject({ placement: 'above' });
    expect(settingHelpTooltipPosition({ left: 20, right: 36, top: 720, bottom: 736 }, 800)).toMatchObject({ placement: 'above' });
  });

  it('按模型显示严格独立的文本控制标签 profile', () => {
    const fish = renderToStaticMarkup(<TextControlPalette profile={textControlProfileForModel('fishaudio-s21pro-flash')} />);
    expect(fish).toContain('文本控制标签'); expect(fish).not.toContain('(laughs)');
    const minimax = renderToStaticMarkup(<TextControlPalette profile={textControlProfileForModel('minimax-2.8-turbo')} />);
    expect(minimax).toContain('文本控制标签'); expect(minimax).not.toContain('[excited]');
  });
});
