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
    expect(html).toContain('东家 Player 1');
    expect(html).toContain('南家 Player 2');
    expect((html.match(/公开手牌/g) ?? [])).toHaveLength(2);
    expect(html).toContain('Player 3');
    expect(html).toContain('+1,500');
    expect(html).toContain('-1,500');
    expect(html).toContain('供托保留');
    expect(html).toContain('庄家连庄');
  });

  it('can reveal an additional player hand on draw without changing the default tenpai display', () => {
    const state: GameState = {
      ...createInitialGameState(),
      result: {
        type: 'exhaustive-draw',
        tenpaiPlayers: [0] as PlayerId[],
        notenPlayers: [1, 2, 3] as PlayerId[],
        scoreDeltas: [1500, -500, -500, -500],
        pointDeltas: [1500, -500, -500, -500],
        dealerContinues: true,
        honbaIncrement: 1,
        riichiSticksCarryOver: true,
      },
    };
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} revealExhaustiveDrawPlayerIds={[1]} />);
    expect(html).toContain('东家 Player 1');
    expect(html).toContain('南家 Player 2');
    expect((html.match(/公开手牌/g) ?? [])).toHaveLength(2);
  });
});
