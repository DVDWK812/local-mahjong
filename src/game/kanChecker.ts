import { buildRonResult, buildTsumoResult, canRon } from './winChecker';
import type { GameState, PendingCallOption, PlayerId, RoundResult, Tile, TileId } from './types';
import { sortTiles } from './tileUtils';
import { normalizeFuritenState } from './furiten';
import { shanten } from './shanten';
import { markRiverTileClaimed } from './callChecker';
import { advanceWallAfterKan } from './wall';
import { settleRoundState } from './roundSettlement';

export type KanType = 'ankan' | 'minkan' | 'kakan';

export interface KanCandidate {
  type: KanType;
  tileId: TileId;
}

export interface RiichiAnkanWaitEvaluation {
  beforeWaits: TileId[];
  afterWaits: TileId[];
  waitPreserving: boolean;
}

export function canAnkan(state: GameState, playerId: PlayerId, tileId?: TileId): boolean {
  const player = state.players[playerId];
  if (!player || state.phase !== 'discard' || state.currentPlayer !== playerId) return false;
  const legalCandidates = getLegalAnkanCandidates(state, playerId);
  return tileId === undefined ? legalCandidates.length > 0 : legalCandidates.some((candidate) => candidate.tileId === tileId);
}

export function canMinkan(state: GameState, playerId: PlayerId): boolean {
  const discard = state.pendingCall?.tile ?? state.lastDiscard?.tile;
  const discarder = state.pendingCall?.discarder ?? state.lastDiscard?.player;
  if (!discard || discarder === undefined || discarder === playerId) return false;
  if (state.players[playerId].riichi) return false;
  if (state.pendingCall && !state.pendingCall.options.some((option) => option.type === 'kan' && option.kanType === 'minkan' && option.player === playerId)) return false;
  return state.players[playerId].hand.filter((tile) => tile.id === discard.id).length >= 3;
}

export function canKakan(state: GameState, playerId: PlayerId, tileId?: TileId): boolean {
  const player = state.players[playerId];
  if (!player || state.phase !== 'discard' || state.currentPlayer !== playerId) return false;
  if (player.riichi) return false;
  const candidates = getKakanCandidates(state, playerId);
  return tileId === undefined ? candidates.length > 0 : candidates.some((candidate) => candidate.tileId === tileId);
}

export function getAnkanCandidates(state: GameState, playerId: PlayerId): KanCandidate[] {
  const player = state.players[playerId];
  if (!player) return [];
  const counts = countHandTiles(player.hand);
  return [...counts.entries()]
    .filter(([, count]) => count >= 4)
    .map(([tileId]) => ({ type: 'ankan' as const, tileId }));
}

export function getLegalAnkanCandidates(state: GameState, playerId: PlayerId): KanCandidate[] {
  const player = state.players[playerId];
  if (!player || state.phase !== 'discard' || state.currentPlayer !== playerId) return [];
  return getAnkanCandidates(state, playerId)
    .filter((candidate) => !player.riichi || evaluateRiichiAnkanWaits(state, playerId, candidate.tileId).waitPreserving);
}

export function evaluateRiichiAnkanWaits(state: GameState, playerId: PlayerId, tileId: TileId): RiichiAnkanWaitEvaluation {
  const player = state.players[playerId];
  if (!player) return { beforeWaits: [], afterWaits: [], waitPreserving: false };
  const beforeHand = player.drawnTile?.id === tileId ? removeTilesForWaitCheck(player.hand, tileId, 1) : player.hand;
  const beforeWaits = [...waitsForHandWithFixedMelds(beforeHand, 0)].sort((a, b) => a - b);
  const afterHand = removeTilesForWaitCheck(player.hand, tileId, 4);
  const hasQuad = afterHand.length === player.hand.length - 4;
  const afterWaits = hasQuad ? [...waitsForHandWithFixedMelds(afterHand, 1)].sort((a, b) => a - b) : [];
  return {
    beforeWaits,
    afterWaits,
    waitPreserving: hasQuad && (!player.riichi || sameSet(new Set(beforeWaits), new Set(afterWaits))),
  };
}

export function isRiichiAnkanWaitPreserving(state: GameState, playerId: PlayerId, tileId: TileId): boolean {
  return evaluateRiichiAnkanWaits(state, playerId, tileId).waitPreserving;
}

export function getKakanCandidates(state: GameState, playerId: PlayerId): KanCandidate[] {
  const player = state.players[playerId];
  if (!player || player.riichi) return [];
  const ponIds = player.calls.filter((call) => call.type === 'pon').map((call) => call.tiles[0]?.id).filter((id): id is TileId => id !== undefined);
  return ponIds
    .filter((tileId) => player.hand.some((tile) => tile.id === tileId))
    .map((tileId) => ({ type: 'kakan' as const, tileId }));
}

export function getMinkanOptions(state: GameState, discarder: PlayerId, discardedTile: Tile): PendingCallOption[] {
  return state.players.flatMap((player) => {
    if (player.id === discarder || player.riichi) return [];
    const matchingTiles = player.hand.filter((tile) => tile.id === discardedTile.id);
    return matchingTiles.length >= 3
      ? [{ type: 'kan' as const, kanType: 'minkan' as const, player: player.id }]
      : [];
  });
}

export function executeKan(state: GameState, playerId: PlayerId, kanType?: KanType, tileId?: TileId): GameState {
  const resolvedType = kanType ?? resolveKanType(state, playerId, tileId);
  if (!resolvedType) return state;

  if (resolvedType === 'ankan') return executeAnkan(state, playerId, tileId);
  if (resolvedType === 'minkan') return executeMinkan(state, playerId);
  return beginKakan(state, playerId, tileId);
}

export function beginKakan(state: GameState, playerId: PlayerId, tileId?: TileId): GameState {
  const candidate = tileId ?? getKakanCandidates(state, playerId)[0]?.tileId;
  if (candidate === undefined || !canKakan(state, playerId, candidate)) return state;

  const player = state.players[playerId];
  const tile = player.hand.find((handTile) => handTile.id === candidate);
  const ponCallIndex = player.calls.findIndex((call) => call.type === 'pon' && call.tiles[0]?.id === candidate);
  if (!tile || ponCallIndex === -1) return state;

  const eligibleRonPlayers = canRon(state, playerId, tile, { winningTileSource: 'kakan' }).map((win) => win.winner);
  const pendingKakan = {
    declarer: playerId,
    ponCallIndex,
    addedTile: tile,
    addedTileInstanceId: tile.instanceId,
    eligibleRonPlayers,
    passedPlayers: [],
  };
  const nextState: GameState = {
    ...state,
    phase: eligibleRonPlayers.length > 0 ? 'chankan-window' : 'kakan-declaration',
    pendingKakan,
    pendingRon: null,
  };
  return eligibleRonPlayers.length > 0 ? nextState : resolveKakan(nextState);
}

export function canChankan(state?: GameState, playerId?: PlayerId): boolean {
  if (!state || playerId === undefined) return false;
  if (state.phase !== 'chankan-window' || !state.pendingKakan) return false;
  if (playerId === state.pendingKakan.declarer) return false;
  if (state.pendingKakan.passedPlayers.includes(playerId)) return false;
  return state.pendingKakan.eligibleRonPlayers.includes(playerId);
}

export function declareChankanRon(state: GameState, playerId: PlayerId): GameState {
  if (!canChankan(state, playerId) || !state.pendingKakan) return state;
  const candidates = state.pendingKakan.eligibleRonPlayers.filter((candidate) => !state.pendingKakan?.passedPlayers.includes(candidate));
  const scoringState = removePendingKakanTileFromDeclarer(state);
  const result = buildRonResult(scoringState, state.pendingKakan.declarer, state.pendingKakan.addedTile, {
    winningTileSource: 'kakan',
    candidatePlayers: candidates,
  });
  return result
    ? settleKanRound({ ...scoringState, pendingKakan: null, lastWinSource: 'chankan' }, result)
    : state;
}

export function passChankan(state: GameState, playerId: PlayerId): GameState {
  if (!canChankan(state, playerId) || !state.pendingKakan) return state;
  const passedPlayers = [...new Set([...state.pendingKakan.passedPlayers, playerId])] as PlayerId[];
  const players = state.players.map((player) => {
    if (player.id !== playerId) return player;
    const current = normalizeFuritenState(player.furitenState);
    return {
      ...player,
      furitenState: {
        temporaryFuriten: player.riichi ? current.temporaryFuriten : true,
        riichiPermanentFuriten: player.riichi ? true : current.riichiPermanentFuriten,
      },
    };
  });
  return resolveChankanWindow({
    ...state,
    players,
    pendingKakan: {
      ...state.pendingKakan,
      passedPlayers,
    },
  });
}

export function resolveChankanWindow(state: GameState): GameState {
  if (!state.pendingKakan) return state;
  const allPassed = state.pendingKakan.eligibleRonPlayers.every((playerId) => state.pendingKakan?.passedPlayers.includes(playerId));
  return allPassed ? resolveKakan({ ...state, phase: 'kakan-declaration' }) : state;
}

function executeAnkan(state: GameState, playerId: PlayerId, tileId?: TileId): GameState {
  const candidate = tileId ?? getAnkanCandidates(state, playerId)[0]?.tileId;
  if (candidate === undefined || !canAnkan(state, playerId, candidate)) return state;
  const players = clonePlayersForKan(state);
  const player = players[playerId];
  const removed = removeTilesFromHand(player.hand, candidate, 4);
  if (removed.length !== 4) return state;

  player.calls.push({
    type: 'kan',
    kanType: 'ankan',
    tiles: removed.sort(sortTiles),
    from: playerId,
    opened: false,
  });
  player.drawnTile = null;

  return applyKanDraw({
    ...state,
    players,
    pendingCall: null,
    pendingRon: null,
    callsOccurred: true,
    firstTurnInterrupted: true,
  }, playerId, 'ankan', candidate);
}

function executeMinkan(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== 'call-window' || !state.pendingCall || !canMinkan(state, playerId)) return state;

  const { discarder, tile } = state.pendingCall;
  const players = clonePlayersForKan(state);
  const player = players[playerId];
  const discardingPlayer = players[discarder];
  const removed = removeTilesFromHand(player.hand, tile.id, 3);
  if (removed.length !== 3) return state;

  markRiverTileClaimed(discardingPlayer, tile.instanceId, playerId);

  player.calls.push({
    type: 'kan',
    kanType: 'minkan',
    tiles: [...removed, tile].sort(sortTiles),
    from: discarder,
    opened: true,
    calledTile: tile,
  });
  player.drawnTile = null;

  return applyKanDraw({
    ...state,
    players,
    currentPlayer: playerId,
    pendingCall: null,
    pendingRon: null,
    callsOccurred: true,
    firstTurnInterrupted: true,
  }, playerId, 'minkan', tile.id);
}

export function resolveKakan(state: GameState): GameState {
  const pending = state.pendingKakan;
  if (!pending) return state;
  const playerId = pending.declarer;
  const candidate = pending.addedTile.id;

  const players = clonePlayersForKan(state);
  const player = players[playerId];
  const tileIndex = player.hand.findIndex((tile) => tile.instanceId === pending.addedTileInstanceId);
  const callIndex = pending.ponCallIndex;
  if (tileIndex === -1 || callIndex === -1) return state;

  const [addedTile] = player.hand.splice(tileIndex, 1);
  player.calls[callIndex] = {
    ...player.calls[callIndex],
    type: 'kan',
    kanType: 'kakan',
    tiles: [...player.calls[callIndex].tiles, addedTile].sort(sortTiles),
    opened: true,
  };
  player.drawnTile = null;

  return applyKanDraw({
    ...state,
    players,
    pendingCall: null,
    pendingRon: null,
    pendingKakan: null,
    callsOccurred: true,
    firstTurnInterrupted: true,
  }, playerId, 'kakan', candidate);
}

function applyKanDraw(state: GameState, playerId: PlayerId, kanType: KanType, tileId: TileId): GameState {
  if (state.deadWall.length === 0) {
    return {
      ...state,
      phase: 'exhaustive-draw',
    };
  }

  const wallAdvance = advanceWallAfterKan(state.wall, state.deadWall, Math.max(0, state.doraIndicators.length - 1));
  const rinshanTile = wallAdvance.rinshanTile;
  if (!rinshanTile) {
    return {
      ...state,
      phase: 'exhaustive-draw',
    };
  }
  const newIndicator = wallAdvance.doraIndicator;
  const doraIndicators = newIndicator ? [...state.doraIndicators, newIndicator] : [...state.doraIndicators];
  const players = state.players.map((player) => ({
    ...player,
    hand: [...player.hand],
    river: [...player.river],
    calls: player.calls.map((call) => ({ ...call, tiles: [...call.tiles] })),
    drawnTile: player.drawnTile ? { ...player.drawnTile } : null,
    riichiState: player.riichiState ? { ...player.riichiState, ippatsuAvailable: false } : null,
    furitenState: player.furitenState ? { ...player.furitenState } : undefined,
    pendingRiichiSidewaysDiscard: player.pendingRiichiSidewaysDiscard ?? false,
  }));
  const player = players[playerId];
  player.hand.push(rinshanTile);
  player.drawnTile = rinshanTile;

  const nextState: GameState = {
    ...state,
    players,
    wall: wallAdvance.liveWall,
    deadWall: wallAdvance.deadWall,
    doraIndicators,
    currentPlayer: playerId,
    phase: 'discard',
    pendingCall: null,
    pendingKakan: null,
    lastDrawSource: 'rinshan',
    playerDrawCounts: state.playerDrawCounts.map((count, index) => index === playerId ? count + 1 : count),
    pendingAbortiveDrawAfterFourthKan: shouldAbortAfterFourthKanDiscard(state.players, playerId),
    kanState: {
      type: kanType,
      player: playerId,
      tile: tileId,
      doraIndicatorCount: doraIndicators.length,
    },
  };
  const result = buildTsumoResult(nextState, playerId);
  return result ? settleKanRound(nextState, result) : nextState;
}

function shouldAbortAfterFourthKanDiscard(players: GameState['players'], playerId: PlayerId): boolean {
  const kanCounts = players.map((player) => player.calls.filter((call) => call.type === 'kan').length);
  const total = kanCounts.reduce((sum, count) => sum + count, 0);
  const owners = kanCounts.filter((count) => count > 0).length;
  return total >= 4 && owners >= 2 && kanCounts[playerId] < 4;
}

function resolveKanType(state: GameState, playerId: PlayerId, tileId?: TileId): KanType | null {
  if (canMinkan(state, playerId)) return 'minkan';
  if (canKakan(state, playerId, tileId)) return 'kakan';
  if (canAnkan(state, playerId, tileId)) return 'ankan';
  return null;
}

function removeTilesFromHand(hand: Tile[], tileId: TileId, amount: number): Tile[] {
  const removed: Tile[] = [];
  for (let index = hand.length - 1; index >= 0 && removed.length < amount; index -= 1) {
    if (hand[index].id === tileId) {
      const [tile] = hand.splice(index, 1);
      removed.push(tile);
    }
  }
  return removed;
}

function countHandTiles(hand: Tile[]): Map<TileId, number> {
  const counts = new Map<TileId, number>();
  hand.forEach((tile) => counts.set(tile.id, (counts.get(tile.id) ?? 0) + 1));
  return counts;
}

function waitsForHandWithFixedMelds(hand: Tile[], fixedMelds: number): Set<TileId> {
  const waits = new Set<TileId>();
  for (let id = 0; id < 34; id += 1) {
    const tile: Tile = { id: id as TileId, suit: 'honor', rank: 0, red: false, instanceId: `kan-wait-test-${id}` };
    if (fixedMelds === 0 ? shanten([...hand, tile]).best < 0 : standardShantenWithFixedMelds([...hand, tile], fixedMelds) < 0) {
      waits.add(id as TileId);
    }
  }
  return waits;
}

function standardShantenWithFixedMelds(hand: Tile[], fixedMelds: number): number {
  const counts = countsFor(hand);
  let best = 8;

  function evaluate(melds: number, pairs: number, taatsu: number) {
    const totalMelds = fixedMelds + melds;
    const cappedTaatsu = Math.min(taatsu, Math.max(0, 4 - totalMelds));
    best = Math.min(best, 8 - totalMelds * 2 - cappedTaatsu - Math.min(1, pairs));
  }

  function removeTaatsu(work: number[], start: number, melds: number, pairs: number, taatsu: number) {
    let found = false;
    for (let i = start; i < 34; i += 1) {
      if (work[i] >= 2) {
        found = true;
        work[i] -= 2;
        removeTaatsu(work, i, melds, pairs + 1, taatsu + 1);
        work[i] += 2;
      }
      if (i <= 24 && i % 9 <= 7 && work[i] > 0 && work[i + 1] > 0) {
        found = true;
        work[i] -= 1;
        work[i + 1] -= 1;
        removeTaatsu(work, i, melds, pairs, taatsu + 1);
        work[i] += 1;
        work[i + 1] += 1;
      }
      if (i <= 24 && i % 9 <= 6 && work[i] > 0 && work[i + 2] > 0) {
        found = true;
        work[i] -= 1;
        work[i + 2] -= 1;
        removeTaatsu(work, i, melds, pairs, taatsu + 1);
        work[i] += 1;
        work[i + 2] += 1;
      }
    }
    if (!found) evaluate(melds, pairs, taatsu);
  }

  function removeMelds(work: number[], start: number, melds: number, pairs: number, taatsu: number) {
    let found = false;
    for (let i = start; i < 34; i += 1) {
      if (work[i] >= 3) {
        found = true;
        work[i] -= 3;
        removeMelds(work, i, melds + 1, pairs, taatsu);
        work[i] += 3;
      }
      if (i <= 24 && i % 9 <= 6 && work[i] > 0 && work[i + 1] > 0 && work[i + 2] > 0) {
        found = true;
        work[i] -= 1;
        work[i + 1] -= 1;
        work[i + 2] -= 1;
        removeMelds(work, i, melds + 1, pairs, taatsu);
        work[i] += 1;
        work[i + 1] += 1;
        work[i + 2] += 1;
      }
    }
    removeTaatsu(work, 0, melds, pairs, taatsu);
    if (!found) evaluate(melds, pairs, taatsu);
  }

  removeMelds([...counts], 0, 0, 0, 0);
  for (let i = 0; i < 34; i += 1) {
    if (counts[i] >= 2) {
      const work = [...counts];
      work[i] -= 2;
      removeMelds(work, 0, 0, 1, 0);
    }
  }
  return best;
}

function countsFor(hand: Tile[]): number[] {
  const counts = Array.from({ length: 34 }, () => 0);
  hand.forEach((tile) => {
    counts[tile.id] += 1;
  });
  return counts;
}

function removeTilesForWaitCheck(hand: Tile[], tileId: TileId, amount: number): Tile[] {
  let removed = 0;
  return hand.filter((tile) => {
    if (tile.id !== tileId || removed >= amount) return true;
    removed += 1;
    return false;
  });
}

function sameSet(a: Set<TileId>, b: Set<TileId>): boolean {
  if (a.size !== b.size) return false;
  return [...a].every((item) => b.has(item));
}

function clonePlayersForKan(state: GameState): GameState['players'] {
  return state.players.map((player) => ({
    ...player,
    hand: [...player.hand],
    river: [...player.river],
    calls: player.calls.map((call) => ({ ...call, tiles: [...call.tiles] })),
    drawnTile: player.drawnTile ? { ...player.drawnTile } : null,
    riichiState: player.riichiState ? { ...player.riichiState, ippatsuAvailable: false } : null,
    furitenState: player.furitenState ? { ...player.furitenState } : undefined,
    pendingRiichiSidewaysDiscard: player.pendingRiichiSidewaysDiscard ?? false,
  }));
}

function removePendingKakanTileFromDeclarer(state: GameState): GameState {
  const pending = state.pendingKakan;
  if (!pending) return state;
  const players = clonePlayersForKan(state);
  const declarer = players[pending.declarer];
  const tileIndex = declarer.hand.findIndex((tile) => tile.instanceId === pending.addedTileInstanceId);
  if (tileIndex !== -1) declarer.hand.splice(tileIndex, 1);
  if (declarer.drawnTile?.instanceId === pending.addedTileInstanceId) declarer.drawnTile = null;
  return { ...state, players };
}

function settleKanRound(state: GameState, result: RoundResult): GameState {
  return settleRoundState(state, result);
}
