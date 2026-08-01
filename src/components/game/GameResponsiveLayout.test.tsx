import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Game responsive layout CSS', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('应用根层使用实际视口且没有应用级或牌桌级transform缩放', () => {
    expect(css).toContain('.app-resolution-viewport');
    expect(css).not.toContain('.app-resolution-canvas');
    expect(css).not.toContain('--app-design-width');
    expect(css).not.toContain('--app-design-height');
    expect(css).not.toContain('transform: scale(var(--app-resolution-scale))');
    expect(css).not.toContain('transform: scale(var(--desktop-table-scale))');
    expect(css).toContain('.game-screen');
    expect(css).toContain('height: 100%');
    expect(css).toContain('width: 100%');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('grid-template-rows: auto minmax(0, 1fr) auto');
  });

  it('牌河固定为6.5张宽和4行高，不因弃牌数量缩成细条', () => {
    expect(css).toContain('--river-area-width');
    expect(css).toContain('--river-area-height');
    expect(css).toContain('grid-template-columns: repeat(13, var(--river-half-width))');
    expect(css).toContain('max-height: var(--river-area-height)');
    expect(css).toContain('overflow: visible');
  });

  it('动作提示固定在牌桌底部且分析抽屉内部滚动', () => {
    expect(css).toContain('.game-prompt-layer');
    expect(css).toContain('position: absolute');
    expect(css).toContain('.analysis-drawer-body');
    expect(css).toContain('overflow: auto');
  });

  it('桌面逻辑牌桌使用固定牌尺寸且不包含手机牌桌断点', () => {
    expect(css).toContain('--hand-tile-width: 39px');
    expect(css).toContain('--river-tile-width: 27px');
    expect(css).toContain('--opponent-tile-width: 23px');
    expect(css).not.toMatch(/@media \(max-width: 900px\)\s*\{\s*\.game-screen/s);
  });

  it('正常游戏、牌谱和测试模式声明同一桌面视口表面', () => {
    const game = readFileSync(resolve(process.cwd(), 'src/components/game/GameScreen.tsx'), 'utf8');
    const replay = readFileSync(resolve(process.cwd(), 'src/components/ReplayScreen.tsx'), 'utf8');
    const testMode = readFileSync(resolve(process.cwd(), 'src/components/TestModeScreen.tsx'), 'utf8');
    expect(game).toContain('surface="game"');
    expect(replay).toContain('surface="replay"');
    expect(testMode).toContain('surface="test-mode"');
  });
});
