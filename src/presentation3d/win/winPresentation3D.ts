import type { PlayerId } from '../../game/types';
import type {
  WinPresentationAction,
  WinPresentationPhase,
} from '../../presentation/winAnimation/WinPresentationController';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import { getSeatDirection } from '../coordinates/seatTransforms';
import { getHandTileTransform } from '../coordinates/sceneTransforms';
import { getGroundedTileCenterY } from '../tile/tileGrounding';
import { getHandTileScale } from '../table/tablePresentationTuning';

/** One winning tile, in front of its authoritative drawn slot; other hand tiles stay standing. */
export function winningTileSlapTransform(seat: Table3DSeat, index: number, count: number, progress: number) {
  const source = getHandTileTransform(seat, index, count, true);
  const direction = getSeatDirection(seat);
  const p = Math.max(0, Math.min(1, progress));
  const t = p * p * (3 - 2 * p);
  const rotationX = t === 1 ? 0 : source.rotationX * (1 - t);
  return { position: [source.position[0] + direction.x * 1.1 * t,
    getGroundedTileCenterY(rotationX, getHandTileScale(seat)) + Math.sin(Math.PI * t) * 0.3,
    source.position[2] + direction.z * 1.1 * t] as const, rotationX };
}

export type WinPresentation3DPhase = 'ready' | WinPresentationPhase;

export type WinPresentation3DState = Readonly<{
  action: WinPresentationAction;
  phase: WinPresentation3DPhase;
  progress?: number;
  revealedPlayerIds?: readonly PlayerId[];
}>;

export type WinningRiverTarget3D = Readonly<{
  playerId: PlayerId;
  riverIndex: number;
}>;

export function resolveWinnerRevealPlayerId3D(
  presentation: WinPresentation3DState | null,
  bottomPlayerId: PlayerId,
): PlayerId | undefined {
  const winnerId = presentation?.action.playerId;
  return winnerId === undefined || winnerId === bottomPlayerId ? undefined : winnerId;
}

export function resolveWinningRiverTarget3D(
  presentation: WinPresentation3DState | null,
): WinningRiverTarget3D | null {
  const source = presentation?.action.winType === 'ron'
    ? presentation.action.sourceDiscard
    : undefined;
  return source ? { playerId: source.playerId, riverIndex: source.riverIndex } : null;
}

export function resolveWinnerHandMotion3D(
  seat: Table3DSeat,
  phase: WinPresentation3DPhase,
): Readonly<{ offset: readonly [number, number, number]; tiltX: number }> {
  if (phase === 'ready' || phase === 'cleanup') return { offset: [0, 0, 0], tiltX: 0 };
  const direction = getSeatDirection(seat);
  const progress = phase === 'slam' ? 0.24 : 1;
  return {
    offset: [direction.x * 0.82 * progress, phase === 'slam' ? 0.08 : 0, direction.z * 0.82 * progress],
    tiltX: -0.22 * progress,
  };
}
