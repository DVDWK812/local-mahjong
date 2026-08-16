import { getPonOptions } from './callChecker';
import { buildAbortiveDrawResult, checkAbortiveDrawAfterDiscard } from './abortiveDraw';
import { getChiOptions } from './chiChecker';
import { isPlayerTenpaiAtDraw, settleExhaustiveDraw } from './exhaustiveDraw';
import { getMinkanOptions } from './kanChecker';
import type { GameState, PlayerId, PlayerState, RoundResult, Tile } from './types';
import { sortTiles, WIND_ORDER } from './tileUtils';
import { createShuffledWall, splitDeadWall } from './wall';
import { buildRonResult, buildTsumoResult, canRon } from './winChecker';
import { canDiscardTileByRules, clearKuikaeRestriction } from './kuikae';

function createPlayers(): PlayerState[] {
  return WIND_ORDER.map((wind, index) => ({
    id: index as PlayerId,
    name: ['Player 1', 'Player 2', 'Player 3', 'Player 4'][index],
    seatWind: wind,
    score: 25000,
    hand: [],
    river: [],
    calls: [],
    drawnTile: null,
    riichi: false,
    riichiState: null,
    furitenState: {
      temporaryFuriten: false,
      riichiPermanentFuriten: false,
    },
    pendingRiichiSidewaysDiscard: false,
  }));
}

function clonePlayers(players: PlayerState[]): PlayerState[] {
  return players.map((player) => ({
    ...player,
    hand: [...player.hand],
    river: [...player.river],
    calls: player.calls.map((call) => ({ ...call, tiles: [...call.tiles] })),
    drawnTile: player.drawnTile ? { ...player.drawnTile } : null,
    riichiState: player.riichiState ? { ...player.riichiState } : null,
    furitenState: player.furitenState ? { ...player.furitenState } : undefined,
    pendingRiichiSidewaysDiscard: player.pendingRiichiSidewaysDiscard ?? false,
  }));
}

function dealInitialHands(players: PlayerState[], liveWall: Tile[]): { players: PlayerState[]; wall: Tile[] } {
  const dealtPlayers = clonePlayers(players);
  const wall = [...liveWall];

  for (let round = 0; round < 13; round += 1) {
    dealtPlayers.forEach((player) => {
      const tile = wall.shift();
      if (tile) player.hand.push(tile);
    });
  }

  dealtPlayers.forEach((player) => player.hand.sort(sortTiles));

  const dealerDraw = wall.shift();
  if (dealerDraw) {
    dealtPlayers[0].drawnTile = dealerDraw;
    dealtPlayers[0].hand.push(dealerDraw);
  }

  return { players: dealtPlayers, wall };
}

export function createInitialGameState(): GameState {
  const { liveWall, deadWall, doraIndicators } = splitDeadWall(createShuffledWall());
  const { players, wall } = dealInitialHands(createPlayers(), liveWall);

  return {
    roundWind: 'east',
    dealer: 0,
    honba: 0,
    riichiSticks: 0,
    wall,
    deadWall,
    doraIndicators,
    players,
    currentPlayer: 0,
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
  };
}

export function resetGame(): GameState {
  return createInitialGameState();
}

export function drawTile(state: GameState, options: { settleTsumo?: boolean } = {}): GameState {
  if (state.phase !== 'draw') return state;
  if (state.wall.length === 0) {
    return settleExhaustiveDraw(state);
  }

  const wall = [...state.wall];
  const drawn = wall.shift();
  if (!drawn) {
    return settleExhaustiveDraw({ ...state, wall });
  }

  const players = clonePlayers(state.players);
  const player = players[state.currentPlayer];
  player.drawnTile = drawn;
  player.hand.push(drawn);
  player.furitenState = {
    temporaryFuriten: false,
    riichiPermanentFuriten: player.furitenState?.riichiPermanentFuriten ?? false,
  };

  const nextState: GameState = {
    ...state,
    wall,
    players,
    phase: 'discard',
    lastDrawSource: 'live-wall',
    playerDrawCounts: state.playerDrawCounts.map((count, index) => index === state.currentPlayer ? count + 1 : count),
  };
  if (options.settleTsumo === false) return nextState;
  const result = buildTsumoResult(nextState, state.currentPlayer);

  return result
    ? settleRound(nextState, result)
    : nextState;
}

export function discardTile(state: GameState, playerId: PlayerId, tileInstanceId: string): GameState {
  if (state.phase !== 'discard' || state.currentPlayer !== playerId) return state;
  if (!canDiscardTileByRules(state, playerId, tileInstanceId)) return state;

  const currentPlayer = state.players[playerId];
  const isRiichiDeclarationDiscard = currentPlayer.riichi
    && currentPlayer.riichiState
    && !currentPlayer.riichiState.riichiDiscardInstanceId
    && currentPlayer.riichiState.declaredAtTurn === state.turn;
  if (currentPlayer.riichi
    && !isRiichiDeclarationDiscard
    && currentPlayer.drawnTile?.instanceId !== tileInstanceId) {
    return state;
  }

  const players = clonePlayers(state.players);
  const player = players[playerId];
  const tileIndex = player.hand.findIndex((tile) => tile.instanceId === tileInstanceId);
  if (tileIndex === -1) return state;

  const [discarded] = player.hand.splice(tileIndex, 1);
  const shouldSidewaysDiscard = isRiichiDeclarationDiscard || (player.pendingRiichiSidewaysDiscard ?? false);
  const isTsumogiri = player.drawnTile?.instanceId === discarded.instanceId;
  const riverDiscard = { ...discarded, isRiichiDiscard: shouldSidewaysDiscard || undefined, isTsumogiri };
  player.river.push(riverDiscard);
  if (isRiichiDeclarationDiscard && player.riichiState) {
    player.riichiState = {
      ...player.riichiState,
      riichiDiscardInstanceId: riverDiscard.instanceId,
    };
  }
  if (player.pendingRiichiSidewaysDiscard) player.pendingRiichiSidewaysDiscard = false;
  if (player.riichiState?.ippatsuAvailable && state.turn > player.riichiState.declaredAtTurn) {
    player.riichiState = {
      ...player.riichiState,
      ippatsuAvailable: false,
    };
  }
  if (player.drawnTile?.instanceId === discarded.instanceId) {
    player.drawnTile = null;
  } else {
    player.drawnTile = null;
    player.hand.sort(sortTiles);
  }

  const nextPlayer = ((playerId + 1) % 4) as PlayerId;

  const nextState: GameState = {
    ...state,
    players,
    currentPlayer: nextPlayer,
    phase: state.wall.length > 0 ? 'draw' : 'exhaustive-draw',
    turn: state.turn + 1,
    lastDiscard: {
      player: playerId,
      tile: riverDiscard,
    },
    pendingCall: null,
    playerDiscardCounts: state.playerDiscardCounts.map((count, index) => index === playerId ? count + 1 : count),
    lastLiveWallDiscarder: state.lastDrawSource === 'live-wall' && state.wall.length === 0 ? playerId : state.lastLiveWallDiscarder,
    kuikaeForbiddenTileIds: clearKuikaeRestriction(state, playerId),
  };
  const result = buildRonResult(nextState, playerId, discarded);

  const humanRonCandidates = canRon(nextState, playerId, discarded).filter((win) => win.winner === 0);
  if (humanRonCandidates.length > 0) {
    const allCandidates = canRon(nextState, playerId, discarded).map((win) => win.winner);
    return {
      ...nextState,
      phase: 'ron-window',
      pendingRon: {
        discarder: playerId,
        tile: discarded,
        eligibleRonPlayers: allCandidates,
        passedPlayers: [],
      },
    };
  }

  if (result) return settleRound(nextState, result);

  return openCallWindowOrContinue(nextState, playerId, discarded);
}

function openChiWindowOrContinue(state: GameState, discarder: PlayerId, discarded: Tile): GameState {
  const chiOptions = getChiOptions(state, discarder, discarded);
  if (chiOptions.length > 0) {
    return {
      ...state,
      phase: 'call-window',
      pendingCall: {
        discarder,
        tile: discarded,
        options: chiOptions,
      },
    };
  }
  const abortive = checkAbortiveDrawAfterDiscard(state, discarder, discarded);
  if (abortive) return settleRound(state, abortive);
  return state.wall.length === 0 ? settleExhaustiveDraw(state) : state;
}

function openCallWindowOrContinue(state: GameState, discarder: PlayerId, discarded: Tile): GameState {
  const options = [
    ...getMinkanOptions(state, discarder, discarded),
    ...getPonOptions(state, discarder, discarded),
    ...getChiOptions(state, discarder, discarded),
  ];
  if (options.length > 0) {
    return {
      ...state,
      phase: 'call-window',
      pendingCall: {
        discarder,
        tile: discarded,
        options,
      },
      pendingRon: null,
    };
  }
  const abortive = checkAbortiveDrawAfterDiscard(state, discarder, discarded);
  if (abortive) return settleRound(state, abortive);
  return state.wall.length === 0 ? settleExhaustiveDraw(state) : state;
}

function settleRound(state: GameState, result: RoundResult): GameState {
  return {
    ...state,
    phase: 'round-ended',
    result,
    honba: result.type === 'abortive-draw' || result.type === 'exhaustive-draw' ? state.honba + result.honbaIncrement : state.honba,
    players: state.players.map((player, index) => ({
      ...player,
      score: player.score + (result.pointDeltas[index] ?? 0),
      pendingRiichiSidewaysDiscard: false,
    })),
    kuikaeForbiddenTileIds: {},
  };
}

export { buildAbortiveDrawResult };

export function declareTsumo(state: GameState, playerId: PlayerId): GameState {
  const result = buildTsumoResult(state, playerId);
  return result ? settleRound(state, result) : state;
}

export function declareRon(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== 'ron-window' || !state.pendingRon) return state;
  if (!state.pendingRon.eligibleRonPlayers.includes(playerId) || state.pendingRon.passedPlayers.includes(playerId)) return state;
  const candidates = state.pendingRon.eligibleRonPlayers.filter((candidate) => !state.pendingRon?.passedPlayers.includes(candidate));
  const result = buildRonResult({ ...state, phase: 'discard', pendingRon: null }, state.pendingRon.discarder, state.pendingRon.tile, { candidatePlayers: candidates });
  return result ? settleRound({ ...state, pendingRon: null }, result) : state;
}

export function passRon(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== 'ron-window' || !state.pendingRon) return state;
  const players = state.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          furitenState: {
            temporaryFuriten: player.riichi ? (player.furitenState?.temporaryFuriten ?? false) : true,
            riichiPermanentFuriten: player.riichi ? true : (player.furitenState?.riichiPermanentFuriten ?? false),
          },
        }
      : player,
  );
  const pendingRon = {
    ...state.pendingRon,
    passedPlayers: [...new Set([...state.pendingRon.passedPlayers, playerId])] as PlayerId[],
  };
  const passedState = { ...state, players };
  const remaining = pendingRon.eligibleRonPlayers.filter((candidate) => !pendingRon.passedPlayers.includes(candidate));
  if (remaining.length > 0) {
    const result = buildRonResult({ ...passedState, phase: 'discard', pendingRon: null }, pendingRon.discarder, pendingRon.tile, { candidatePlayers: remaining });
    if (result) return settleRound({ ...passedState, pendingRon: null }, result);
  }
  return openCallWindowAfterRonPass({ ...passedState, pendingRon: null }, pendingRon.discarder, pendingRon.tile);
}

function openCallWindowAfterRonPass(state: GameState, discarder: PlayerId, discarded: Tile): GameState {
  return openCallWindowOrContinue(state, discarder, discarded);
}

export function canCall(): false {
  // TODO: Implement chi/pon/kan windows after each discard.
  return false;
}

export function canDeclareRiichi(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  return isRiichiDeclarationAvailable(state, playerId)
    && player.hand.some((tile) => evaluateRiichiDiscard(state, playerId, tile.instanceId) !== null);
}

export interface RiichiDiscardEvaluation {
  tile: Tile;
  handAfterDiscard: Tile[];
}

function isRiichiDeclarationAvailable(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  if (!player) return false;
  if (state.phase !== 'discard' || state.currentPlayer !== playerId) return false;
  if (player.riichi || player.riichiState) return false;
  if (player.score < 1000) return false;
  if (player.calls.some((call) => call.opened)) return false;
  return true;
}

export function evaluateRiichiDiscard(
  state: GameState,
  playerId: PlayerId,
  tileInstanceId: string,
): RiichiDiscardEvaluation | null {
  if (!isRiichiDeclarationAvailable(state, playerId)) return null;
  if (!canDiscardTileByRules(state, playerId, tileInstanceId)) return null;
  const player = state.players[playerId];
  const tile = player.hand.find((candidate) => candidate.instanceId === tileInstanceId);
  if (!tile) return null;
  const handAfterDiscard = player.hand.filter((candidate) => candidate.instanceId !== tileInstanceId);
  if (handAfterDiscard.length !== player.hand.length - 1) return null;
  const afterDiscardState: GameState = {
    ...state,
    players: state.players.map((candidate) => candidate.id === playerId
      ? { ...candidate, hand: handAfterDiscard, drawnTile: null }
      : candidate),
  };
  return isPlayerTenpaiAtDraw(afterDiscardState, playerId) ? { tile, handAfterDiscard } : null;
}

export function getRiichiDiscardCandidates(state: GameState, playerId: PlayerId): Tile[] {
  const player = state.players[playerId];
  if (!player || !isRiichiDeclarationAvailable(state, playerId)) return [];
  return player.hand.filter((tile) => evaluateRiichiDiscard(state, playerId, tile.instanceId) !== null);
}

export function declareRiichi(state: GameState, playerId: PlayerId, tileInstanceId: string): GameState {
  const evaluation = evaluateRiichiDiscard(state, playerId, tileInstanceId);
  if (!evaluation) return state;
  const kind = canDeclareDoubleRiichi(state, playerId) ? 'double-riichi' : 'riichi';
  const declaredState: GameState = {
    ...state,
    riichiSticks: state.riichiSticks + 1,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            score: player.score - 1000,
            riichi: true,
            riichiState: {
              declaredAtTurn: state.turn,
              ippatsuAvailable: true,
              kind,
            },
          }
        : player,
    ),
  };
  const discardedState = discardTile(declaredState, playerId, evaluation.tile.instanceId);
  const discardedPlayer = discardedState.players[playerId];
  if (discardedState === declaredState
    || discardedPlayer.hand.some((tile) => tile.instanceId === evaluation.tile.instanceId)
    || discardedPlayer.riichiState?.riichiDiscardInstanceId !== evaluation.tile.instanceId
    || !isPlayerTenpaiAtDraw(discardedState, playerId)) {
    return state;
  }
  return discardedState;
}

export function canDeclareDoubleRiichi(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  if (!player) return false;
  return !state.callsOccurred && !state.firstTurnInterrupted && player.calls.length === 0 && (state.playerDiscardCounts[playerId] ?? 0) === 0;
}

export function canWin(): false {
  // TODO: Implement ron/tsumo hand validation and scoring.
  return false;
}
