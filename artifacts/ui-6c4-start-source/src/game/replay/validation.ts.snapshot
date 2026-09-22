import type { GameEvent, MatchLog, ReplayState, TileSnapshot } from './types';

export function validateMatchLog(log: MatchLog): void {
  if (log.version < 1) throw new Error('Unsupported match log version');
  const events = log.rounds.flatMap((round) => round.events);
  validateEvents(events);
  log.rounds.forEach((round) => {
    const wall = round.wallOrder ?? [...(round.liveWall ?? []), ...(round.deadWall ?? [])];
    validateTileSnapshots([...(round.initialHands?.flat() ?? []), ...wall]);
  });
}

export function validateReplayState(state: ReplayState): void {
  if (state.dealer < 0 || state.dealer > 3) throw new Error('Invalid dealer');
  if (state.handNumber < 1 || state.handNumber > 4) throw new Error('Invalid handNumber');
  validateTileSnapshots(state.players.flatMap((player) => [...player.hand, ...player.river, ...player.calls.flat()]));
}

export function validateEvents(events: GameEvent[]): void {
  const ids = new Set<string>();
  let roundEnded = false;
  let matchEnded = false;
  events.forEach((event, index) => {
    if (event.sequence !== index) throw new Error(`Non-contiguous event sequence at ${event.eventId}`);
    if (ids.has(event.eventId)) throw new Error(`Duplicate eventId: ${event.eventId}`);
    ids.add(event.eventId);
    if (event.actor !== undefined && (event.actor < 0 || event.actor > 3)) throw new Error(`Invalid actor: ${event.actor}`);
    if (matchEnded) throw new Error('Event after match-ended');
    if (roundEnded && (event.type === 'tile-drawn' || event.type === 'tile-discarded')) throw new Error('Tile action after round end');
    if (event.type === 'round-ended' || event.type === 'abortive-draw' || event.type === 'exhaustive-draw' || event.type === 'ron-declared' || event.type === 'tsumo-declared') roundEnded = true;
    if (event.type === 'round-started') roundEnded = false;
    if (event.type === 'match-ended') matchEnded = true;
  });
}

function validateTileSnapshots(tiles: TileSnapshot[]): void {
  const occupied = new Set<string>();
  const counts = new Map<number, number>();
  tiles.forEach((tile) => {
    if (occupied.has(tile.instanceId)) throw new Error(`Duplicate tile instance occupancy: ${tile.instanceId}`);
    occupied.add(tile.instanceId);
    counts.set(tile.tileId, (counts.get(tile.tileId) ?? 0) + 1);
  });
  counts.forEach((count, tileId) => {
    if (count > 4) throw new Error(`Tile ${tileId} appears more than four times`);
  });
}
