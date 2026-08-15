import { describe, expect, it } from 'vitest';
import {
  analyzeSeventeenStepsTenpai,
  canSeventeenStepsRon,
  advanceSeventeenStepsMatch,
  confirmBuild,
  createSeventeenStepsGame,
  DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG,
  discardCandidate,
  getSeventeenStepsHanRestriction,
  getSeventeenStepsRestrictionDora,
  moveFixedTile,
  selectFixedTile,
} from './seventeenSteps';
import type { ScoreResult } from './scoreCalculator';
import { createTile } from './tileUtils';

describe('17步麻将模式', () => {
  it('双方各获得34张私有牌，构筑阶段只允许选择自己的牌', () => {
    const state = createSeventeenStepsGame();
    expect(state.phase).toBe('build');
    expect(state.players[0].sourceTiles).toHaveLength(34);
    expect(state.players[1].sourceTiles).toHaveLength(34);
    expect(state.players[1].buildConfirmed).toBe(true);

    const selected = selectFixedTile(state, 0, state.players[0].sourceTiles[0].instanceId);
    expect(selected.players[0].fixedHand).toHaveLength(1);
    expect(selected.players[1].fixedHand).toHaveLength(13);
  });

  it('支持将构筑牌在弃牌区与手牌区之间移动', () => {
    let state = createSeventeenStepsGame();
    const tile = state.players[0].sourceTiles[0];
    state = moveFixedTile(state, 0, tile.instanceId, true);
    expect(state.players[0].fixedHand).toHaveLength(1);
    state = moveFixedTile(state, 0, tile.instanceId, false);
    expect(state.players[0].fixedHand).toHaveLength(0);
  });

  it('两人模式只使用东/西风位，并支持下一局交换庄家', () => {
    const firstRound = createSeventeenStepsGame(0);
    const nextRound = createSeventeenStepsGame(1);
    expect(firstRound.players.map((player) => player.seatWind)).toEqual(['east', 'west']);
    expect(nextRound.players.map((player) => player.seatWind)).toEqual(['west', 'east']);
    expect(nextRound.dealerId).toBe(1);
  });

  it('必须选择13张，确认后固定手牌不可修改且候选池为21张', () => {
    let state = createSeventeenStepsGame();
    state.players[0].sourceTiles.slice(0, 12).forEach((tile) => {
      state = selectFixedTile(state, 0, tile.instanceId);
    });
    expect(confirmBuild(state, 0)).toBe(state);

    state = selectFixedTile(state, 0, state.players[0].sourceTiles[12].instanceId);
    state = confirmBuild(state, 0);
    expect(state.phase).toBe('active');
    expect(state.players[0].fixedHand).toHaveLength(13);
    expect(state.players[0].discardCandidates).toHaveLength(21);

    const fixedId = state.players[0].fixedHand[0].instanceId;
    expect(selectFixedTile(state, 0, fixedId)).toBe(state);
  });

  it('弃牌只从候选池移除，并且每人最多17次', () => {
    let state = createSeventeenStepsGame();
    state.players[0].sourceTiles.slice(0, 13).forEach((tile) => {
      state = selectFixedTile(state, 0, tile.instanceId);
    });
    state = confirmBuild(state, 0);
    const candidate = state.players[0].discardCandidates[0];
    state = discardCandidate(state, 0, candidate.instanceId);
    expect(state.players[0].discardCount).toBe(1);
    expect(state.players[0].discardCandidates).toHaveLength(20);
    expect(state.players[0].discardedTiles[0].instanceId).toBe(candidate.instanceId);
  });

  it('强制立直可以参与役满荣和判定，但不允许低于满贯的和牌', () => {
    const state = createSeventeenStepsGame();
    const kokushi = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33].map((id, copy) => createTile(id as never, copy));
    state.players[0].fixedHand = kokushi;
    state.players[0].permanentFuriten = false;
    const score = canSeventeenStepsRon(state, 0, createTile(0, 3));
    expect(score?.isWinning).toBe(true);
    expect(score?.points.limitName).toBeTruthy();
    const analysis = analyzeSeventeenStepsTenpai(state, 0);
    expect(analysis.find((wait) => wait.id === 0)?.meetsHanRestriction).toBe(true);
    expect(analysis.find((wait) => wait.id === 0)?.doraCount).toEqual(expect.any(Number));
  });

  it('番缚宝牌只计普通宝牌和赤宝牌，不计里宝牌', () => {
    const state = createSeventeenStepsGame({
      ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG,
      countDoraForHanRestriction: true,
    });
    const score = {
      yaku: [{ name: '测试役', han: 2 }],
      dora: 1,
      uraDora: 4,
      redDora: 2,
    } as unknown as ScoreResult;

    expect(getSeventeenStepsRestrictionDora(state, score)).toBe(3);
    expect(getSeventeenStepsHanRestriction(state, score)).toBe(5);
  });
  it('比赛场数按来回换算为2、4、6、8局', () => {
    expect([1, 2, 3, 4].map((cycleCount) => createSeventeenStepsGame({ ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG, cycleCount: cycleCount as 1 | 2 | 3 | 4 }).totalHands)).toEqual([2, 4, 6, 8]);
  });

  it('完成一局后交换东/西座风，完成来回后推进场风并保留累计点数', () => {
    const initial = createSeventeenStepsGame({ ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG, cycleCount: 2 });
    const ended = {
      ...initial,
      phase: 'round-ended' as const,
      scores: [27000, 23000] as [number, number],
      result: {
        type: 'draw' as const,
        validTenpai: [false, false] as [boolean, boolean],
        pointDeltas: [0, 0] as [number, number],
        scoresBefore: [25000, 25000] as [number, number],
        scoresAfter: [27000, 23000] as [number, number],
      },
    };
    const secondHand = advanceSeventeenStepsMatch(ended);
    expect(secondHand.dealerId).toBe(1);
    expect(secondHand.players.map((player) => player.seatWind)).toEqual(['west', 'east']);
    expect(secondHand.prevailingWind).toBe('east');
    expect(secondHand.scores).toEqual([27000, 23000]);

    const secondEnded = { ...secondHand, phase: 'round-ended' as const, result: ended.result };
    const southHand = advanceSeventeenStepsMatch(secondEnded);
    expect(southHand.dealerId).toBe(0);
    expect(southHand.prevailingWind).toBe('south');
    expect(southHand.handInCycle).toBe(0);
  });

  it('击飞结束开启时，任一玩家结算后点数为负则比赛结束', () => {
    const initial = createSeventeenStepsGame({ ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG, cycleCount: 4, bankruptcyEndsMatch: true });
    const ended = {
      ...initial,
      phase: 'round-ended' as const,
      scores: [-100, 50100] as [number, number],
      result: {
        type: 'draw' as const,
        validTenpai: [false, false] as [boolean, boolean],
        pointDeltas: [0, 0] as [number, number],
        scoresBefore: [0, 50000] as [number, number],
        scoresAfter: [-100, 50100] as [number, number],
      },
    };
    expect(advanceSeventeenStepsMatch(ended).phase).toBe('match-ended');
  });
});
