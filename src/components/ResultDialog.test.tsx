import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import type { GameState } from '../game/types';
import { ResultDialog } from './ResultDialog';

describe('ResultDialog', () => {
  it('多人荣和时分别显示每位和牌者明细和点数变化', () => {
    const base = createInitialGameState();
    const state: GameState = {
      ...base,
      result: {
        type: 'ron',
        winners: [
          {
            winner: 0,
            from: 2,
            winType: 'ron',
            winTile: base.players[2].river[0] ?? base.players[0].hand[0],
            yaku: [{ name: '断幺九', han: 1 }],
            han: 1,
            fu: 30,
            points: 1000,
            pointDeltas: [1000, 0, -1000, 0],
          },
          {
            winner: 1,
            from: 2,
            winType: 'ron',
            winTile: base.players[0].hand[1],
            yaku: [{ name: '宝牌', han: 1 }],
            han: 1,
            fu: 30,
            points: 1000,
            pointDeltas: [0, 1000, -1000, 0],
          },
        ],
        pointDeltas: [1000, 1000, -2000, 0],
      },
    };
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('2 人荣和');
    expect(html).toContain('断幺九');
    expect(html).toContain('宝牌');
    expect(html).toContain('点数变化');
    expect(html).toContain('继续');
  });
});
