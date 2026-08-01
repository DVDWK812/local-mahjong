import { seatWindForPlayer } from '../match/roundTransition';
import type { FullRuleConfig } from '../match/types';
import { markRiverTileClaimed } from '../callChecker';
import { clearKuikaeRestriction, isKuikaeEnabled, kuikaeForbiddenAfterChi, kuikaeForbiddenAfterPon, setKuikaeRestriction } from '../kuikae';
import { getTileRank, getTileSuit, sortTiles } from '../tileUtils';
import type { CallSet, GamePhase, GameState, PlayerId, RoundResult, Tile } from '../types';
import { advanceWallAfterKan, doraIndicatorSlots, uraDoraIndicatorSlots } from '../wall';
import type { DrawEvent, GameEvent, MatchLog, RoundEndedEvent, RoundLog, SimpleCallEvent, TileSnapshot, WinDeclaredEvent } from './types';

const ACTION_TYPES = new Set<GameEvent['type']>([
  'tile-drawn',
  'tile-discarded',
  'riichi-declared',
  'chi-declared',
  'pon-declared',
  'ankan-declared',
  'minkan-declared',
  'kakan-declared',
  'dora-revealed',
  'tsumo-declared',
  'ron-declared',
  'abortive-draw',
  'exhaustive-draw',
  'round-ended',
]);

export interface ReplayWallState {
  available: boolean;
  originalLiveWall: Tile[];
  originalDeadWall: Tile[];
  liveWall: Tile[];
  deadWall: Tile[];
  drawnLiveTiles: Tile[];
  drawnDeadTiles: Tile[];
  nextLiveTile?: Tile;
  rinshanRemaining: number;
  currentDrawPosition: number;
  doraIndicatorSlots: Array<Tile | undefined>;
  uraIndicatorSlots: Array<Tile | undefined>;
}

export interface BuiltReplayState {
  gameState: GameState;
  roundInfo: Pick<RoundLog, 'roundId' | 'roundWind' | 'handNumber' | 'honba'>;
  stepIndex: number;
  totalSteps: number;
  actions: GameEvent[];
  currentAction?: GameEvent;
  wall: ReplayWallState;
  settlementRiichiSticks?: number;
}

export interface ReplayBuildOptions {
  scores?: [number, number, number, number];
  playerNames?: [string, string, string, string];
  ruleConfig?: FullRuleConfig;
}

interface MutableReplayContext {
  gameState: GameState;
  originalLiveWall: Tile[];
  originalDeadWall: Tile[];
  drawnLiveTiles: Tile[];
  drawnDeadTiles: Tile[];
  riichiDiscardPending: Set<PlayerId>;
  wallAvailable: boolean;
  hasSettlementAction: boolean;
  scoresSettled: boolean;
  initialPointTotal: number;
  authoritativeFinalScores?: ScoreTuple;
  settlementRiichiSticks?: number;
}

type ScoreTuple = [number, number, number, number];

interface CompatibleReplayScores {
  finalScores?: unknown;
  scoresAfter?: unknown;
  scoreChanges?: unknown;
}

type ReplayCallEvent = SimpleCallEvent & {
  type: 'chi-declared' | 'pon-declared' | 'ankan-declared' | 'minkan-declared' | 'kakan-declared';
};
type ReplayResultEvent = WinDeclaredEvent | DrawEvent | RoundEndedEvent;

export function replayActions(round: RoundLog): GameEvent[] {
  return round.events
    .filter((event) => ACTION_TYPES.has(event.type))
    .sort((a, b) => a.sequence - b.sequence);
}

export function buildReplayState(round: RoundLog, stepIndex: number, options: ReplayBuildOptions = {}): BuiltReplayState {
  const actions = replayActions(round);
  const target = Math.max(0, Math.min(stepIndex, actions.length));
  const context = createInitialContext(round, options);
  for (let index = 0; index < target; index += 1) {
    applyReplayAction(context, actions[index]);
  }
  return {
    gameState: context.gameState,
    roundInfo: {
      roundId: round.roundId,
      roundWind: round.roundWind,
      handNumber: round.handNumber,
      honba: round.honba,
    },
    stepIndex: target,
    totalSteps: actions.length,
    actions,
    currentAction: target > 0 ? actions[target - 1] : undefined,
    wall: buildWallState(context),
    settlementRiichiSticks: context.settlementRiichiSticks,
  };
}

export function initialScoresForRound(log: MatchLog, roundIndex: number): [number, number, number, number] {
  const explicit = log.rounds[roundIndex]?.initialScores;
  if (explicit) return [...explicit];
  const scores = [...log.initialScores] as [number, number, number, number];
  for (let index = 0; index < roundIndex; index += 1) {
    const previousRound = log.rounds[index];
    const result = previousRound?.result;
    if (!result) continue;
    const finalRiichiSticks = finalRiichiSticksForRound(previousRound);
    const initialPointTotal = sumScores(scores) + previousRound.riichiSticks * 1000;
    const authoritative = resolveReplayFinalScores(previousRound, scores);
    if (authoritative && isConservedScoreSet(authoritative, finalRiichiSticks, initialPointTotal)) {
      authoritative.forEach((score, player) => {
        scores[player] = score;
      });
      continue;
    }
    const riichiPlayers = new Set(previousRound.events
      .filter((event) => event.type === 'riichi-declared' && event.actor !== undefined)
      .map((event) => event.actor!));
    riichiPlayers.forEach((player) => {
      scores[player] -= 1000;
    });
    result.pointDeltas.forEach((delta, player) => {
      scores[player] += delta ?? 0;
    });
  }
  return scores;
}

/**
 * Compatibility precedence for old logs: final scores are absolute; scoreChanges
 * are whole-round net changes from the round's initial scores. RoundResult.pointDeltas
 * are deliberately excluded because they are pre-result settlement transfers.
 */
export function resolveReplayFinalScores(round: RoundLog, initialScores: ScoreTuple): ScoreTuple | undefined {
  const roundScores = round as RoundLog & CompatibleReplayScores;
  const resultScores = round.result as (RoundResult & CompatibleReplayScores) | undefined;
  const absolute = asScoreTuple(roundScores.finalScores)
    ?? asScoreTuple(roundScores.scoresAfter)
    ?? asScoreTuple(resultScores?.finalScores)
    ?? asScoreTuple(resultScores?.scoresAfter);
  if (absolute) return absolute;
  const changes = asScoreTuple(roundScores.scoreChanges) ?? asScoreTuple(resultScores?.scoreChanges);
  return changes
    ? initialScores.map((score, index) => score + changes[index]) as ScoreTuple
    : undefined;
}

export function replayConservedPoints(state: Pick<GameState, 'players' | 'riichiSticks'>): number {
  return sumScores(state.players.map((player) => player.score)) + state.riichiSticks * 1000;
}

function createInitialContext(round: RoundLog, options: ReplayBuildOptions): MutableReplayContext {
  const hands = round.initialHands ?? dealtHandsEvent(round)?.hands ?? [[], [], [], []];
  const { liveWall, deadWall, available } = resolveWall(round);
  const initialDora = round.initialDoraIndicators?.map(tileFromSnapshot)
    ?? doraIndicatorSlots(deadWall).slice(0, 1);
  const scores = options.scores ?? round.initialScores ?? [25000, 25000, 25000, 25000];
  const names = options.playerNames ?? ['玩家1', '玩家2', '玩家3', '玩家4'];
  const players = ([0, 1, 2, 3] as PlayerId[]).map((id) => ({
    id,
    name: names[id],
    seatWind: seatWindForPlayer(round.dealer, id),
    score: scores[id],
    hand: (hands[id] ?? []).map(tileFromSnapshot).sort(sortTiles),
    river: [],
    calls: [],
    drawnTile: null,
    riichi: false,
    riichiState: null,
    furitenState: { temporaryFuriten: false, riichiPermanentFuriten: false },
    pendingRiichiSidewaysDiscard: false,
  }));
  const gameState: GameState = {
    roundWind: round.roundWind,
    dealer: round.dealer,
    honba: round.honba,
    riichiSticks: round.riichiSticks,
    wall: available ? [...liveWall] : [],
    deadWall: available ? [...deadWall] : [],
    doraIndicators: initialDora,
    players,
    currentPlayer: round.dealer,
    phase: 'discard',
    turn: 1,
    lastDiscard: null,
    result: null,
    pendingCall: null,
    pendingRon: null,
    pendingKakan: null,
    kanState: null,
    callsOccurred: false,
    firstTurnInterrupted: false,
    playerDrawCounts: [0, 0, 0, 0],
    playerDiscardCounts: [0, 0, 0, 0],
    lastDrawSource: 'initial-hand',
    lastWinSource: null,
    lastLiveWallDiscarder: null,
    pendingAbortiveDrawAfterFourthKan: false,
    kuikaeForbiddenTileIds: {},
    ruleConfig: options.ruleConfig?.round,
    matchRuleConfig: options.ruleConfig?.match,
  };
  return {
    gameState,
    originalLiveWall: liveWall,
    originalDeadWall: deadWall,
    drawnLiveTiles: [],
    drawnDeadTiles: [],
    riichiDiscardPending: new Set<PlayerId>(),
    wallAvailable: available,
    hasSettlementAction: replayActions(round).some((event) => event.type === 'round-ended'),
    scoresSettled: false,
    initialPointTotal: sumScores(scores) + round.riichiSticks * 1000,
    authoritativeFinalScores: resolveReplayFinalScores(round, [...scores] as ScoreTuple),
  };
}

function applyReplayAction(context: MutableReplayContext, event: GameEvent): void {
  const state = context.gameState;
  if (event.type === 'tile-drawn' && event.actor !== undefined) {
    let tile = tileFromSnapshot(event.tile);
    const source = event.source === 'rinshan' || state.deadWall.some((entry) => entry.instanceId === tile.instanceId)
      ? 'rinshan'
      : 'live-wall';
    if (source === 'rinshan' && context.wallAvailable) {
      const wallAdvance = advanceWallAfterKan(state.wall, context.originalDeadWall, context.drawnDeadTiles.length);
      tile = wallAdvance.rinshanTile ?? tile;
      state.wall = wallAdvance.liveWall;
      state.deadWall = wallAdvance.deadWall;
    }
    const player = state.players[event.actor];
    player.hand = [...player.hand, tile];
    player.drawnTile = tile;
    state.currentPlayer = event.actor;
    state.phase = 'discard';
    state.lastDrawSource = source;
    if (source === 'rinshan') {
      if (!context.wallAvailable) state.deadWall = removeTile(state.deadWall, tile.instanceId);
      context.drawnDeadTiles.push(tile);
    } else {
      state.wall = removeTile(state.wall, tile.instanceId);
      context.drawnLiveTiles.push(tile);
    }
    state.playerDrawCounts[event.actor] += 1;
    return;
  }

  if (event.type === 'riichi-declared' && event.actor !== undefined) {
    const player = state.players[event.actor];
    if (!player.riichi) player.score -= 1000;
    player.riichi = true;
    player.riichiState = {
      declaredAtTurn: state.turn,
      ippatsuAvailable: true,
      kind: 'riichi',
    };
    context.riichiDiscardPending.add(event.actor);
    state.riichiSticks = event.sticks;
    return;
  }

  if (event.type === 'tile-discarded' && event.actor !== undefined) {
    const player = state.players[event.actor];
    const sourceTile = player.hand.find((tile) => tile.instanceId === event.tile.instanceId) ?? tileFromSnapshot(event.tile);
    const isTsumogiri = player.drawnTile?.instanceId === sourceTile.instanceId;
    const isRiichiDiscard = context.riichiDiscardPending.has(event.actor);
    const riverTile: Tile = {
      ...sourceTile,
      isTsumogiri,
      isRiichiDiscard: isRiichiDiscard || undefined,
    };
    player.hand = removeTile(player.hand, sourceTile.instanceId);
    player.drawnTile = null;
    player.hand.sort(sortTiles);
    player.river = [...player.river, riverTile];
    if (isRiichiDiscard && player.riichiState) {
      player.riichiState = { ...player.riichiState, riichiDiscardInstanceId: riverTile.instanceId };
      context.riichiDiscardPending.delete(event.actor);
    }
    player.pendingRiichiSidewaysDiscard = false;
    state.lastDiscard = { player: event.actor, tile: riverTile };
    state.currentPlayer = ((event.actor + 1) % 4) as PlayerId;
    state.phase = 'draw';
    state.turn += 1;
    state.playerDiscardCounts[event.actor] += 1;
    state.kuikaeForbiddenTileIds = clearKuikaeRestriction(state, event.actor);
    return;
  }

  if (isCallEvent(event) && event.actor !== undefined) {
    applyCall(context, event);
    return;
  }

  if (event.type === 'dora-revealed') {
    const expected = context.wallAvailable
      ? doraIndicatorSlots(context.originalDeadWall)[state.doraIndicators.length]
      : undefined;
    const snapshots = expected ? [expected] : (event.tiles ?? []).map(tileFromSnapshot);
    for (const tile of snapshots) {
      if (!state.doraIndicators.some((indicator) => indicator.instanceId === tile.instanceId)) {
        state.doraIndicators = [...state.doraIndicators, tile];
      }
    }
    return;
  }

  if (isResultEvent(event)) {
    settleResult(context, event.result, event.type === 'round-ended' || !context.hasSettlementAction);
  }
}

function applyCall(context: MutableReplayContext, event: ReplayCallEvent): void {
  const state = context.gameState;
  const actor = event.actor!;
  const player = state.players[actor];
  const tiles = (event.tiles ?? []).map(tileFromSnapshot);
  const callType = event.type === 'chi-declared' ? 'chi' : event.type === 'pon-declared' ? 'pon' : 'kan';
  const kanType = event.type === 'ankan-declared'
    ? 'ankan'
    : event.type === 'kakan-declared' ? 'kakan' : event.type === 'minkan-declared' ? 'minkan' : undefined;
  const from = event.from ?? actor;
  const sourceRiver = state.players[from]?.river ?? [];
  const calledTile = tiles.find((tile) => sourceRiver.some((riverTile) => riverTile.instanceId === tile.instanceId));
  if (calledTile) {
    const claimedRiverTile = sourceRiver.find((riverTile) => riverTile.instanceId === calledTile.instanceId);
    markRiverTileClaimed(state.players[from], calledTile.instanceId, actor);
    if (claimedRiverTile?.isRiichiDiscard) {
      context.riichiDiscardPending.add(from);
    }
  }
  player.hand = player.hand.filter((handTile) => !tiles.some((tile) => tile.instanceId === handTile.instanceId));
  if (player.drawnTile && tiles.some((tile) => tile.instanceId === player.drawnTile?.instanceId)) player.drawnTile = null;
  const call: CallSet = {
    type: callType,
    tiles,
    from,
    opened: kanType !== 'ankan',
    kanType,
    calledTile,
    sequence: callType === 'chi' ? tiles.map((tile) => tile.id).sort((a, b) => a - b) : undefined,
    usedTileIds: callType === 'chi' ? tiles.filter((tile) => tile.instanceId !== calledTile?.instanceId).map((tile) => tile.id) : undefined,
  };
  if (kanType === 'kakan') {
    const upgradedIndex = player.calls.findIndex((existing) => existing.type === 'pon' && existing.tiles[0]?.id === tiles[0]?.id);
    player.calls = upgradedIndex >= 0
      ? player.calls.map((existing, index) => index === upgradedIndex ? call : existing)
      : [...player.calls, call];
  } else {
    player.calls = [...player.calls, call];
  }
  state.currentPlayer = actor;
  state.phase = 'discard';
  state.callsOccurred = true;
  if (isKuikaeEnabled(state) && callType === 'chi') {
    state.kuikaeForbiddenTileIds = setKuikaeRestriction(state, actor, kuikaeForbiddenAfterChi(call.usedTileIds ?? []));
  } else if (isKuikaeEnabled(state) && callType === 'pon') {
    const ponTileId = calledTile?.id ?? tiles[0]?.id;
    if (ponTileId !== undefined) state.kuikaeForbiddenTileIds = setKuikaeRestriction(state, actor, kuikaeForbiddenAfterPon(ponTileId));
  }
}

function settleResult(context: MutableReplayContext, result: RoundResult, applyScores: boolean): void {
  const state = context.gameState;
  state.kuikaeForbiddenTileIds = {};
  context.settlementRiichiSticks ??= result.settlementRiichiSticks ?? state.riichiSticks;
  if (applyScores && !context.scoresSettled) {
    const finalRiichiSticks = result.type === 'tsumo' || result.type === 'ron' ? 0 : state.riichiSticks;
    const authoritative = context.authoritativeFinalScores;
    state.players = authoritative && isConservedScoreSet(authoritative, finalRiichiSticks, context.initialPointTotal)
      ? state.players.map((player, index) => ({ ...player, score: authoritative[index] }))
      : state.players.map((player, index) => ({
          ...player,
          score: player.score + (result.pointDeltas[index] ?? 0),
        }));
    state.riichiSticks = finalRiichiSticks;
    context.scoresSettled = true;
  }
  if (result.type === 'ron') {
    for (const winner of result.winners) {
      const player = state.players[winner.winner];
      if (!player.hand.some((tile) => tile.instanceId === winner.winTile.instanceId)) {
        player.hand = [...player.hand, { ...winner.winTile }];
      }
    }
    state.lastWinSource = 'ron-discard';
  } else if (result.type === 'tsumo') {
    state.lastWinSource = 'normal-tsumo';
  }
  state.result = result.settlementRiichiSticks === undefined
    ? { ...result, settlementRiichiSticks: context.settlementRiichiSticks }
    : result;
  state.phase = 'round-ended';
  state.players = state.players.map((player) => ({ ...player, pendingRiichiSidewaysDiscard: false }));
  context.riichiDiscardPending.clear();
}

function asScoreTuple(value: unknown): ScoreTuple | undefined {
  if (!Array.isArray(value) || value.length !== 4 || value.some((score) => !Number.isFinite(score))) return undefined;
  return [...value] as ScoreTuple;
}

function sumScores(scores: readonly number[]): number {
  return scores.reduce((sum, score) => sum + score, 0);
}

function finalRiichiSticksForRound(round: RoundLog): number {
  if (round.result?.type === 'tsumo' || round.result?.type === 'ron') return 0;
  const declarations = round.events
    .filter((event) => event.type === 'riichi-declared')
    .sort((a, b) => a.sequence - b.sequence);
  const last = declarations[declarations.length - 1];
  return last?.type === 'riichi-declared' ? last.sticks : round.riichiSticks;
}

function isConservedScoreSet(scores: ScoreTuple, riichiSticks: number, expectedTotal: number): boolean {
  return sumScores(scores) + riichiSticks * 1000 === expectedTotal;
}

function buildWallState(context: MutableReplayContext): ReplayWallState {
  const available = context.wallAvailable;
  return {
    available,
    originalLiveWall: [...context.originalLiveWall],
    originalDeadWall: [...context.originalDeadWall],
    liveWall: [...context.gameState.wall],
    deadWall: [...context.gameState.deadWall],
    drawnLiveTiles: [...context.drawnLiveTiles],
    drawnDeadTiles: [...context.drawnDeadTiles],
    nextLiveTile: context.gameState.wall[0],
    rinshanRemaining: Math.max(0, 4 - context.drawnDeadTiles.length),
    currentDrawPosition: context.drawnLiveTiles.length,
    doraIndicatorSlots: doraIndicatorSlots(context.originalDeadWall),
    uraIndicatorSlots: uraDoraIndicatorSlots(context.originalDeadWall),
  };
}

function resolveWall(round: RoundLog): { liveWall: Tile[]; deadWall: Tile[]; available: boolean } {
  if (round.liveWall && round.deadWall) {
    return {
      liveWall: round.liveWall.map(tileFromSnapshot),
      deadWall: round.deadWall.map(tileFromSnapshot),
      available: round.deadWall.length === 14,
    };
  }
  if (round.wallOrder && round.wallOrder.length >= 14) {
    return {
      liveWall: round.wallOrder.slice(0, -14).map(tileFromSnapshot),
      deadWall: round.wallOrder.slice(-14).map(tileFromSnapshot),
      available: true,
    };
  }
  return { liveWall: [], deadWall: [], available: false };
}

function dealtHandsEvent(round: RoundLog): Extract<GameEvent, { type: 'tiles-dealt' }> | undefined {
  return round.events.find((event): event is Extract<GameEvent, { type: 'tiles-dealt' }> => event.type === 'tiles-dealt');
}

function tileFromSnapshot(snapshot: TileSnapshot): Tile {
  return {
    id: snapshot.tileId,
    suit: getTileSuit(snapshot.tileId),
    rank: getTileRank(snapshot.tileId),
    red: snapshot.red,
    instanceId: snapshot.instanceId,
  };
}

function removeTile(tiles: Tile[], instanceId: string): Tile[] {
  return tiles.filter((tile) => tile.instanceId !== instanceId);
}

function isCallEvent(event: GameEvent): event is ReplayCallEvent {
  return event.type === 'chi-declared'
    || event.type === 'pon-declared'
    || event.type === 'ankan-declared'
    || event.type === 'minkan-declared'
    || event.type === 'kakan-declared';
}

function isResultEvent(event: GameEvent): event is ReplayResultEvent {
  return event.type === 'tsumo-declared'
    || event.type === 'ron-declared'
    || event.type === 'abortive-draw'
    || event.type === 'exhaustive-draw'
    || event.type === 'round-ended';
}

export function replayPhaseLabel(phase: GamePhase): string {
  if (phase === 'round-ended') return '本局结束';
  if (phase === 'draw') return '等待摸牌';
  if (phase === 'discard') return '等待弃牌';
  return '回放中';
}
