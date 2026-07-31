import { defaultRuleConfig } from './score/rules/RuleConfig';
import type { AbortiveDrawReason, AbortiveDrawResult, GameState, PlayerId, Tile } from './types';

const ORPHANS = new Set([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]);
const WINDS = new Set([27, 28, 29, 30]);

export function buildAbortiveDrawResult(reason: AbortiveDrawReason, options: { declaredBy?: PlayerId; triggeringPlayer?: PlayerId } = {}): AbortiveDrawResult {
  return {
    type: 'abortive-draw',
    reason,
    declaredBy: options.declaredBy,
    triggeringPlayer: options.triggeringPlayer,
    dealerContinues: true,
    honbaIncrement: 1,
    riichiSticksCarryOver: true,
    scoreDeltas: [0, 0, 0, 0],
    pointDeltas: [0, 0, 0, 0],
  };
}

export function canDeclareKyuushuKyuuhai(state: GameState, playerId: PlayerId): boolean {
  const config = { ...defaultRuleConfig, ...(state.ruleConfig ?? {}) };
  if (!config.allowKyuushuKyuuhai) return false;
  const player = state.players[playerId];
  if (!player) return false;
  if (state.lastDrawSource === 'rinshan') return false;
  if (state.callsOccurred || state.firstTurnInterrupted) return false;
  if ((state.playerDiscardCounts[playerId] ?? 0) > 0 || player.river.length > 0) return false;
  if ((state.playerDrawCounts[playerId] ?? 0) > 1) return false;
  const kinds = new Set(player.hand.filter((tile) => ORPHANS.has(tile.id)).map((tile) => tile.id));
  return kinds.size >= 9;
}

export function declareKyuushuKyuuhai(state: GameState, playerId: PlayerId): GameState {
  if (!canDeclareKyuushuKyuuhai(state, playerId)) return state;
  return {
    ...state,
    phase: 'round-ended',
    honba: state.honba + 1,
    result: buildAbortiveDrawResult('kyuushu-kyuuhai', { declaredBy: playerId }),
    kuikaeForbiddenTileIds: {},
    players: state.players.map((player) => ({ ...player, pendingRiichiSidewaysDiscard: false })),
  };
}

export function checkAbortiveDrawAfterDiscard(state: GameState, discarder: PlayerId, discarded: Tile): AbortiveDrawResult | null {
  const config = { ...defaultRuleConfig, ...(state.ruleConfig ?? {}) };
  if (config.abortOnFourWinds && isSuufonRenda(state)) return buildAbortiveDrawResult('suufon-renda', { triggeringPlayer: discarder });
  if (config.abortOnFourRiichi && state.players.every((player) => player.riichi)) return buildAbortiveDrawResult('suucha-riichi', { triggeringPlayer: discarder });
  if (config.abortOnFourKans && state.pendingAbortiveDrawAfterFourthKan) return buildAbortiveDrawResult('suukan-sanra', { triggeringPlayer: discarder });
  return null;
}

function isSuufonRenda(state: GameState): boolean {
  if (state.callsOccurred || state.firstTurnInterrupted) return false;
  const firstDiscards = state.players.map((player) => player.river[0]);
  if (firstDiscards.some((tile) => !tile || !WINDS.has(tile.id))) return false;
  return firstDiscards.every((tile) => tile?.id === firstDiscards[0]?.id);
}
