import { canonicalToSeat } from '../coordinates/sceneTransforms';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import { RIICHI_STICK_3D_LAYOUT } from '../riichi/riichiStickGeometry';
import { TABLE_FELT_TOP_Y } from './tableSurfaceSpec';
import { getCenterDecorationCenter, getEffectiveCentralHudPosition, TABLE_PRESENTATION_TUNING } from './tablePresentationTuning';

// Html transform's default distanceFactor=10 maps 40 CSS pixels to one world unit.
export const CENTRAL_SCORE_CSS_SIZE = 350;
const HTML_PIXELS_PER_WORLD_UNIT = 40;
const SCORE_LANE_CLEARANCE = 0.16;
const seats = ['bottom', 'right', 'top', 'left'] as const;

/** The inner felt square is the console's outer frame; the large square is the table guide. */
export function getCentralConsoleLayout(viewportHeight = 1080) {
  const tuning = TABLE_PRESENTATION_TUNING;
  const center = getCenterDecorationCenter();
  const base = getEffectiveCentralHudPosition();
  const hud = tuning.centralHud;
  const lane = tuning.riichiStickLayout;
  const desiredScale = viewportHeight <= hud.compactViewportMaxHeight ? hud.compactScale : hud.regularScale;
  const maxHalfSize = lane.laneOffset - RIICHI_STICK_3D_LAYOUT.width / 2 - SCORE_LANE_CLEARANCE
    - Math.max(Math.abs(hud.hudOnlyOffsetX), Math.abs(hud.hudOnlyOffsetZ));
  const scale = Math.min(desiredScale, maxHalfSize * 2 * HTML_PIXELS_PER_WORLD_UNIT / CENTRAL_SCORE_CSS_SIZE);
  const riichiLanes = Object.fromEntries(seats.map(seat => {
    const offset = lane.seatOffsets[seat];
    const transform = canonicalToSeat(seat, [offset.inline,
      TABLE_FELT_TOP_Y + RIICHI_STICK_3D_LAYOUT.height / 2 + RIICHI_STICK_3D_LAYOUT.epsilon,
      lane.laneOffset + offset.radial]);
    return [seat, { position: [center[0] + transform.position[0], transform.position[1], center[1] + transform.position[2]] as const,
      rotationY: transform.rotationY }];
  })) as Record<Table3DSeat, { position: readonly [number, number, number]; rotationY: number }>;
  return {
    outerFrame: { center, size: tuning.centerDecoration.innerSquareSize },
    scoreHud: { position: [base[0] + hud.hudOnlyOffsetX, base[1], base[2] + hud.hudOnlyOffsetZ] as const,
      scale, cssSize: CENTRAL_SCORE_CSS_SIZE, halfSize: CENTRAL_SCORE_CSS_SIZE * scale / HTML_PIXELS_PER_WORLD_UNIT / 2 },
    riichiLanes,
  };
}
