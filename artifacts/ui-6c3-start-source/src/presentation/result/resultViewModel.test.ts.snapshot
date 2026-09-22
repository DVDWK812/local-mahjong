import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createTile } from '../../game/tileUtils';
import type { GameState, PlayerId, WinResultEntry } from '../../game/types';
import { buildResultViewModel } from './resultViewModel';

function win(overrides: Partial<WinResultEntry> = {}): WinResultEntry {
  return {
    winner: 1,
    from: 0,
    winType: 'ron',
    winTile: createTile(13, 0),
    yaku: [{ id: 'pinfu', name: '平和', han: 1 }, { name: '宝牌', han: 2 }],
    dora: 2,
    uraDora: 1,
    redDora: 1,
    totalDora: 4,
    limitTier: 'mangan',
    yakumanMultiplier: 0,
    han: 5,
    fu: 30,
    points: 8000,
    pointDeltas: [-8000, 8000, 0, 0],
    ...overrides,
  };
}

function winState(winners: WinResultEntry[]): GameState {
  const base = createInitialGameState();
  return {
    ...base,
    result: {
      type: winners[0].winType,
      winners,
      pointDeltas: winners.reduce((combined, winner) => combined.map((delta, index) => delta + (winner.pointDeltas[index] ?? 0)), [0, 0, 0, 0]),
    },
  };
}

describe('buildResultViewModel', () => {
  it('Ron 逐字段采用 confirmed winner/result，不重新计算役、番符、Dora、等级与点数', () => {
    const state = winState([win()]);
    const model = buildResultViewModel(state);
    expect(model?.kind).toBe('win');
    if (!model || model.kind !== 'win') throw new Error('Expected win model');
    expect(model.winners[0]).toMatchObject({
      actionLabel: '荣和', han: 5, fu: 30, limitLabel: '满贯', resultPoints: 8000, winnerDelta: 8000,
      dora: { available: true, dora: 2, uraDora: 1, redDora: 1, totalDora: 4 },
    });
    expect(model.winners[0].yaku).toEqual([{ id: 'pinfu', name: '平和', han: 1 }]);
    expect(model.scoreChanges.map((row) => row.delta)).toEqual(state.result?.pointDeltas);
  });

  it('Tsumo 保留自摸张分区，并直接显示每家的 confirmed payment delta', () => {
    const entry = win({ winner: 0, from: null, winType: 'tsumo', points: 6000, pointDeltas: [6000, -2000, -2000, -2000] });
    const base = createInitialGameState();
    const state = winState([entry]);
    state.players[0] = { ...base.players[0], hand: [...base.players[0].hand.slice(0, 13), entry.winTile], drawnTile: entry.winTile };
    const model = buildResultViewModel(state);
    if (!model || model.kind !== 'win') throw new Error('Expected win model');
    expect(model.title).toBe('自摸');
    expect(model.winners[0].concealedTiles).toHaveLength(13);
    expect(model.winners[0].winningTile).toBe(entry.winTile);
    expect(model.scoreChanges.map((row) => row.delta)).toEqual([6000, -2000, -2000, -2000]);
  });

  it('multiple Ron 依照 authoritative winners 顺序建立独立赢家区', () => {
    const first = win();
    const second = win({ winner: 2, pointDeltas: [-3900, 0, 3900, 0], points: 3900, limitTier: 'none' });
    const model = buildResultViewModel(winState([first, second]));
    if (!model || model.kind !== 'win') throw new Error('Expected win model');
    expect(model.subtitle).toBe('2 人荣和');
    expect(model.winners.map((winner) => winner.source)).toEqual([first, second]);
  });

  it('yakuman 只读取 semantic multiplier，不从番符或役名推断', () => {
    const model = buildResultViewModel(winState([win({ limitTier: 'yakuman', yakumanMultiplier: 2, han: 0, fu: 0 })]));
    if (!model || model.kind !== 'win') throw new Error('Expected win model');
    expect(model.winners[0].limitLabel).toBe('2倍役满');
  });

  it('普通流局按 result 的听牌名单与 pointDeltas 建立四家状态', () => {
    const state: GameState = {
      ...createInitialGameState(),
      result: {
        type: 'exhaustive-draw', tenpaiPlayers: [0, 2] as PlayerId[], notenPlayers: [1, 3] as PlayerId[],
        scoreDeltas: [1500, -1500, 1500, -1500], pointDeltas: [1500, -1500, 1500, -1500],
        dealerContinues: true, honbaIncrement: 1, riichiSticksCarryOver: true,
      },
    };
    const model = buildResultViewModel(state);
    if (!model || model.kind !== 'draw') throw new Error('Expected draw model');
    expect(model.players.map((player) => [player.status, player.delta])).toEqual([
      ['听牌', 1500], ['未听牌', -1500], ['听牌', 1500], ['未听牌', -1500],
    ]);
    expect(model.scoreChanges.map((row) => row.delta)).toEqual(state.result?.pointDeltas);
  });

  it('17 步可用 visible players、原始 deltas 与前后点数适配同一模型', () => {
    const state: GameState = {
      ...createInitialGameState(),
      result: {
        type: 'exhaustive-draw', tenpaiPlayers: [0], notenPlayers: [1],
        scoreDeltas: [1000, -1000, 0, 0], pointDeltas: [1000, -1000, 0, 0],
        dealerContinues: false, honbaIncrement: 0, riichiSticksCarryOver: false,
      },
    };
    const model = buildResultViewModel(state, {
      visiblePlayerIds: [0, 1], pointDeltas: [500, -500], scoreBefore: [25000, 25000], scoreAfter: [25500, 24500],
    });
    expect(model?.scoreChanges).toHaveLength(2);
    expect(model?.scoreChanges).toEqual([
      expect.objectContaining({ playerId: 0, delta: 500, scoreBefore: 25000, scoreAfter: 25500 }),
      expect.objectContaining({ playerId: 1, delta: -500, scoreBefore: 25000, scoreAfter: 24500 }),
    ]);
  });
});
