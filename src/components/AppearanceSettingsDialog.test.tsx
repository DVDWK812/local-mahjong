import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultAppearanceSettings, DEFAULT_APPEARANCE_SETTINGS } from '../presentation/appearance/appearanceSettings';
import { AppearanceSettingsDialog, TileBackColorSetting } from './AppearanceSettingsDialog';
import { PlayerProfileDialog } from './PlayerProfileDialog';
import { DEFAULT_PLAYER_PROFILE } from '../profile/playerProfile';
import { HandAppearanceSettings } from './settings/HandAppearanceSettings';

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

  it('provides the five requested image settings entries with hand enabled', () => {
    const html = renderToStaticMarkup(<AppearanceSettingsDialog settings={createDefaultAppearanceSettings()} onClose={() => undefined} />);
    for (const label of ['图像设置', '牌面设置', '牌背设置', '桌布设置', '立直棒设置', '手部设置']) expect(html).toContain(label);
    expect(html).toContain('手部动画 Pack');
    expect(html).not.toContain('暂未开放');
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

  it('renders one global Pack picker and stable Player 1–4 selectors with previews', () => {
    const html = renderToStaticMarkup(<HandAppearanceSettings settings={createDefaultAppearanceSettings()}
      onChange={() => undefined} onBack={() => undefined} />);
    for (const label of ['全局默认手部', 'Female', 'Female 2', 'Male', 'Orange Cat Paw', 'Grey Cat Paw', 'Dog Paw', 'Gloved', 'Robot', 'Cyberpunk', '赤金龙爪', '青白玉机关', '玩偶手']) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain('Follow Global');
    expect(html).not.toContain('value="inherit"');
    for (const player of [1, 2, 3, 4]) expect(html).toContain(`Player ${player}`);
    expect((html.match(/<img/g) ?? [])).toHaveLength(16);
    expect((html.match(/<select/g) ?? [])).toHaveLength(4);
  });

  it('does not rerun focus restoration when an inline close callback changes identity', () => {
    const sourcePath = decodeURIComponent(new URL('./AppearanceSettingsDialog.tsx', import.meta.url).pathname)
      .replace(/^\/([A-Za-z]:)/, '$1');
    const source = readFileSync(sourcePath, 'utf8');
    expect(source).toContain('const onCloseRef = useRef(onClose)');
    expect(source).toContain('onCloseRef.current()');
    expect(source).toContain('}, []);');
    expect(source).not.toContain('}, [onClose]);');
  });
});
