import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResultDialog } from './ResultDialog';
import { createInitialGameState } from '../game/engine';

describe('ResultDialog abortive draw display', () => {
  it('shows abortive draw reason and carry-over details', () => {
    const state = {
      ...createInitialGameState(),
      result: {
        type: 'abortive-draw' as const,
        reason: 'suucha-riichi' as const,
        dealerContinues: true,
        honbaIncrement: 1,
        riichiSticksCarryOver: true,
        scoreDeltas: [0, 0, 0, 0],
        pointDeltas: [0, 0, 0, 0],
      },
    };
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('四家立直');
    expect(html).toContain('供托保留');
  });
});
