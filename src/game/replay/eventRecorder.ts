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
    matchId: params.matchId ?? `match-${Date.now()}`,
    createdAt: new Date().toISOString(),
    playerNames: params.playerNames ?? ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    playerTypes: params.playerTypes ?? ['human', 'ai', 'ai', 'ai'],
    initialDealer: params.initialDealer as 0 | 1 | 2 | 3,
    initialScores: params.initialScores,
    ruleConfig: params.ruleConfig,
    rounds: [],
  };
}

export function createRoundLogFromGameState(roundId: string, gameState: GameState): RoundLog {
  return {
    roundId,
    roundWind: gameState.roundWind,
    handNumber: 1,
    dealer: gameState.dealer,
    honba: gameState.honba,
    riichiSticks: gameState.riichiSticks,
    initialHands: gameState.players.map((player) => player.hand.map(tileSnapshot)),
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
