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
  getSeventeenStepsEffectiveHan,
  getSeventeenStepsRestrictionDora,
  moveFixedTile,
  selectFixedTile,
  settleDraw,
} from './seventeenSteps';
import type { ScoreResult } from './scoreCalculator';
import { createTile } from './tileUtils';

function fixedHandForEffectiveTenpai(): ReturnType<typeof createTile>[] {
  return [
    createTile(4, 1), createTile(4, 2), createTile(5, 1), createTile(6, 1), createTile(7, 1),
    createTile(10, 1), createTile(11, 1), createTile(12, 1),
    createTile(19, 1), createTile(20, 1), createTile(21, 1),
    createTile(22, 1), createTile(22, 2),
  ];
}

function fixedHandForStructuralOnlyTenpai(): ReturnType<typeof createTile>[] {
  return [
    createTile(4, 1), createTile(4, 2), createTile(5, 1), createTile(6, 1), createTile(7, 1),
    createTile(9, 1), createTile(10, 1), createTile(11, 1),
    createTile(18, 1), createTile(19, 1), createTile(20, 1),
    createTile(8, 1), createTile(8, 2),
  ];
}

function fixedHandForNoten(): ReturnType<typeof createTile>[] {
  return [
    createTile(27, 1), createTile(27, 2),
    createTile(28, 1), createTile(28, 2),
    createTile(29, 1), createTile(29, 2),
    createTile(30, 1), createTile(30, 2),
    createTile(31, 1), createTile(31, 2),
    createTile(32, 1), createTile(33, 1), createTile(26, 1),
  ];
}

function settleDrawForTest(player0Hand: ReturnType<typeof createTile>[], player1Hand: ReturnType<typeof createTile>[]) {
  const state = createSeventeenStepsGame({
    ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG,
    hanRestriction: 2,
    countDoraForHanRestriction: true,
    roundRuleConfig: { ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG.roundRuleConfig, akaDora: false },
  });
  state.phase = 'active';
  state.currentPlayerId = 0;
  state.doraIndicators = [];
  state.players = [
    { ...state.players[0], fixedHand: player0Hand, buildConfirmed: true, discardCount: 17, discardCandidates: [], discardedTiles: [] },
    { ...state.players[1], fixedHand: player1Hand, buildConfirmed: true, discardCount: 17, discardCandidates: [], discardedTiles: [] },
  ];
  return settleDraw(state);
}

describe('17步麻将模式', () => {
  it('默认使用心转手、50000起始点数，并关闭双倍和多倍役满', () => {
    const state = createSeventeenStepsGame();
    expect(state.matchConfig.aiDifficulty).toBe('shintentai');
    expect(state.matchConfig.startingPoints).toBe(50000);
    expect(state.scores).toEqual([50000, 50000]);
    expect(state.matchConfig.roundRuleConfig.allowDoubleYakuman).toBe(false);
    expect(state.matchConfig.roundRuleConfig.multipleYakuman).toBe(false);
  });

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

  it('分析5m待牌时不会把假想的赤5m作为赤宝牌计入', () => {
    const state = createSeventeenStepsGame({
      ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG,
      countDoraForHanRestriction: true,
    });
    state.doraIndicators = [createTile(11, 1)];
    state.players[0].fixedHand = [
      createTile(4, 1), createTile(4, 2), createTile(5, 1), createTile(6, 1), createTile(7, 1),
      createTile(10, 1), createTile(11, 1), createTile(12, 1),
      createTile(19, 1), createTile(20, 1), createTile(21, 1),
      createTile(22, 0), createTile(22, 1),
    ];
    const wait = analyzeSeventeenStepsTenpai(state, 0).find((item) => item.id === 4);
    expect(wait?.score.redDora).toBe(1);
    expect(wait?.score.dora).toBe(1);
    expect(wait?.doraCount).toBe(2);
  });

  it('5m普通牌不足番缚时，只有和到赤5m才能满足并明确标记', () => {
    const state = createSeventeenStepsGame({
      ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG,
      hanRestriction: 5,
      countDoraForHanRestriction: true,
    });
    state.doraIndicators = [createTile(11, 1)];
    state.players[0].fixedHand = [
      createTile(4, 1), createTile(4, 2), createTile(5, 1), createTile(6, 1), createTile(7, 1),
      createTile(10, 1), createTile(11, 1), createTile(12, 1),
      createTile(19, 1), createTile(20, 1), createTile(21, 1),
      createTile(22, 0), createTile(22, 1),
    ];
    const wait = analyzeSeventeenStepsTenpai(state, 0).find((item) => item.id === 4);
    expect(wait?.redDoraOnly).toBe(true);
    expect(wait?.meetsHanRestriction).toBe(true);
    expect(wait?.restrictionHan).toBe(5);
    expect(wait?.doraCount).toBe(3);
  });

  it('关闭赤宝牌后，赤5m不能作为满足番缚的条件', () => {
    const state = createSeventeenStepsGame({
      ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG,
      hanRestriction: 5,
      countDoraForHanRestriction: true,
      roundRuleConfig: { ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG.roundRuleConfig, akaDora: false },
    });
    state.doraIndicators = [createTile(11, 1)];
    state.players[0].fixedHand = [
      createTile(4, 1), createTile(4, 2), createTile(5, 1), createTile(6, 1), createTile(7, 1),
      createTile(10, 1), createTile(11, 1), createTile(12, 1),
      createTile(19, 1), createTile(20, 1), createTile(21, 1),
      createTile(22, 0), createTile(22, 1),
    ];
    const wait = analyzeSeventeenStepsTenpai(state, 0).find((item) => item.id === 4);
    expect(wait?.redDoraOnly).toBe(false);
    expect(wait?.meetsHanRestriction).toBe(false);
    expect(wait?.restrictionHan).toBe(3);
    expect(wait?.doraCount).toBe(1);
  });

  it('流局时普通5m不足番缚但赤5m可满足的玩家视为有效听牌', () => {
    const state = createSeventeenStepsGame({
      ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG,
      hanRestriction: 5,
      countDoraForHanRestriction: true,
    });
    state.phase = 'active';
    state.doraIndicators = [createTile(11, 1)];
    state.players = [
      { ...state.players[0], fixedHand: [
        createTile(4, 1), createTile(4, 2), createTile(5, 1), createTile(6, 1), createTile(7, 1),
        createTile(10, 1), createTile(11, 1), createTile(12, 1),
        createTile(19, 1), createTile(20, 1), createTile(21, 1),
        createTile(22, 0), createTile(22, 1),
      ], discardCount: 17 },
      { ...state.players[1], fixedHand: fixedHandForNoten(), discardCount: 17 },
    ];
    const settled = settleDraw(state);
    expect(settled.result?.type).toBe('draw');
    if (settled.result?.type === 'draw') {
      expect(settled.result.validTenpai).toEqual([true, false]);
      expect(settled.result.pointDeltas).toEqual([12000, -12000]);
    }
  });

  it.each([
    ['有效听牌 vs 有效听牌', fixedHandForEffectiveTenpai(), fixedHandForEffectiveTenpai(), [true, true], [0, 0]],
    ['有效听牌 vs 结构听牌但未达到番缚', fixedHandForEffectiveTenpai(), fixedHandForStructuralOnlyTenpai(), [true, false], [12000, -12000]],
    ['有效听牌 vs 未听牌', fixedHandForEffectiveTenpai(), fixedHandForNoten(), [true, false], [12000, -12000]],
    ['未达到番缚 vs 未达到番缚', fixedHandForStructuralOnlyTenpai(), fixedHandForStructuralOnlyTenpai(), [false, false], [-12000, -8000]],
    ['未听牌 vs 未听牌', fixedHandForNoten(), fixedHandForNoten(), [false, false], [-12000, -8000]],
    ['未听牌 vs 听牌但未达到番缚', fixedHandForNoten(), fixedHandForStructuralOnlyTenpai(), [false, false], [-12000, -8000]],
  ])('%s时按有效听牌结算罚点', (_label, player0Hand, player1Hand, validTenpai, pointDeltas) => {
    const state = settleDrawForTest(player0Hand, player1Hand);
    expect(state.result?.type).toBe('draw');
    if (state.result?.type === 'draw') {
      expect(state.result.validTenpai).toEqual(validTenpai);
      expect(state.result.pointDeltas).toEqual(pointDeltas);
    }
  });

  it('构筑阶段将四暗刻单骑记录为双倍役满，并正确处理累计和多倍役满', () => {
    const state = createSeventeenStepsGame({
      ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG,
      roundRuleConfig: { ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG.roundRuleConfig, allowDoubleYakuman: true, multipleYakuman: true },
    });
    state.players[0].fixedHand = [0, 0, 0, 9, 9, 9, 18, 18, 18, 27, 27, 27, 5].map((id, index) => createTile(id as never, index % 4));
    const wait = analyzeSeventeenStepsTenpai(state, 0).find((item) => item.id === 5);
    expect(wait?.score.yaku.some((item) => item.yakumanValue === 2)).toBe(true);
    expect(wait?.score.han).toBe(0);
    expect(wait?.effectiveHan).toBe(26);
    expect(wait?.restrictionHan).toBe(26);

    const score = (yakumanValue: number, han = 0) => ({ yakumanValue, han } as ScoreResult);
    expect(getSeventeenStepsEffectiveHan(score(1))).toBe(13);
    expect(getSeventeenStepsEffectiveHan(score(2))).toBe(26);
    expect(getSeventeenStepsEffectiveHan(score(3))).toBe(39);
    expect(getSeventeenStepsEffectiveHan(score(0, 13))).toBe(13);
    expect(getSeventeenStepsHanRestriction(state, score(3))).toBe(39);
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
