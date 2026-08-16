import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from '../audio/audioSettings';
import { AudioSettingsDialog } from './AudioSettingsDialog';

describe('AudioSettingsDialog', () => {
  it('显示四个键盘可操作 slider、当前百分比与四个独立开关', () => {
    const html = renderToStaticMarkup(
      <AudioSettingsDialog settings={DEFAULT_AUDIO_SETTINGS} onChange={() => undefined} onClose={() => undefined} />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('音频设置');
    expect((html.match(/type="range"/g) ?? [])).toHaveLength(4);
    for (const label of ['总音量', '背景音乐音量', '游戏音效音量', '语音音量']) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    for (const label of ['背景音乐开关', '立直音乐开关', '游戏音效开关', '语音开关']) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(html).toContain('80%');
    expect(html).toContain('60%');
    expect(html).toContain('修改即时生效');
  });

  it('关闭回调保持独立，不需要保存按钮', () => {
    const onClose = vi.fn();
    const html = renderToStaticMarkup(
      <AudioSettingsDialog settings={DEFAULT_AUDIO_SETTINGS} onChange={() => undefined} onClose={onClose} />,
    );
    expect(html).toContain('>关闭</button>');
    expect(html).not.toContain('保存设置');
    onClose();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
