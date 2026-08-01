import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_TABLE_VIEWPORT,
  DesktopTableViewport,
  calculateDesktopTableViewport,
} from './DesktopTableViewport';

describe('STAB-012 桌面牌桌视口契约', () => {
  it.each([
    [1280, 720],
    [1366, 768],
    [1600, 900],
    [1920, 1080],
    [2560, 1440],
    [3840, 2160],
  ])('%d×%d 只负责最低桌面视口守卫，不再计算第二层缩放', (width, height) => {
    expect(calculateDesktopTableViewport(width, height)).toEqual({
      supported: true,
      scale: 1,
    });
  });

  it.each([
    [1279, 720],
    [1280, 719],
  ])('%d×%d 明确拒绝而不继续压缩', (width, height) => {
    expect(calculateDesktopTableViewport(width, height)).toEqual({ supported: false, scale: 1 });
  });

  it('尺寸过小时显示最低要求和可操作返回按钮', () => {
    const html = renderToStaticMarkup(
      <DesktopTableViewport surface="game" viewportSize={{ width: 1279, height: 720 }} onReturnMenu={() => undefined}>
        <div>不应显示的牌桌</div>
      </DesktopTableViewport>,
    );
    expect(html).toContain('当前窗口尺寸过小');
    expect(html).toContain('最低需要横屏 1280×720');
    expect(html).toContain('返回菜单');
    expect(html).not.toContain('不应显示的牌桌');
  });

  it('支持尺寸输出桌面表面但不产生第二个缩放画布', () => {
    const html = renderToStaticMarkup(
      <DesktopTableViewport surface="replay" viewportSize={{ width: 1600, height: 900 }} onReturnMenu={() => undefined}>
        <div>牌桌内容</div>
      </DesktopTableViewport>,
    );
    expect(html).toContain('data-desktop-table-surface="replay"');
    expect(html).toContain('data-desktop-table-supported="true"');
    expect(html).toContain('class="desktop-table-surface"');
    expect(html).not.toContain('--desktop-table-scale');
    expect(html).not.toContain('desktop-table-viewport__canvas');
    expect(html).toContain('牌桌内容');
  });

  it('STAB-012实现只测量自身实际容器，不读取分辨率偏好或设备模拟倍率', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/DesktopTableViewport.tsx'), 'utf8');
    expect(source).toContain('ResizeObserver');
    expect(source).toContain('getBoundingClientRect');
    expect(source).not.toContain('useAppResolutionViewport');
    expect(source).not.toMatch(/resolutionPreset|devicePixelRatio|visualViewport\.scale/);
  });
});
