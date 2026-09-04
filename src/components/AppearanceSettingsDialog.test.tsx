import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultAppearanceSettings, DEFAULT_APPEARANCE_SETTINGS } from '../presentation/appearance/appearanceSettings';
import { AppearanceSettingsDialog, TileBackColorSetting } from './AppearanceSettingsDialog';
import { PlayerProfileDialog } from './PlayerProfileDialog';
import { DEFAULT_PLAYER_PROFILE } from '../profile/playerProfile';

describe('AppearanceSettingsDialog', () => {
  it('shares a viewport-bounded scroll body with the avatar dialog and keeps chrome outside it', () => {
    const appearance = renderToStaticMarkup(<AppearanceSettingsDialog settings={createDefaultAppearanceSettings()} onClose={() => undefined} />);
    const avatar = renderToStaticMarkup(<PlayerProfileDialog profile={DEFAULT_PLAYER_PROFILE} onChange={() => undefined} onClose={() => undefined} />);
    for (const html of [appearance, avatar]) {
      expect(html).toContain('appearance-scroll-dialog');
      expect(html).toContain('appearance-scroll-body');
      expect(html.indexOf('</header>')).toBeLessThan(html.indexOf('appearance-scroll-body'));
      expect(html.indexOf('appearance-scroll-body')).toBeLessThan(html.indexOf('<footer'));
    }
    const css = readFileSync(decodeURIComponent(new URL('../styles.css', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), 'utf8');
    expect(css).toMatch(/\.result-dialog\.appearance-scroll-dialog\s*\{[^}]*display: flex;[^}]*flex-direction: column;[^}]*max-height: calc\(100dvh - 36px\);[^}]*overflow: hidden;/);
    expect(css).toMatch(/\.appearance-scroll-dialog > \.appearance-scroll-body\s*\{[^}]*flex: 1 1 auto;[^}]*min-height: 0;[^}]*overflow-y: auto;[^}]*overflow-x: hidden;/);
    expect(css).toContain('body:has(.appearance-scroll-dialog)');
  });

  it('resets only the back side color, preserving the chosen texture and other settings', () => {
    const settings = { ...createDefaultAppearanceSettings(), tileBack: { texture: { kind: 'local' as const, assetId: 'keep-image' }, sideColor: '#aabbcc' } };
    const onChange = vi.fn();
    const view = TileBackColorSetting({ settings, onChange });
    view.props.children[1].props.onClick();
    expect(onChange).toHaveBeenCalledWith({ ...settings, tileBack: { ...settings.tileBack, sideColor: DEFAULT_APPEARANCE_SETTINGS.tileBack.sideColor } });
    expect(settings.tileBack.sideColor).toBe('#aabbcc');
  });

  it('provides the five requested image settings entries with hand disabled', () => {
    const html = renderToStaticMarkup(<AppearanceSettingsDialog settings={createDefaultAppearanceSettings()} onClose={() => undefined} />);
    for (const label of ['图像设置', '牌面设置', '牌背设置', '桌布设置', '立直棒设置', '手部设置']) expect(html).toContain(label);
    expect(html).toContain('暂未开放');
    expect(html).toContain('disabled=""');
  });

  it('keeps section copy on the root list and leaves detail pages with only back and preview controls', () => {
    const sourcePath = decodeURIComponent(new URL('./AppearanceSettingsDialog.tsx', import.meta.url).pathname)
      .replace(/^\/([A-Za-z]:)/, '$1');
    const source = readFileSync(sourcePath, 'utf8');
    expect(source).not.toContain('<h3>{title}</h3>');
    expect(source).not.toContain('同一张图片会同时用于静态立直棒');
    expect(source).not.toContain('只替换桌面 Felt 的表面纹理');
    expect(source).toContain('图片仅保存在本机，并即时应用到 3D 牌桌。');
  });
});
