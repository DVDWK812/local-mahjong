import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Game responsive layout CSS', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('对局页根节点具有单屏无滚动布局', () => {
    expect(css).toContain('.game-screen');
    expect(css).toContain('height: 100dvh');
    expect(css).toContain('width: 100vw');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('grid-template-rows: auto minmax(0, 1fr) auto');
  });

  it('牌河固定为6.5张宽和4行高，不因弃牌数量缩成细条', () => {
    expect(css).toContain('--river-area-width');
    expect(css).toContain('--river-area-height');
    expect(css).toMatch(/\.discard-river-grid\s*\{[^}]*display: flex[^}]*flex-direction: column/s);
    expect(css).toMatch(/\.discard-river-row\s*\{[^}]*min-width: max-content/s);
    expect(css).toContain('max-height: var(--river-area-height)');
    expect(css).toContain('overflow: visible');
  });

  it('动作提示固定在牌桌底部且分析抽屉内部滚动', () => {
    expect(css).toContain('.game-prompt-layer');
    expect(css).toContain('position: absolute');
    expect(css).toContain('.analysis-drawer-body');
    expect(css).toContain('overflow: auto');
  });

  it('桌面和小屏均使用 clamp 缩放牌尺寸', () => {
    expect(css).toContain('--hand-tile-width: clamp');
    expect(css).toContain('--river-tile-width: clamp');
    expect(css).toContain('@media (max-width: 900px)');
  });
});
