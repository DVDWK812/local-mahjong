import type { WorldPoint3D } from '../animation/DiscardSource3D';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import { getCentralConsoleLayout } from '../table/centralConsoleLayout';
import { TABLE_FELT_TOP_Y } from '../table/tableSurfaceSpec';

export type RiichiStickTransform = Readonly<{
  position: WorldPoint3D;
  rotationY: number;
}>;

export function getRiichiStickTransform(
  seat: Table3DSeat,
  height: number,
  epsilon: number,
): RiichiStickTransform {
  const lane = getCentralConsoleLayout().riichiLanes[seat];
  return {
    position: [
      lane.position[0],
      TABLE_FELT_TOP_Y + height / 2 + epsilon,
      lane.position[2],
    ],
    rotationY: lane.rotationY,
  };
}
