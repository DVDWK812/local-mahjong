import type { GameState, PlayerId } from '../game/types';
import type { TableRendererMode } from './rendererMode';

export type TableRendererFallbackReason =
  | 'none'
  | 'non-standard-four-player-state'
  | 'webgl-init-failure'
  | 'scene-render-error'
  | 'lazy-load-error';

export type StandardFourPlayerDiagnostics = Readonly<{
  supported: boolean;
  playerCount: number;
  playerIds: readonly number[];
  missingPlayerIds: readonly PlayerId[];
  duplicatePlayerIds: readonly number[];
}>;

export type TableRendererDiagnostics = Readonly<{
  requested: TableRendererMode;
  active: TableRendererMode;
  standardFourPlayer: boolean;
  attempted3dMount: boolean;
  fallbackReason: TableRendererFallbackReason;
}>;

const STANDARD_PLAYER_IDS = [0, 1, 2, 3] as const;
const FALLBACK_REASON_KEY = 'tableRendererFallbackReason';

export function inspectStandardFourPlayerState(
  gameState: Pick<GameState, 'players'>,
): StandardFourPlayerDiagnostics {
  const playerIds = gameState.players.map((player) => Number(player.id));
  const missingPlayerIds = STANDARD_PLAYER_IDS.filter((playerId) =>
    !playerIds.includes(playerId));
  const duplicatePlayerIds = [...new Set(playerIds.filter((playerId, index) =>
    playerIds.indexOf(playerId) !== index))];
  return {
    supported:
      playerIds.length === STANDARD_PLAYER_IDS.length
      && missingPlayerIds.length === 0
      && duplicatePlayerIds.length === 0,
    playerCount: playerIds.length,
    playerIds,
    missingPlayerIds,
    duplicatePlayerIds,
  };
}

export function resolveTableRendererDiagnostics(
  requested: TableRendererMode,
  standardFourPlayer: boolean,
  attempted3dMount: boolean,
  sceneReady: boolean,
  runtimeFailure: Exclude<TableRendererFallbackReason, 'none'> | null,
): TableRendererDiagnostics {
  const fallbackReason: TableRendererFallbackReason = requested !== '3d'
    ? 'none'
    : !standardFourPlayer
      ? 'non-standard-four-player-state'
      : runtimeFailure ?? 'none';
  return {
    requested,
    active: attempted3dMount && sceneReady && fallbackReason === 'none' ? '3d' : '2d',
    standardFourPlayer,
    attempted3dMount,
    fallbackReason,
  };
}

export function tagTableRendererError(
  cause: unknown,
  fallbackReason: Exclude<TableRendererFallbackReason, 'none'>,
): Error {
  const error = cause instanceof Error ? cause : new Error(String(cause));
  Object.defineProperty(error, FALLBACK_REASON_KEY, {
    configurable: true,
    value: fallbackReason,
  });
  return error;
}

export function getTaggedTableRendererFallbackReason(
  error: unknown,
): Exclude<TableRendererFallbackReason, 'none'> | null {
  if (!(error instanceof Error)) return null;
  const value = (error as Error & Record<string, unknown>)[FALLBACK_REASON_KEY];
  return value === 'non-standard-four-player-state'
    || value === 'webgl-init-failure'
    || value === 'scene-render-error'
    || value === 'lazy-load-error'
    ? value
    : null;
}

export function classifyTableRendererError(
  error: unknown,
): Exclude<TableRendererFallbackReason, 'none'> {
  return getTaggedTableRendererFallbackReason(error) ?? 'scene-render-error';
}
