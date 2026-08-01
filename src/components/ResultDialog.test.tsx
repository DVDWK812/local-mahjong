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
    expect(html).toContain('data-dialog-escape-behavior="blocked"');
    expect(html).toContain('data-dialog-backdrop-behavior="blocked"');
    expect(html).toContain('aria-describedby="result-description"');
  });

  it('回放结果用整局净变化展示，同时保留毛收入与供托说明', () => {
    const base = createInitialGameState();
    const result: NonNullable<GameState['result']> = {
      type: 'tsumo',
      winners: [{
        winner: 2,
        from: null,
        winType: 'tsumo',
        winTile: base.players[2].hand[0],
        yaku: [{ name: '立直', han: 1 }],
        han: 1,
        fu: 30,
        points: 4000,
        pointDeltas: [-1000, -500, 4000, -500],
      }],
      pointDeltas: [-1000, -500, 4000, -500],
    };
    const state: GameState = {
      ...base,
      riichiSticks: 0,
      result,
      players: base.players.map((player, index) => ({
        ...player,
        score: [24000, 24500, 28000, 23500][index],
        riichi: index === 2 || index === 3,
      })),
    };
    const html = renderToStaticMarkup(
      <ResultDialog
        gameState={state}
        onReset={() => undefined}
        displayPointDeltas={[-1000, -500, 3000, -1500]}
        resultRiichiSticks={2}
      />,
    );
    expect(html).toContain('牌型得点：2,000点');
    expect(html).toContain('供托奖励：2根 × 1000点 = 2,000点');
    expect(html).toContain('获得总计：4,000点');
    expect(html).toContain('+3,000');
    expect(html).toContain('-1,500');
  });

  it('权威供托清零后仍从结算快照展示供托奖励', () => {
    const base = createInitialGameState();
    const state: GameState = {
      ...base,
      riichiSticks: 0,
      result: {
        type: 'ron',
        settlementRiichiSticks: 3,
        winners: [{
          winner: 1,
          from: 0,
          winType: 'ron',
          winTile: base.players[0].hand[0],
          yaku: [{ name: '断幺九', han: 1 }],
          han: 1,
          fu: 30,
          points: 4000,
          pointDeltas: [-1000, 4000, 0, 0],
        }],
        pointDeltas: [-1000, 4000, 0, 0],
      },
    };
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('供托奖励：3根 × 1000点 = 3,000点');
    expect(html).toContain('牌型得点：1,000点');
  });
});
