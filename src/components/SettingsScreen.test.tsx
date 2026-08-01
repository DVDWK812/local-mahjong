import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '../app/appSettings';
import { SettingsScreen } from './SettingsScreen';
import { AppResolutionViewport } from './layout/AppResolutionViewport';

describe('应用设置页面', () => {
  it('按固定顺序显示六个分类并高亮画面分辨率', () => {
    const html = renderSettings();
    const labels = ['声音', '画面分辨率', '语言', '偏好', '形象', '其他'];
    labels.reduce((cursor, label) => {
      const index = html.indexOf(`>${label}<`);
      expect(index).toBeGreaterThan(cursor);
      return index;
    }, -1);
    expect(html).toContain('aria-current="page">画面分辨率');
  });

  it('分辨率下拉包含自动和四个准确预设及说明', () => {
    const html = renderSettings();
    expect(html).toContain('自动（根据窗口）');
    expect(html).toContain('720p（1280 × 720）');
    expect(html).toContain('1080p（1920 × 1080）');
    expect(html).toContain('2K（2560 × 1440）');
    expect(html).toContain('4K（3840 × 2160）');
    expect(html).toContain('value="auto" selected=""');
    expect(html).toContain('浏览器版本会根据当前窗口自动适配。分辨率预设将用于显示偏好和未来桌面客户端。');
    expect(html).toContain('当前预设');
    expect(html).toContain('自动');
    expect(html).toContain('偏好尺寸');
    expect(html).toContain('根据当前窗口');
    expect(html).toContain('当前窗口尺寸');
    expect(html).toContain('1280 × 720');
    expect(html).toContain('布局方式');
    expect(html).toContain('实际视口自动适配');
  });

  it.each(['sound', 'language', 'preference', 'avatar', 'other'] as const)('%s未实现分类只显示功能开发中', (initialCategory) => {
    const html = renderSettings(initialCategory);
    expect(html).toContain('功能开发中');
    expect(html).not.toContain('<select');
  });

  it('显示保存失败的非阻断提示和返回主菜单按钮', () => {
    const onBack = vi.fn();
    const html = renderToStaticMarkup(
      <SettingsScreen
        settings={{ version: 1, resolutionPreset: '4k' }}
        notice="设置已应用，但无法保存到浏览器。"
        onResolutionPresetChange={() => undefined}
        onBack={onBack}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('设置已应用，但无法保存到浏览器。');
    expect(html).toContain('返回主菜单');
  });
});

function renderSettings(initialCategory?: 'sound' | 'resolution' | 'language' | 'preference' | 'avatar' | 'other') {
  return renderToStaticMarkup(
    <AppResolutionViewport preset="auto" viewportSize={{ width: 1280, height: 720 }}>
      <SettingsScreen
        settings={DEFAULT_APP_SETTINGS}
        initialCategory={initialCategory}
        onResolutionPresetChange={() => undefined}
        onBack={() => undefined}
      />
    </AppResolutionViewport>,
  );
}
