import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inwardPushVector, seatForPlayer } from './WinPresentationOverlay';

describe('WinPresentationOverlay geometry and semantics', () => {
  it('四方向都朝牌桌中央推进', () => {
    const scene = { width: 1280, height: 720 } as DOMRect;
    expect(inwardPushVector('bottom', scene, 640, 680).y).toBeLessThan(0);
    expect(inwardPushVector('top', scene, 640, 40).y).toBeGreaterThan(0);
    expect(inwardPushVector('left', scene, 40, 360).x).toBeGreaterThan(0);
    expect(inwardPushVector('right', scene, 1240, 360).x).toBeLessThan(0);
  });

  it('visual seat mapping 随 bottomPlayerId 旋转且不继承上一赢家', () => {
    expect([0, 1, 2, 3].map((playerId) => seatForPlayer(playerId as 0 | 1 | 2 | 3, 0))).toEqual(['bottom', 'right', 'top', 'left']);
    expect([0, 1, 2, 3].map((playerId) => seatForPlayer(playerId as 0 | 1 | 2 | 3, 2))).toEqual(['top', 'left', 'bottom', 'right']);
  });

  it('Ron glow 保持真实牌面可读，Tsumo slam 与 overlay 不接管输入', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/game/winPresentationOverlay.css'), 'utf8');
    expect(css).toContain('.win-presentation-winning-discard .tile');
    expect(css).toContain('brightness(1.1)');
    expect(css).toContain('@keyframes win-tile-slam');
    expect(css).toContain('pointer-events: none');
    expect(css).not.toContain('999999');
  });
});
