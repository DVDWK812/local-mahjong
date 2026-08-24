import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { canCreateWithDiscovery, chooseDefaultCompatibleModel, createVoicePackInputForLanguage, CreateVoicePackScreen, selectedVoiceDesignPreset, shouldApplyDiscoveryResponse, VOICE_DESIGN_PRESET_GROUPS } from './CreateVoicePackScreen';

describe('CreateVoicePackScreen', () => {
  it('展示独立创建表单，启动检测期间禁用创建，并明确 Voice ID 与零费用边界', () => {
    const html = renderToStaticMarkup(<CreateVoicePackScreen onBack={() => undefined} onCreated={() => undefined} />);
    expect(html).toContain('创建角色语音');
    expect(html).toContain('Fish Audio Voice ID');
    expect(html).toContain('不是 API Key');
    expect(html).toContain('select');
    expect(html).toContain('aria-label="角色语言"');
    expect(html).toContain('🇨🇳 简体中文');
    expect(html).toContain('🇯🇵 日本語');
    expect(html).not.toContain('placeholder="zh-CN"');
    expect(html).toContain('正在检查角色语音服务');
    expect(html).toContain('aria-label="兼容模型"');
    expect(html).not.toContain('模型 ID<input');
    expect(html).toContain('正在检查服务');
    expect(html).toContain('disabled=""');
    expect(html).toContain('已生成音色');
    expect(html).toContain('声音克隆');
    expect(html).toContain('音色设计');
    expect(html).toContain('合法使用权');
  });

  it('选择语言时只保存对应 locale，不把显示文本写进 Pack 输入', () => {
    expect(createVoicePackInputForLanguage({ displayName: '曼波', voiceId: 'voice-id', locale: 'zh-CN' }, 'ja')).toMatchObject({ locale: 'ja-JP' });
  });

  it('优先选择 Fish 推荐的兼容模型；不兼容时稳定回退到第一个有效模型', () => {
    const models = [{ modelId: 'model-a', displayName: 'A', available: true, controls: { speed: true, volume: true, pitch: false, stability: false, similarity: false, language: false, textNormalization: true, emotion: false, instruction: false } }, { modelId: 'model-b', displayName: 'B', available: true, controls: { speed: true, volume: true, pitch: false, stability: false, similarity: false, language: false, textNormalization: true, emotion: false, instruction: false } }];
    expect(chooseDefaultCompatibleModel({ compatibleModels: models, recommendedModelId: 'model-b' })).toBe('model-b');
    expect(chooseDefaultCompatibleModel({ compatibleModels: models, recommendedModelId: 'model-x' })).toBe('model-a');
  });

  it('没有兼容模型或尚未完成发现时不能创建角色', () => {
    const input = { displayName: '角色', voiceId: 'voice-id', modelId: 'model-a' };
    expect(canCreateWithDiscovery(input, null, 'loading')).toBe(false);
    expect(canCreateWithDiscovery(input, { voiceId: 'voice-id', voiceCompatibleModelIds: [], availableModels: [], compatibleModels: [] }, 'ready')).toBe(false);
  });

  it('Voice A 的慢响应不会覆盖已经输入的 Voice B', () => {
    expect(shouldApplyDiscoveryResponse(2, 1, 'voice-b', 'voice-a')).toBe(false);
    expect(shouldApplyDiscoveryResponse(2, 2, 'voice-b', 'voice-b')).toBe(true);
  });

  it('音色设计提供 16 个完整预设；选中预设只替换 prompt 而不绑定试听文本', () => {
    const presets = VOICE_DESIGN_PRESET_GROUPS.flatMap((group) => group.presets);
    expect(presets).toHaveLength(16);
    const spring = presets.find((preset) => preset.label === '清泉少女');
    const calm = presets.find((preset) => preset.label === '冷静少女');
    expect(spring?.prompt).toContain('声音像清泉一样清澈');
    expect(calm?.prompt).toContain('音色清冷干净');
    expect(selectedVoiceDesignPreset(spring!.prompt)).toBe(spring!.id);
    expect(selectedVoiceDesignPreset(`${spring!.prompt} 用户修改`)).toBeUndefined();
  });

  it('Provider 使用可点击的 label，并渲染分类预设名称', () => {
    const html = renderToStaticMarkup(<CreateVoicePackScreen onBack={() => undefined} onCreated={() => undefined} />);
    expect(html).toContain('create-voice-panel__provider-option');
    expect(html).toContain('清泉少女');
    expect(html).toContain('热血解说');
    expect(html).toContain('职业 / 风格');
  });
});
