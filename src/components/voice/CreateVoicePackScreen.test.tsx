import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createVoicePackInputForLanguage, CreateVoicePackScreen } from './CreateVoicePackScreen';

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
    expect(html).toContain('正在检查服务');
    expect(html).toContain('disabled=""');
  });

  it('选择语言时只保存对应 locale，不把显示文本写进 Pack 输入', () => {
    expect(createVoicePackInputForLanguage({ displayName: '曼波', voiceId: 'voice-id', locale: 'zh-CN' }, 'ja')).toMatchObject({ locale: 'ja-JP' });
  });
});
