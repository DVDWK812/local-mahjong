import type { PlayerId } from '../../game/types';
import type {
  WinPresentationAction,
  WinPresentationPhase,
} from '../../presentation/winAnimation/WinPresentationController';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import { getSeatDirection } from '../coordinates/seatTransforms';

export type WinPresentation3DPhase = 'ready' | WinPresentationPhase;

export type WinPresentation3DState = Readonly<{
  action: WinPresentationAction;
  phase: WinPresentation3DPhase;
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
