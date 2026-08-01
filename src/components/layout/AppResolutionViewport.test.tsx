import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS, persistAppSettingsUpdate } from '../../app/appSettings';
import { AppResolutionViewport, calculateAppResolutionLayout } from './AppResolutionViewport';

describe('浏览器分辨率偏好与实际视口布局', () => {
  it('默认使用auto', () => {
    expect(DEFAULT_APP_SETTINGS.resolutionPreset).toBe('auto');
  });

  it.each(['auto', '720p', '1080p', '2k', '4k'] as const)('%s只记录偏好，根节点始终使用实际CSS视口', (preset) => {
    const html = renderToStaticMarkup(
      <AppResolutionViewport preset={preset} viewportSize={{ width: 1366, height: 768 }}>
        <button type="button">内容</button>
      </AppResolutionViewport>,
    );
    expect(html).toContain(`data-resolution-preset="${preset}"`);
    expect(html).not.toContain('transform:');
    expect(html).not.toContain('--app-design-width');
    expect(html).not.toContain('--app-design-height');
    expect(html).not.toContain('--app-resolution-scale');
    expect(html).not.toContain('3840px');
  });

  it('4K预设不会改变实际视口布局结果', () => {
    expect(calculateAppResolutionLayout(1920, 1080)).toEqual({
      scale: 1,
      scaledWidth: 1920,
      scaledHeight: 1080,
      belowSafeScale: false,
    });
    expect(calculateAppResolutionLayout(3840, 2160)).toEqual({
      scale: 1,
      scaledWidth: 3840,
      scaledHeight: 2160,
      belowSafeScale: false,
    });
  });

  it('不同预设不调用浏览器尺寸API且不修改对局状态', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const viewport = readFileSync(resolve(process.cwd(), 'src/components/layout/AppResolutionViewport.tsx'), 'utf8');
    expect(app).toContain('<AppResolutionViewport preset={state.appSettings.resolutionPreset}>');
    expect(app).toContain('appSettings: outcome.settings');
    expect(app).not.toMatch(/handleResolutionPresetChange[\s\S]{0,500}activeGame\s*:/);
    expect(`${app}\n${viewport}`).not.toMatch(/resizeTo\(|devicePixelRatio|visualViewport\.scale/);
  });

  it('Storage失败时会话偏好仍生效但不引入根缩放', () => {
    const outcome = persistAppSettingsUpdate({ version: 1, resolutionPreset: '4k' }, {
      getItem: () => null,
      setItem: () => { throw new Error('write failed'); },
      removeItem: () => undefined,
    });
    const html = renderToStaticMarkup(
      <AppResolutionViewport preset={outcome.settings.resolutionPreset} viewportSize={{ width: 1920, height: 1080 }}>
        内容
      </AppResolutionViewport>,
    );
    expect(outcome.result.ok).toBe(false);
    expect(html).toContain('data-resolution-preset="4k"');
    expect(html).not.toContain('transform:');
  });

  it('3840×2160下主菜单沿用正常CSS尺寸而非固定4K画布缩放', () => {
    const html = renderToStaticMarkup(
      <AppResolutionViewport preset="4k" viewportSize={{ width: 3840, height: 2160 }}>
        <main className="menu-page"><button type="button">设置</button></main>
      </AppResolutionViewport>,
    );
    expect(html).toContain('class="menu-page"');
    expect(html).not.toContain('app-resolution-stage');
    expect(html).not.toContain('app-resolution-canvas');
  });
});
