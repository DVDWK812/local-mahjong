import type { GameEvent, MatchLog, ReplayState, TileSnapshot } from './types';

export function createInitialReplayState(log: MatchLog): ReplayState {
  const round = log.rounds[0];
  return {
    matchId: log.matchId,
    roundId: round?.roundId ?? 'no-round',
    roundWind: round?.roundWind ?? 'east',
    handNumber: round?.handNumber ?? 1,
    dealer: round?.dealer ?? log.initialDealer,
    honba: round?.honba ?? 0,
    riichiSticks: round?.riichiSticks ?? 0,
    players: log.initialScores.map((score) => ({ score, hand: [], river: [], calls: [] })),
    appliedEventIds: [],
  };
}

export function reduceGameEvent(state: ReplayState, event: GameEvent): ReplayState {
  if (state.appliedEventIds.includes(event.eventId)) throw new Error(`Duplicate replay event: ${event.eventId}`);
  if (state.result && (event.type === 'tile-drawn' || event.type === 'tile-discarded')) throw new Error('Cannot apply tile action after round result');
  if (state.finalResult) throw new Error('Cannot apply event after match end');
  const appliedEventIds = [...state.appliedEventIds, event.eventId];

  if (event.type === 'round-started') {
    return {
      ...state,
      roundId: event.roundId,
      roundWind: event.roundWind,
      handNumber: event.handNumber,
      dealer: event.dealer,
      honba: event.honba,
      riichiSticks: event.riichiSticks,
      result: undefined,
      lastEvent: event,
      appliedEventIds,
    };
  }
  if (event.type === 'tiles-dealt') {
    return {
      ...state,
      players: state.players.map((player, index) => ({ ...player, hand: [...(event.hands[index] ?? [])], river: [], calls: [] })),
      lastEvent: event,
      appliedEventIds,
    };
  }
  if (event.type === 'tile-drawn' && event.actor !== undefined) {
    return updatePlayer(state, event.actor, (player) => ({ ...player, hand: [...player.hand, event.tile] }), event, appliedEventIds);
  }
  if (event.type === 'tile-discarded' && event.actor !== undefined) {
    return updatePlayer(state, event.actor, (player) => ({
      ...player,
      hand: removeTile(player.hand, event.tile.instanceId),
      river: [...player.river, event.tile],
    }), event, appliedEventIds);
  }
  if ((event.type === 'chi-declared' || event.type === 'pon-declared' || event.type === 'ankan-declared' || event.type === 'minkan-declared' || event.type === 'kakan-declared') && event.actor !== undefined) {
    return updatePlayer(state, event.actor, (player) => ({ ...player, calls: [...player.calls, event.tiles ?? []] }), event, appliedEventIds);
  }
  if (event.type === 'riichi-declared') {
    return { ...state, riichiSticks: event.sticks, lastEvent: event, appliedEventIds };
  }
  if (event.type === 'round-ended' || event.type === 'tsumo-declared' || event.type === 'ron-declared' || event.type === 'abortive-draw' || event.type === 'exhaustive-draw') {
    const result = 'result' in event ? event.result : undefined;
    const shouldApplyScores = !!result && !state.result;
    return {
      ...state,
      result,
      players: shouldApplyScores ? state.players.map((player, index) => ({ ...player, score: player.score + (result.pointDeltas[index] ?? 0) })) : state.players,
      lastEvent: event,
      appliedEventIds,
    };
  }
  if (event.type === 'match-ended') {
    return { ...state, finalResult: event.result, lastEvent: event, appliedEventIds };
  }
  return { ...state, lastEvent: event, appliedEventIds };
}

function updatePlayer(state: ReplayState, actor: number, update: (player: ReplayState['players'][number]) => ReplayState['players'][number], event: GameEvent, appliedEventIds: string[]): ReplayState {
  if (actor < 0 || actor > 3) throw new Error(`Invalid actor: ${actor}`);
  return {
    ...state,
    players: state.players.map((player, index) => index === actor ? update(player) : player),
    lastEvent: event,
    appliedEventIds,
  };
}

function removeTile(tiles: TileSnapshot[], instanceId: string): TileSnapshot[] {
  const index = tiles.findIndex((tile) => tile.instanceId === instanceId);
  return index === -1 ? tiles : tiles.filter((_, tileIndex) => tileIndex !== index);
}
