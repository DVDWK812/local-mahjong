import type { GameState, Tile } from '../types';
import type { BaseGameEvent, GameEvent, MatchLog, RoundLog, TileSnapshot } from './types';
import { MATCH_LOG_VERSION } from './types';
import type { FullRuleConfig } from '../match/types';

export function tileSnapshot(tile: Tile): TileSnapshot {
  return {
    instanceId: tile.instanceId,
    tileId: tile.id,
    red: tile.red,
  };
}

export function createEventFactory(roundId: string, startSequence = 0) {
  let sequence = startSequence;
  return function event<T extends Omit<GameEvent, keyof BaseGameEvent> & { type: GameEvent['type']; actor?: number }>(input: T): GameEvent {
    const next = sequence;
    sequence += 1;
    return {
      ...input,
      roundId,
      sequence: next,
      eventId: `${roundId}-${next}-${input.type}`,
      timestamp: Date.now(),
    } as GameEvent;
  };
}

export function createInitialMatchLog(params: {
  matchId?: string;
  playerNames?: [string, string, string, string];
  playerTypes?: ['human' | 'ai', 'human' | 'ai', 'human' | 'ai', 'human' | 'ai'];
  initialDealer: number;
  initialScores: [number, number, number, number];
  ruleConfig: FullRuleConfig;
}): MatchLog {
  return {
    version: MATCH_LOG_VERSION,
    matchId: params.matchId ?? createStableReplayId(),
    createdAt: new Date().toISOString(),
    playerNames: params.playerNames ?? ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    playerTypes: params.playerTypes ?? ['human', 'ai', 'ai', 'ai'],
    initialDealer: params.initialDealer as 0 | 1 | 2 | 3,
    initialScores: params.initialScores,
    ruleConfig: params.ruleConfig,
    rounds: [],
  };
}

export function createRoundLogFromGameState(roundId: string, gameState: GameState, handNumber = 1): RoundLog {
  return {
    roundId,
    roundWind: gameState.roundWind,
    handNumber,
    dealer: gameState.dealer,
    honba: gameState.honba,
    riichiSticks: gameState.riichiSticks,
    initialScores: gameState.players.map((player) => player.score) as [number, number, number, number],
    initialHands: gameState.players.map((player) => player.hand.map(tileSnapshot)),
    initialDoraIndicators: gameState.doraIndicators.map(tileSnapshot),
    liveWall: gameState.wall.map(tileSnapshot),
    deadWall: gameState.deadWall.map(tileSnapshot),
    wallOrder: [...gameState.wall, ...gameState.deadWall].map(tileSnapshot),
    events: [],
    result: gameState.result ?? undefined,
  };
}

export function appendEvent(log: MatchLog, roundId: string, event: GameEvent): MatchLog {
  return {
    ...log,
    rounds: log.rounds.map((round) => round.roundId === roundId ? { ...round, events: [...round.events, event] } : round),
  };
}

export function startRoundInMatchLog(log: MatchLog, gameState: GameState, handNumber: number): MatchLog {
  const roundId = `${log.matchId}-round-${log.rounds.length + 1}`;
  const round = createRoundLogFromGameState(roundId, gameState, handNumber);
  const makeEvent = createEventFactory(roundId, eventCount(log));
  round.events = [
    ...(log.rounds.length === 0 ? [makeEvent({ type: 'match-started' })] : []),
    makeEvent({
      type: 'round-started',
      roundWind: gameState.roundWind,
      handNumber,
      dealer: gameState.dealer,
      honba: gameState.honba,
      riichiSticks: gameState.riichiSticks,
    }),
    makeEvent({ type: 'tiles-dealt', hands: gameState.players.map((player) => player.hand.map(tileSnapshot)) }),
  ];
  return { ...log, rounds: [...log.rounds, round] };
}

export function recordGameStateTransition(log: MatchLog, before: GameState, after: GameState): MatchLog {
  const round = log.rounds[log.rounds.length - 1];
  if (!round) return log;
  const makeEvent = createEventFactory(round.roundId, eventCount(log));
  const callEvents: Array<() => GameEvent> = [];
  const drawEvents: Array<() => GameEvent> = [];
  const riichiEvents: Array<() => GameEvent> = [];
  const discardEvents: Array<() => GameEvent> = [];

  for (const player of after.players) {
    const previousPlayer = before.players[player.id];
    if (player.drawnTile && player.drawnTile.instanceId !== previousPlayer.drawnTile?.instanceId) {
      drawEvents.push(() => makeEvent({ type: 'tile-drawn', actor: player.id, tile: tileSnapshot(player.drawnTile!), source: after.lastDrawSource }));
    }
    if (!previousPlayer.riichi && player.riichi) {
      riichiEvents.push(() => makeEvent({ type: 'riichi-declared', actor: player.id, sticks: after.riichiSticks }));
    }
    const addedCall = player.calls.length > previousPlayer.calls.length ? player.calls[player.calls.length - 1] : null;
    const upgradedCall = !addedCall
      ? player.calls.find((call, index) => call.kanType === 'kakan' && previousPlayer.calls[index]?.kanType !== 'kakan')
      : null;
    const call = addedCall ?? upgradedCall;
    if (call) {
      const type = call.type === 'chi'
        ? 'chi-declared'
        : call.type === 'pon'
          ? 'pon-declared'
          : call.kanType === 'ankan'
            ? 'ankan-declared'
            : call.kanType === 'kakan' ? 'kakan-declared' : 'minkan-declared';
      callEvents.push(() => makeEvent({ type, actor: player.id, tiles: call.tiles.map(tileSnapshot), from: call.from }));
    }
    if (player.river.length > previousPlayer.river.length) {
      discardEvents.push(() => makeEvent({
        type: 'tile-discarded',
        actor: player.id,
        tile: tileSnapshot(player.river[player.river.length - 1]),
      }));
    }
  }

  const events = [
    ...callEvents.map((create) => create()),
    ...(after.doraIndicators.length > before.doraIndicators.length
      ? [makeEvent({
        type: 'dora-revealed',
        tiles: after.doraIndicators.slice(before.doraIndicators.length).map(tileSnapshot),
      })]
      : []),
    ...drawEvents.map((create) => create()),
    ...riichiEvents.map((create) => create()),
    ...discardEvents.map((create) => create()),
  ];

  if (!before.result && after.result) {
    if (after.result.type === 'tsumo') {
      events.push(makeEvent({ type: 'tsumo-declared', actor: after.result.winners[0]?.winner, result: after.result }));
    } else if (after.result.type === 'ron') {
      events.push(makeEvent({ type: 'ron-declared', actor: after.result.winners[0]?.winner, result: after.result }));
    } else {
      events.push(makeEvent({ type: after.result.type, result: after.result }));
    }
    events.push(makeEvent({ type: 'round-ended', result: after.result }));
  }

  if (events.length === 0 && before.phase === 'call-window' && after.phase !== 'call-window') {
    events.push(makeEvent({ type: 'call-passed' }));
  }
  return {
    ...log,
    rounds: log.rounds.map((entry) => entry.roundId === round.roundId
      ? { ...entry, events: [...entry.events, ...events], result: after.result ?? entry.result }
      : entry),
  };
}

export function finishMatchLog(log: MatchLog, result: NonNullable<MatchLog['finalResult']>): MatchLog {
  if (log.finalResult) return log;
  const round = log.rounds[log.rounds.length - 1];
  if (!round) return { ...log, finalResult: result };
  const makeEvent = createEventFactory(round.roundId, eventCount(log));
  const event = makeEvent({ type: 'match-ended', result });
  return {
    ...log,
    finalResult: result,
    rounds: log.rounds.map((entry) => entry.roundId === round.roundId
      ? { ...entry, events: [...entry.events, event] }
      : entry),
  };
}

function eventCount(log: MatchLog): number {
  return log.rounds.reduce((count, round) => count + round.events.length, 0);
}

function createStableReplayId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `match-${crypto.randomUUID()}`;
  }
  return `match-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
