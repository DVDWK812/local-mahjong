import type { WorldPoint3D } from '../animation/DiscardSource3D';
import { canonicalToSeat } from '../coordinates/sceneTransforms';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import {
  getCenterDecorationCenter,
  TABLE_PRESENTATION_TUNING,
} from '../table/tablePresentationTuning';
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
  const { laneOffset, seatOffsets } = TABLE_PRESENTATION_TUNING.riichiStickLayout;
  const { inline, radial } = seatOffsets[seat];
  const seatLocal = canonicalToSeat(seat, [
    inline,
    TABLE_FELT_TOP_Y + height / 2 + epsilon,
    laneOffset + radial,
  ]);
  const [centerX, centerZ] = getCenterDecorationCenter();
  return {
    position: [
      seatLocal.position[0] + centerX,
      seatLocal.position[1],
      seatLocal.position[2] + centerZ,
    ],
    rotationY: seatLocal.rotationY,
  };
}
