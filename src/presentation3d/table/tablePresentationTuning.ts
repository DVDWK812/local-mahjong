import type { Table3DSeat } from '../coordinates/seatTransforms';
import { CENTRAL_CONSOLE_DIMENSIONS } from './CentralConsole3D';

export type RiverSeatOffset = Readonly<{
  inlineX: number;
  radialZ: number;
}>;

export type RiichiStickSeatOffset = Readonly<{
  inline: number;
  radial: number;
}>;

export type MeldSeatOffset = Readonly<{
  inline: number;
  radial: number;
}>;

export type HandSeatOffset = Readonly<{
  inline: number;
  radial: number;
}>;

export type AvatarFrameSeatOffset = Readonly<{
  x: number;
  y: number;
}>;

const LOCAL_HAND_SCREEN_PIXELS_PER_TUNING_UNIT = 16;

const INNER_SQUARE_SIZE = 8.2;
const CENTER_DECORATION_SQUARE_GAP = 9.45;
const OUTER_SQUARE_SIZE = INNER_SQUARE_SIZE + CENTER_DECORATION_SQUARE_GAP * 2;
const DECORATION_LINE_WIDTH = 0.06;

/**
 * Renderer-only manual tuning authority. Values here must not affect rules
 * or tile identity.
 */
export const TABLE_PRESENTATION_TUNING = {
  doraVisual: {
    borderEnabled: 0 as 0 | 1,
    breathingEnabled: 1 as 0 | 1,
  },
  doraSweep3D: {
    enabled: 1 as 0 | 1,
    repeatEnabled: 1 as 0 | 1,
    repeatIntervalMs: 5000,
    normalDurationMs: 950,
    combinedDurationMs: 1100,
    shellScale: 1.008,
    bandWidth: 0.2,
    softness: 0.16,
    intensity: 0.72,
    dimmedStrength: 0.28,
    color: '#fff5c4',
    direction: [0.72, 0.28, -0.63] as const,
    start: -1.28,
    end: 1.28,
  },
  tileScale: {
    river: 1.2,
    meld: 1.2,
    topHand: 1.15,
    leftHand: 1.15,
    rightHand: 1.15,
  },
  lowerTableContentOffsetZ: 2,
  riverSeatOffsets: {
    bottom: { inlineX: 0, radialZ: 2.8 },
    right: { inlineX: -0.5, radialZ: 0 },
    top: { inlineX: 0, radialZ: 1.8 },
    left: { inlineX: 0.5, radialZ: 0 },
  } satisfies Readonly<Record<Table3DSeat, RiverSeatOffset>>,
  meldSeatOffsets: {
    bottom: { inline: 4.5, radial: 3 },
    right: { inline: 2, radial: 3.5 },
    top: { inline: 4.5, radial: 2 },
    left: { inline: 2, radial: 3.5 },
  } satisfies Readonly<Record<Table3DSeat, MeldSeatOffset>>,
  handSeatOffsets: {
    bottom: { inline: 0, radial: 0 },
    right: { inline: 0, radial: 0 },
    top: { inline: 0, radial: -2 },
    left: { inline: 0, radial: 0 },
  } satisfies Readonly<Record<Table3DSeat, HandSeatOffset>>,
  avatarFrame: {
    size: 1.1,
    seatOffsets: {
      bottom: { x: 500, y: -100 },
      right: { x: -30, y: 0 },
      top: { x: 350, y: 0 },
      left: { x: 30, y: 0 },
    } satisfies Readonly<Record<Table3DSeat, AvatarFrameSeatOffset>>,
  },
  centralHud: {
    position: [0, CENTRAL_CONSOLE_DIMENSIONS.panelSurfaceY + 0.008, 0] as const,
    hudOnlyOffsetX: 0.2,
    hudOnlyOffsetZ: -0.3,
    rotation: [-Math.PI / 2, 0, 0] as const,
    compactViewportMaxHeight: 800,
    compactScale: 0.96,
    regularScale: 0.72,
    fontSize: 'clamp(23px, 0.8vw, 14px)',
  },
  centerDecoration: {
    offsetX: 0,
    offsetZ: 0,
    innerSquareSize: INNER_SQUARE_SIZE,
    riichiGap: CENTER_DECORATION_SQUARE_GAP,
    lineWidth: DECORATION_LINE_WIDTH,
    outerSquareSize: OUTER_SQUARE_SIZE,
    segmentHeight: 0.04,
    surfaceClearance: 0.004,
  },
  riichiStickLayout: {
    laneOffset: 3.35,
    seatOffsets: {
      bottom: { inline: 0, radial: 0 },
      right: { inline: 0, radial: 0 },
      top: { inline: 0, radial: 0 },
      left: { inline: 0, radial: 0 },
    } satisfies Readonly<Record<Table3DSeat, RiichiStickSeatOffset>>,
  },
} as const;

export function getEffectiveCentralHudPosition() {
  const { position } = TABLE_PRESENTATION_TUNING.centralHud;
  return [
    position[0],
    position[1],
    position[2] + TABLE_PRESENTATION_TUNING.lowerTableContentOffsetZ,
  ] as const;
}

export function getCenterDecorationCenter() {
  const [hudX, , hudZ] = getEffectiveCentralHudPosition();
  const { offsetX, offsetZ } = TABLE_PRESENTATION_TUNING.centerDecoration;
  return [hudX + offsetX, hudZ + offsetZ] as const;
}

export function getHandTileScale(seat: Table3DSeat): number {
  if (seat === 'top') return TABLE_PRESENTATION_TUNING.tileScale.topHand;
  if (seat === 'left') return TABLE_PRESENTATION_TUNING.tileScale.leftHand;
  if (seat === 'right') return TABLE_PRESENTATION_TUNING.tileScale.rightHand;
  return 1;
}

export function getLocalHandScreenOffset() {
  const { inline, radial } = TABLE_PRESENTATION_TUNING.handSeatOffsets.bottom;
  return {
    x: inline * LOCAL_HAND_SCREEN_PIXELS_PER_TUNING_UNIT,
    y: radial * LOCAL_HAND_SCREEN_PIXELS_PER_TUNING_UNIT,
  } as const;
}

export function getAvatarFrameTuning(seat: Table3DSeat) {
  const { x, y } = TABLE_PRESENTATION_TUNING.avatarFrame.seatOffsets[seat];
  return { x, y, size: TABLE_PRESENTATION_TUNING.avatarFrame.size } as const;
}
