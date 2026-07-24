import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import type { GameState, PlayerId } from '../game/types';
import { ResultDialog } from './ResultDialog';

describe('ResultDialog exhaustive draw branch', () => {
  it('renders tenpai, noten, deltas, honba, riichi-stick carry-over, dealer continuation, and tenpai hands', () => {
    const state: GameState = {
      ...createInitialGameState(),
      result: {
        type: 'exhaustive-draw',
        tenpaiPlayers: [0, 1] as PlayerId[],
        notenPlayers: [2, 3] as PlayerId[],
        scoreDeltas: [1500, 1500, -1500, -1500],
        pointDeltas: [1500, 1500, -1500, -1500],
        dealerContinues: true,
        honbaIncrement: 1,
        riichiSticksCarryOver: true,
      },
    };
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('荒牌流局');
    expect(html).toContain('Player 1 手牌');
    expect(html).toContain('Player 2 手牌');
    expect(html).toContain('Player 3');
    expect(html).toContain('+1,500');
    expect(html).toContain('-1,500');
    expect(html).toContain('供托保留');
    expect(html).toContain('庄家连庄');
  });
});
