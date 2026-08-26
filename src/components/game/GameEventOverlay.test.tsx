import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameEventOverlay, eventSeatForAction, eventSeatForPlayer } from './GameEventOverlay';

describe('GameEventOverlay', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/components/game/gameEventOverlay.css'), 'utf8');
  const winSource = readFileSync(resolve(process.cwd(), 'src/components/game/WinPresentationOverlay.tsx'), 'utf8');

  it('四方向依照 bottomPlayerId 映射且每次由 event-keyed stage 独立渲染', () => {
    expect([0, 1, 2, 3].map((playerId) => eventSeatForPlayer(playerId as 0 | 1 | 2 | 3, 0)))
      .toEqual(['bottom', 'right', 'top', 'left']);
    expect([0, 1, 2, 3].map((playerId) => eventSeatForPlayer(playerId as 0 | 1 | 2 | 3, 2)))
      .toEqual(['top', 'left', 'bottom', 'right']);
    expect(readFileSync(resolve(process.cwd(), 'src/components/game/GameEventOverlay.tsx'), 'utf8')).toContain('key={visual.action.eventId}');
  });

  it('统一 overlay 不接管输入，并提供强、中、轻三档而非全部巨大中央文字', () => {
    expect(css).toContain('pointer-events: none');
    expect(css).toContain('[data-event-intensity="light"]');
    expect(css).toContain('[data-event-intensity="medium"]');
    expect(css).toContain('[data-event-intensity="strong"]');
    expect(css).toContain('font-size: clamp(24px, 2.35vw, 34px)');
    expect(css).toContain('font-size: clamp(36px, 4vw, 58px)');
    expect(css).not.toContain('999999');
  });

  it('流局使用中央位置，不错误归属到任一家座位', () => {
    expect(eventSeatForAction({
      eventId: 'draw-1',
      sequence: 1,
      type: 'round_end_announced',
      settlementType: 'exhaustive-draw',
    }, 0)).toBe('center');
  });

  it('禁用实时表现时保留空容器但没有事件文字，Win overlay 不再维护第二份文字', () => {
    const html = renderToStaticMarkup(<GameEventOverlay bottomPlayerId={0} enabled={false} />);
    expect(html).toContain('data-event-overlays-enabled="false"');
    expect(html).not.toContain('game-event-overlay-stage');
    expect(winSource).not.toContain('win-presentation-label');
    expect(winSource).not.toContain("? '自摸' : '荣和'");
  });
});
