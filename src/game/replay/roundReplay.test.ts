import { describe, expect, it } from 'vitest';
import { getRulePreset } from '../match/matchRules';
import type { ExhaustiveDrawResult, TileId, WinRoundResult } from '../types';
import { createTile } from '../tileUtils';
import { buildReplayState, initialScoresForRound, replayConservedPoints, resolveReplayFinalScores } from './roundReplay';
import type { GameEvent, MatchLog, RoundLog, TileSnapshot } from './types';

function tile(tileId: TileId, instanceId: string, red = false): TileSnapshot {
  return { tileId, instanceId, red };
}

function deadWall(): TileSnapshot[] {
  return Array.from({ length: 14 }, (_, index) => tile((20 + index) as TileId, `dead-${index}`));
}

function baseRound(events: GameEvent[] = []): RoundLog {
  const dead = deadWall();
  return {
    roundId: 'round-1',
    roundWind: 'east',
    handNumber: 1,
    dealer: 0,
    honba: 1,
    riichiSticks: 0,
    initialScores: [25000, 26000, 24000, 25000],
    initialHands: [
      [tile(0, 'p0-a'), tile(4, 'p0-red', true)],
      [tile(1, 'p1-a'), tile(2, 'p1-b'), tile(3, 'p1-c')],
      [tile(5, 'p2-a'), tile(5, 'p2-b'), tile(5, 'p2-c'), tile(5, 'p2-d')],
      [tile(6, 'p3-a'), tile(6, 'p3-b'), tile(6, 'p3-c'), tile(6, 'p3-d')],
    ],
    initialDoraIndicators: [dead[4]],
    liveWall: [tile(7, 'live-0'), tile(8, 'live-1')],
    deadWall: dead,
    wallOrder: [tile(7, 'live-0'), tile(8, 'live-1'), ...dead],
    events,
  };
}

function event<T extends Omit<GameEvent, 'eventId' | 'sequence' | 'roundId'>>(sequence: number, input: T): GameEvent {
  return {
    ...input,
    eventId: `event-${sequence}`,
    sequence,
    roundId: 'round-1',
  } as GameEvent;
}

describe('buildReplayState', () => {
  it('初始步骤还原配牌、分数、庄家、宝牌和牌山', () => {
    const state = buildReplayState(baseRound(), 0, { ruleConfig: getRulePreset('east-round') });
    expect(state.gameState.dealer).toBe(0);
    expect(state.gameState.honba).toBe(1);
    expect(state.gameState.players.map((player) => player.score)).toEqual([25000, 26000, 24000, 25000]);
    expect(state.gameState.players[0].hand.map((entry) => entry.instanceId)).toEqual(['p0-a', 'p0-red']);
    expect(state.gameState.doraIndicators[0].instanceId).toBe('dead-4');
    expect(state.wall.liveWall).toHaveLength(2);
    expect(state.wall.rinshanRemaining).toBe(4);
  });

  it('摸牌和弃牌前进后退保持确定且 instanceId 与赤牌不丢失', () => {
    const round = baseRound([
      event(0, { type: 'tile-drawn', actor: 0, tile: tile(7, 'live-0'), source: 'live-wall' }),
      event(1, { type: 'tile-discarded', actor: 0, tile: tile(4, 'p0-red', true) }),
    ]);
    const initial = buildReplayState(round, 0);
    const drawn = buildReplayState(round, 1);
    const discarded = buildReplayState(round, 2);
    const rebuilt = buildReplayState(round, 2);

    expect(drawn.gameState.players[0].drawnTile?.instanceId).toBe('live-0');
    expect(drawn.wall.liveWall.map((entry) => entry.instanceId)).toEqual(['live-1']);
    expect(discarded.gameState.players[0].river[0]).toMatchObject({ instanceId: 'p0-red', red: true });
    expect(buildReplayState(round, 1)).toEqual(drawn);
    expect(rebuilt).toEqual(discarded);
    expect(initial.gameState.players[0].river).toEqual([]);
  });

  it('还原立直横牌、被鸣弃牌、吃碰暗杠与加杠', () => {
    const called = tile(0, 'p0-a');
    const round = baseRound([
      event(0, { type: 'riichi-declared', actor: 0, sticks: 1 }),
      event(1, { type: 'tile-discarded', actor: 0, tile: called }),
      event(2, { type: 'chi-declared', actor: 1, from: 0, tiles: [called, tile(1, 'p1-a'), tile(2, 'p1-b')] }),
      event(3, { type: 'pon-declared', actor: 3, from: 1, tiles: [tile(6, 'p3-a'), tile(6, 'p3-b'), tile(6, 'p3-c')] }),
      event(4, { type: 'ankan-declared', actor: 2, from: 2, tiles: [tile(5, 'p2-a'), tile(5, 'p2-b'), tile(5, 'p2-c'), tile(5, 'p2-d')] }),
      event(5, { type: 'kakan-declared', actor: 3, from: 1, tiles: [tile(6, 'p3-a'), tile(6, 'p3-b'), tile(6, 'p3-c'), tile(6, 'p3-d')] }),
    ]);
    const state = buildReplayState(round, 6).gameState;

    expect(state.players[0].river[0]).toMatchObject({ isRiichiDiscard: true, claimed: true, claimedBy: 1 });
    expect(state.players[0].riichiState?.riichiDiscardInstanceId).toBe('p0-a');
    expect(state.players[1].calls[0].type).toBe('chi');
    expect(state.players[2].calls[0]).toMatchObject({ type: 'kan', kanType: 'ankan', opened: false });
    expect(state.players[3].calls).toHaveLength(1);
    expect(state.players[3].calls[0]).toMatchObject({ type: 'kan', kanType: 'kakan' });
  });

  it('被鸣走的顺延横牌在回放中继续顺延，且与正常状态标记一致', () => {
    const declaration = tile(0, 'p0-a');
    const firstCarry = tile(4, 'p0-red', true);
    const secondCarry = tile(8, 'p0-next');
    const round = baseRound([
      event(0, { type: 'riichi-declared', actor: 0, sticks: 1 }),
      event(1, { type: 'tile-discarded', actor: 0, tile: declaration }),
      event(2, { type: 'chi-declared', actor: 1, from: 0, tiles: [declaration, tile(1, 'p1-a'), tile(2, 'p1-b')] }),
      event(3, { type: 'tile-discarded', actor: 0, tile: firstCarry }),
      event(4, { type: 'pon-declared', actor: 2, from: 0, tiles: [firstCarry, tile(4, 'p2-call-a'), tile(4, 'p2-call-b')] }),
      event(5, { type: 'tile-discarded', actor: 0, tile: secondCarry }),
    ]);
    const afterSecondCall = buildReplayState(round, 5).gameState;
    const afterNextDiscard = buildReplayState(round, 6).gameState;

    expect(afterSecondCall.players[0].river[1]).toMatchObject({ isRiichiDiscard: true, claimed: true, claimedBy: 2 });
    expect(afterSecondCall.players[0].pendingRiichiSidewaysDiscard).toBe(true);
    expect(afterNextDiscard.players[0].river[2]?.isRiichiDiscard).toBe(true);
    expect(afterNextDiscard.players[0].pendingRiichiSidewaysDiscard).toBe(false);
  });

  it('杠后还原新增宝牌、岭上摸牌和岭上剩余数量', () => {
    const dead = deadWall();
    const round = baseRound([
      event(0, { type: 'ankan-declared', actor: 2, from: 2, tiles: [tile(5, 'p2-a'), tile(5, 'p2-b'), tile(5, 'p2-c'), tile(5, 'p2-d')] }),
      event(1, { type: 'dora-revealed', tiles: [dead[6]] }),
      event(2, { type: 'tile-drawn', actor: 2, tile: dead[0], source: 'rinshan' }),
    ]);
    const state = buildReplayState(round, 3);
    expect(state.gameState.doraIndicators.map((entry) => entry.instanceId)).toEqual(['dead-4', 'dead-6']);
    expect(state.gameState.players[2].drawnTile?.instanceId).toBe('dead-0');
    expect(state.wall.drawnDeadTiles.map((entry) => entry.instanceId)).toEqual(['dead-0']);
    expect(state.wall.rinshanRemaining).toBe(3);
  });

  it('点数结算只应用一次，并可推导下一局初始分数', () => {
    const result: ExhaustiveDrawResult = {
      type: 'exhaustive-draw',
      tenpaiPlayers: [0],
      notenPlayers: [1, 2, 3],
      scoreDeltas: [3000, -1000, -1000, -1000],
      pointDeltas: [3000, -1000, -1000, -1000],
      dealerContinues: true,
      honbaIncrement: 1,
      riichiSticksCarryOver: true,
    };
    const first = {
      ...baseRound([
        event(0, { type: 'exhaustive-draw', result }),
        event(1, { type: 'round-ended', result }),
      ]),
      result,
    };
    const second = { ...baseRound(), roundId: 'round-2', handNumber: 2, initialScores: undefined };
    const log = {
      version: 1,
      matchId: 'match',
      createdAt: new Date(0).toISOString(),
      playerNames: ['P1', 'P2', 'P3', 'P4'],
      playerTypes: ['human', 'ai', 'ai', 'ai'],
      initialDealer: 0,
      initialScores: [25000, 25000, 25000, 25000],
      ruleConfig: getRulePreset('east-round'),
      rounds: [first, second],
    } as MatchLog;

    expect(buildReplayState(first, 1).gameState.players.map((player) => player.score)).toEqual([25000, 26000, 24000, 25000]);
    expect(buildReplayState(first, 2).gameState.players.map((player) => player.score)).toEqual([28000, 25000, 23000, 24000]);
    expect(initialScoresForRound(log, 1)).toEqual([28000, 24000, 24000, 24000]);
  });

  it('两家立直后按动作扣点，再应用包含供托的毛结算并保持总点守恒', () => {
    const result: WinRoundResult = {
      type: 'tsumo',
      winners: [{
        winner: 2,
        from: null,
        winType: 'tsumo',
        winTile: createTile(4, 999),
        yaku: [{ name: '立直', han: 1 }],
        han: 1,
        fu: 30,
        points: 4000,
        pointDeltas: [-1000, -500, 4000, -500],
      }],
      pointDeltas: [-1000, -500, 4000, -500],
    };
    const replayRound = {
      ...baseRound([
        event(0, { type: 'riichi-declared', actor: 2, sticks: 1 }),
        event(1, { type: 'riichi-declared', actor: 3, sticks: 2 }),
        event(2, { type: 'tsumo-declared', actor: 2, result }),
        event(3, { type: 'round-ended', result }),
      ]),
      initialScores: [25000, 25000, 25000, 25000] as [number, number, number, number],
      result,
    };

    const oneRiichi = buildReplayState(replayRound, 1);
    const twoRiichi = buildReplayState(replayRound, 2);
    const final = buildReplayState(replayRound, 4);
    expect(oneRiichi.gameState.players.map((player) => player.score)).toEqual([25000, 25000, 24000, 25000]);
    expect(oneRiichi.gameState.riichiSticks).toBe(1);
    expect(replayConservedPoints(oneRiichi.gameState)).toBe(100000);
    expect(twoRiichi.gameState.players.reduce((sum, player) => sum + player.score, 0)).toBe(98000);
    expect(twoRiichi.gameState.riichiSticks).toBe(2);
    expect(replayConservedPoints(twoRiichi.gameState)).toBe(100000);
    expect(final.gameState.players.map((player) => player.score)).toEqual([24000, 24500, 28000, 23500]);
    expect(final.gameState.riichiSticks).toBe(0);
    expect(final.settlementRiichiSticks).toBe(2);
    expect(replayConservedPoints(final.gameState)).toBe(100000);
    expect(buildReplayState(replayRound, 3).gameState.players.map((player) => player.score)).toEqual([25000, 25000, 24000, 24000]);
    expect(buildReplayState(replayRound, 4)).toEqual(final);
  });

  it('旧牌谱scoreChanges按局初净变化解析，绝对终局分数优先且不重复结算', () => {
    const result: ExhaustiveDrawResult = {
      type: 'exhaustive-draw',
      tenpaiPlayers: [],
      notenPlayers: [0, 1, 2, 3],
      scoreDeltas: [0, 0, 0, 0],
      pointDeltas: [0, 0, 0, 0],
      dealerContinues: false,
      honbaIncrement: 1,
      riichiSticksCarryOver: true,
    };
    const initial: [number, number, number, number] = [25000, 25000, 25000, 25000];
    const legacyNet = { ...baseRound(), result, scoreChanges: [-1000, -500, 3000, -1500] } as RoundLog;
    const absolute = { ...legacyNet, scoresAfter: [24100, 24400, 27900, 23600] } as RoundLog;
    expect(resolveReplayFinalScores(legacyNet, initial)).toEqual([24000, 24500, 28000, 23500]);
    expect(resolveReplayFinalScores(absolute, initial)).toEqual([24100, 24400, 27900, 23600]);
  });

  it('旧牌谱缺少完整牌山时安全降级', () => {
    const round = { ...baseRound(), liveWall: undefined, deadWall: undefined, wallOrder: undefined };
    const state = buildReplayState(round, 0);
    expect(state.wall.available).toBe(false);
    expect(state.gameState.wall).toEqual([]);
    expect(state.wall.nextLiveTile).toBeUndefined();
  });
});
