import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import type { GameState } from '../game/types';
import type { SeventeenStepsWaitAnalysis } from '../game/seventeenSteps';
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

  it('可隐藏普通宝牌指示牌但保留立直者的里宝牌指示牌', () => {
    const base = createInitialGameState();
    const state: GameState = {
      ...base,
      players: base.players.map((player, index) => index === 0 ? { ...player, riichi: true } : player),
      result: {
        type: 'tsumo',
        winners: [{
          winner: 0,
          from: null,
          winType: 'tsumo',
          winTile: base.players[0].hand[0],
          yaku: [{ name: '断幺九', han: 1 }],
          han: 1,
          fu: 30,
          points: 1000,
          pointDeltas: [1000, -500, -250, -250],
        }],
        pointDeltas: [1000, -500, -250, -250],
      },
    };
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} showDoraIndicators={false} />);
    expect(html).not.toContain('宝牌指示牌');
    expect(html).toContain('里宝牌');
  });

  it('17步荣和使用实际牌型得点变化，不扣除不存在的立直棒', () => {
    const base = createInitialGameState();
    const state: GameState = {
      ...base,
      players: base.players.map((player, index) => index < 2 ? { ...player, riichi: true } : player),
      result: {
        type: 'ron',
        winners: [{
          winner: 0,
          from: 1,
          winType: 'ron',
          winTile: base.players[1].hand[0],
          yaku: [{ name: '立直', han: 1 }],
          han: 6,
          fu: 25,
          points: 18000,
          pointDeltas: [18000, -18000, 0, 0],
        }],
        pointDeltas: [18000, -18000, 0, 0],
      },
    };
    const html = renderToStaticMarkup(
      <ResultDialog
        gameState={state}
        onReset={() => undefined}
        displayPointDeltas={[18000, -18000, 0, 0]}
        visiblePlayerIds={[0, 1]}
        scoreBefore={[44000, 56000, 0, 0]}
        scoreAfter={[62000, 38000, 0, 0]}
      />,
    );
    expect(html).toContain('+18,000');
    expect(html).toContain('-18,000');
    expect(html).not.toContain('+17,000');
    expect(html).not.toContain('-19,000');
  });

  it('17步流局结算按构筑阶段格式显示对手待牌、番数和役种', () => {
    const base = createInitialGameState();
    const wait = {
      id: 0,
      remaining: 2,
      score: { yakumanValue: 0, han: 3, yaku: [{ name: '立直', han: 1 }] },
      effectiveHan: 3,
      doraCount: 0,
      restrictionHan: 3,
      meetsHanRestriction: true,
    } as unknown as SeventeenStepsWaitAnalysis;
    const state: GameState = {
      ...base,
      result: {
        type: 'exhaustive-draw',
        tenpaiPlayers: [0],
        notenPlayers: [1, 2, 3],
        scoreDeltas: [0, 0, 0, 0],
        pointDeltas: [0, 0, 0, 0],
        dealerContinues: true,
        honbaIncrement: 0,
        riichiSticksCarryOver: false,
      },
    };
    const html = renderToStaticMarkup(
      <ResultDialog
        gameState={state}
        onReset={() => undefined}
        seventeenStepsDrawAnalysis={[wait]}
        seventeenStepsKazoeYakumanMode="yakuman"
      />,
    );
    expect(html).toContain('听牌分析');
    expect(html).toContain('剩余 2');
    expect(html).toContain('3番');
    expect(html).toContain('立直');
    expect(html).toContain('番缚满足');
  });
});
