import { describe, expect, it } from 'vitest';
import { discardTile, drawTile, createInitialGameState } from './engine';
import { beginKakan, declareChankanRon } from './kanChecker';
import { createTile } from './tileUtils';
import type { CallSet, GameState, PlayerId, Tile, TileId } from './types';
import { settleRoundState } from './roundSettlement';
import { applyRoundResultToMatch, startMatch } from './match/matchEngine';
import { createInitialMatchLog, recordGameStateTransition, startRoundInMatchLog } from './replay/eventRecorder';
import { buildReplayState } from './replay/roundReplay';
import { getRulePreset } from './match/matchRules';

function tiles(ids: TileId[], prefix: string): Tile[] {
  return ids.map((id, index) => ({ ...createTile(id, index % 4), instanceId: `${prefix}-${index}` }));
}

function setHand(state: GameState, playerId: PlayerId, ids: TileId[], prefix: string, drawnIndex: number | null = null): GameState {
  const hand = tiles(ids, prefix);
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId
      ? { ...player, hand, drawnTile: drawnIndex === null ? null : hand[drawnIndex], calls: [], riichi: false }
      : player),
  };
}

function withSticks(state: GameState, sticks: number, startingPoints = 25000): GameState {
  return {
    ...state,
    riichiSticks: sticks,
    matchRuleConfig: { ...state.matchRuleConfig, startingPoints },
    players: state.players.map((player, index) => ({
      ...player,
      score: startingPoints - (index === 0 ? sticks * 1000 : 0),
    })),
  };
}

function settlementSticks(state: GameState): number | undefined {
  return (state.result as (NonNullable<GameState['result']> & { settlementRiichiSticks?: number }) | null)?.settlementRiichiSticks;
}

function expectConserved(state: GameState, initialTotalPoints: number): void {
  expect(state.players.reduce((sum, player) => sum + player.score, 0) + state.riichiSticks * 1000).toBe(initialTotalPoints);
}

function ronState(sticks: number, startingPoints = 25000, multiple = false): GameState {
  let state = withSticks(createInitialGameState(), sticks, startingPoints);
  state = setHand(state, 0, [14, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27], 'ron-p0');
  state = setHand(state, 1, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14], 'ron-p1');
  if (multiple) state = setHand(state, 2, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14], 'ron-p2');
  return {
    ...state,
    currentPlayer: 0,
    phase: 'discard',
    matchRuleConfig: { ...state.matchRuleConfig, startingPoints, useOka: false },
  };
}

function tsumoState(sticks: number, startingPoints = 25000): GameState {
  let state = withSticks(createInitialGameState(), sticks, startingPoints);
  state = setHand(state, 0, [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14], 'tsumo-p0');
  return {
    ...state,
    currentPlayer: 0,
    phase: 'draw',
    wall: [{ ...createTile(14, 1), instanceId: 'tsumo-winning-tile' }],
  };
}

function chankanState(sticks: number): GameState {
  const ponTiles = tiles([5, 5, 5], 'chankan-pon');
  const pon: CallSet = { type: 'pon', tiles: ponTiles, from: 3, opened: true, calledTile: ponTiles[0] };
  let state = withSticks(createInitialGameState(), sticks);
  state = {
    ...state,
    currentPlayer: 0,
    phase: 'discard',
    players: state.players.map((player) => player.id === 0 ? { ...player, calls: [pon] } : player),
  };
  state = setHand(state, 0, [5, 0, 1, 2, 3, 4, 9, 10, 11, 18, 19], 'chankan-p0');
  state = {
    ...state,
    players: state.players.map((player) => player.id === 0 ? { ...player, calls: [pon] } : player),
  };
  return setHand(state, 1, [0, 1, 2, 9, 10, 11, 18, 19, 20, 3, 4, 14, 14], 'chankan-p1');
}

describe('STAB-005 settlement riichi-stick conservation', () => {
  for (const sticks of [1, 2, 3, 4]) {
    it(`ron clears ${sticks} settled stick(s) and preserves a result snapshot`, () => {
      const before = ronState(sticks);
      const after = discardTile(before, 0, before.players[0].hand[0].instanceId);
      expect(after.result?.type).toBe('ron');
      expect(settlementSticks(after)).toBe(sticks);
      expect(after.riichiSticks).toBe(0);
      expectConserved(after, 100000);
    });

    it(`tsumo clears ${sticks} settled stick(s) and preserves a result snapshot`, () => {
      const after = drawTile(tsumoState(sticks));
      expect(after.result?.type).toBe('tsumo');
      expect(settlementSticks(after)).toBe(sticks);
      expect(after.riichiSticks).toBe(0);
      expectConserved(after, 100000);
    });
  }

  it('clears sticks after chankan through the shared kan settlement path', () => {
    const window = beginKakan(chankanState(2), 0, 5);
    const after = declareChankanRon(window, 1);
    expect(after.lastWinSource).toBe('chankan');
    expect(settlementSticks(after)).toBe(2);
    expect(after.riichiSticks).toBe(0);
    expectConserved(after, 100000);
  });

  it('awards sticks only once in multi-ron and clears the table sticks', () => {
    const before = ronState(3, 25000, true);
    const after = discardTile(before, 0, before.players[0].hand[0].instanceId);
    expect(after.result?.type).toBe('ron');
    if (!after.result || after.result.type !== 'ron') throw new Error('Expected ron result');
    expect(after.result.winners.map((winner) => winner.winner)).toEqual([1, 2]);
    expect(settlementSticks(after)).toBe(3);
    expect(after.riichiSticks).toBe(0);
    expectConserved(after, 100000);
  });

  it('uses dynamic starting points instead of a hard-coded 100000 total', () => {
    const before = ronState(4, 27000);
    const after = discardTile(before, 0, before.players[0].hand[0].instanceId);
    expect(settlementSticks(after)).toBe(4);
    expect(after.riichiSticks).toBe(0);
    expectConserved(after, 108000);
  });

  it('keeps sticks on exhaustive draw while preserving the pre-settlement snapshot', () => {
    const before = withSticks(createInitialGameState(), 3);
    const after = settleRoundState(before, {
      type: 'exhaustive-draw',
      tenpaiPlayers: [],
      notenPlayers: [0, 1, 2, 3],
      scoreDeltas: [0, 0, 0, 0],
      pointDeltas: [0, 0, 0, 0],
      dealerContinues: false,
      honbaIncrement: 1,
      riichiSticksCarryOver: true,
    });
    expect(settlementSticks(after)).toBe(3);
    expect(after.riichiSticks).toBe(3);
    expectConserved(after, 100000);
  });

  it('records and deterministically replays the same settled stick snapshot and authoritative state', () => {
    const rules = getRulePreset('east-round');
    const before = ronState(2);
    const after = discardTile(before, 0, before.players[0].hand[0].instanceId);
    const initial = createInitialMatchLog({
      matchId: 'stab-005-event-replay',
      initialDealer: 0,
      initialScores: before.players.map((player) => player.score) as [number, number, number, number],
      ruleConfig: rules,
    });
    const recorded = recordGameStateTransition(startRoundInMatchLog(initial, before, 1), before, after);
    const round = recorded.rounds[0];
    const ended = round.events.find((event) => event.type === 'round-ended');
    expect(ended?.type === 'round-ended' ? ended.result.settlementRiichiSticks : undefined).toBe(2);
    expect(round.result?.settlementRiichiSticks).toBe(2);

    const replay = buildReplayState(round, Number.MAX_SAFE_INTEGER, {
      scores: recorded.initialScores,
      playerNames: recorded.playerNames,
      ruleConfig: recorded.ruleConfig,
    });
    expect(replay.settlementRiichiSticks).toBe(2);
    expect(replay.gameState.result?.settlementRiichiSticks).toBe(2);
    expect(replay.gameState.riichiSticks).toBe(0);
    expect(replay.gameState.players.map((player) => player.score)).toEqual(after.players.map((player) => player.score));
    expectConserved(replay.gameState, 100000);
  });

  it('remains conserved immediately after settlement and after entering the next round', () => {
    const before = ronState(4, 27000);
    expectConserved(before, 108000);
    const after = discardTile(before, 0, before.players[0].hand[0].instanceId);
    expectConserved(after, 108000);
    if (!after.result) throw new Error('Expected settled result');

    const match = {
      ...startMatch({ startingPoints: 27000 }),
      scores: before.players.map((player) => player.score) as [number, number, number, number],
      riichiSticks: 4,
    };
    const applied = applyRoundResultToMatch(match, after.result);
    expect(applied.match.scores.reduce((sum, score) => sum + score, 0) + applied.match.riichiSticks * 1000).toBe(108000);
    expect(applied.nextGameState).toBeDefined();
    expectConserved(applied.nextGameState!, 108000);
  });
});
