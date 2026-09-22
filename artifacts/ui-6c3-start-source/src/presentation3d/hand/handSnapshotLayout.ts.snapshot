import { resolveHandPresentationSlots, type HandPresentationFrame } from '../../presentation/handAnimation/HandPresentationSnapshot';
import type { SeatSceneState } from '../sceneState/tableSceneTypes';
import { getHandTileTransform } from '../coordinates/sceneTransforms';

export function resolveHandSnapshotLayout(seat: SeatSceneState, frame: HandPresentationFrame) {
  const snapshot = frame.snapshot;
  const baseCount = snapshot.visualHand.length - (snapshot.drawnTile ? 1 : 0);
  const origin = getHandTileTransform(seat.seat, 0, baseCount, false);
  const next = getHandTileTransform(seat.seat, 1, baseCount, false);
  const drawn = getHandTileTransform(seat.seat, baseCount, baseCount + 1, true);
  const plainDrawn = getHandTileTransform(seat.seat, baseCount, baseCount, false);
  const visible = seat.hand.some((tile) => tile.faceState === 'face-up');
  return resolveHandPresentationSlots(frame).map((entry) => ({
    ...entry,
    key: `hand-${seat.playerId}-${entry.tile.instanceId}`,
    faceState: visible ? 'face-up' as const : 'face-down' as const,
    definition: visible ? (seat.hand.find((tile) => tile.key === `hand-${seat.playerId}-${entry.tile.instanceId}`)?.tile ?? entry.tile) : undefined,
    transform: frame.phase === 'complete' && !entry.hidden
      ? getHandTileTransform(seat.seat, entry.finalIndex, snapshot.finalHand.length, false)
      : { ...origin, position: origin.position.map((value, axis) => value
      + (next.position[axis] - value) * entry.slot
      + (drawn.position[axis] - plainDrawn.position[axis]) * entry.drawnGap
      + (axis === 1 ? entry.lift * 0.3 : 0)) as [number, number, number] },
  }));
}
