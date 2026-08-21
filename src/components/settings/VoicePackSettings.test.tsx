import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VoicePackSettings } from './VoicePackSettings';

describe('VoicePackSettings', () => {
  it('音频设置只显示校长角色卡与独立管理入口', () => {
    const html = renderToStaticMarkup(<VoicePackSettings selectedVoicePackId="xiaozhang" onSelect={() => undefined} onManage={() => undefined} />);
    expect(html).toContain('校长');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('管理 &gt;');
    expect(html).not.toContain('搜索语音');
    expect(html).not.toContain('语音数量：114');
  });
});
