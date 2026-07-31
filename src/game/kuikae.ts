import { defaultRuleConfig } from './score/rules/RuleConfig';
import type { GameState, PlayerId, Tile, TileId } from './types';

export function kuikaeForbiddenAfterChi(usedTileIds: readonly TileId[]): TileId[] {
  if (usedTileIds.length !== 2) return [];
  const [low, high] = [...usedTileIds].sort((a, b) => a - b);
  if (low >= 27 || high >= 27 || Math.floor(low / 9) !== Math.floor(high / 9)) return [];
  const suitStart = Math.floor(low / 9) * 9;
  const suitEnd = suitStart + 8;
  if (high - low === 1) {
    return [low - 1, high + 1].filter((id) => id >= suitStart && id <= suitEnd) as TileId[];
  }
  return high - low === 2 ? [(low + 1) as TileId] : [];
}

export function kuikaeForbiddenAfterPon(tileId: TileId): TileId[] {
  return [tileId];
}

export function isKuikaeEnabled(state: Pick<GameState, 'ruleConfig'>): boolean {
  return (state.ruleConfig?.forbidKuikae ?? defaultRuleConfig.forbidKuikae) !== false;
}

export function kuikaeForbiddenForPlayer(state: Pick<GameState, 'kuikaeForbiddenTileIds'>, playerId: PlayerId): TileId[] {
  return [...(state.kuikaeForbiddenTileIds[playerId] ?? [])];
}

export function filterKuikaeDiscardTiles(hand: readonly Tile[], forbiddenTileIds: readonly TileId[]): Tile[] {
  const forbidden = new Set(forbiddenTileIds);
  return hand.filter((tile) => !forbidden.has(tile.id));
}

export function legalDiscardTiles(state: GameState, playerId: PlayerId): Tile[] {
  const player = state.players[playerId];
  if (!player) return [];
  return isKuikaeEnabled(state)
    ? filterKuikaeDiscardTiles(player.hand, kuikaeForbiddenForPlayer(state, playerId))
    : [...player.hand];
}

export function canDiscardTileByRules(state: GameState, playerId: PlayerId, tileInstanceId: string): boolean {
  return legalDiscardTiles(state, playerId).some((tile) => tile.instanceId === tileInstanceId);
}

export function hasLegalDiscardAfterCall(hand: readonly Tile[], forbiddenTileIds: readonly TileId[], enabled: boolean): boolean {
  return !enabled || filterKuikaeDiscardTiles(hand, forbiddenTileIds).length > 0;
}

export function removeTilesByType(hand: readonly Tile[], tileIds: readonly TileId[]): Tile[] | null {
  const remaining = [...hand];
  for (const tileId of tileIds) {
    const index = remaining.findIndex((tile) => tile.id === tileId);
    if (index < 0) return null;
    remaining.splice(index, 1);
  }
  return remaining;
}

export function setKuikaeRestriction(state: GameState, playerId: PlayerId, forbiddenTileIds: readonly TileId[]): GameState['kuikaeForbiddenTileIds'] {
  return {
    ...state.kuikaeForbiddenTileIds,
    [playerId]: [...new Set(forbiddenTileIds)],
  };
}

export function clearKuikaeRestriction(state: GameState, playerId: PlayerId): GameState['kuikaeForbiddenTileIds'] {
  const next = { ...state.kuikaeForbiddenTileIds };
  delete next[playerId];
  return next;
}
