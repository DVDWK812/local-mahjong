import { describe, expect, it } from 'vitest';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import { getHandTileTransform } from '../coordinates/sceneTransforms';
import {
  getAvatarFrameTuning,
  getLocalHandScreenOffset,
  TABLE_PRESENTATION_TUNING,
} from './tablePresentationTuning';

const SEATS: readonly Table3DSeat[] = ['bottom', 'right', 'top', 'left'];

describe('UI-5F.3 hand and avatar manual tuning', () => {
  it('freezes every independent hand-seat offset', () => {
    expect(TABLE_PRESENTATION_TUNING.handSeatOffsets).toEqual({
      bottom: { inline: 0, radial: 0 },
      right: { inline: 0, radial: 0 },
      top: { inline: 0, radial: -2 },
      left: { inline: 0, radial: 0 },
    });
    expect(getLocalHandScreenOffset()).toEqual({ x: 0, y: 0 });
  });

  it('converts each seat-local hand offset independently in the documented direction', () => {
    const offsets = TABLE_PRESENTATION_TUNING.handSeatOffsets as unknown as Record<
      Table3DSeat,
      { inline: number; radial: number }
    >;
    const expectedDelta: Record<Table3DSeat, readonly [number, number]> = {
      bottom: [2, 3],
      right: [3, -2],
      top: [-2, -3],
      left: [-3, 2],
    };
    const baseline = Object.fromEntries(SEATS.map((seat) => [
      seat,
      getHandTileTransform(seat, 0, 1, false).position,
    ])) as Record<Table3DSeat, readonly [number, number, number]>;
    const previous = Object.fromEntries(SEATS.map((seat) => [
      seat,
      { ...offsets[seat] },
    ])) as Record<Table3DSeat, { inline: number; radial: number }>;

    try {
      SEATS.forEach((seat) => {
        offsets[seat].inline = previous[seat].inline + 2;
        offsets[seat].radial = previous[seat].radial + 3;
        SEATS.forEach((candidate) => {
          const position = getHandTileTransform(candidate, 0, 1, false).position;
          const delta = [
            position[0] - baseline[candidate][0],
            position[2] - baseline[candidate][2],
          ] as const;
          expect(delta[0]).toBeCloseTo(candidate === seat ? expectedDelta[seat][0] : 0);
          expect(delta[1]).toBeCloseTo(candidate === seat ? expectedDelta[seat][1] : 0);
        });
        offsets[seat].inline = previous[seat].inline;
        offsets[seat].radial = previous[seat].radial;
      });
    } finally {
      SEATS.forEach((seat) => {
        offsets[seat].inline = previous[seat].inline;
        offsets[seat].radial = previous[seat].radial;
      });
    }
  });

  it('keeps avatar seat positions independent from the one shared size multiplier', () => {
    const avatarFrame = TABLE_PRESENTATION_TUNING.avatarFrame as unknown as {
      size: number;
      seatOffsets: Record<Table3DSeat, { x: number; y: number }>;
    };
    const frozen = {
      size: 1.1,
      seatOffsets: {
        bottom: { x: 500, y: -100 },
        right: { x: -30, y: 0 },
        top: { x: 350, y: 0 },
        left: { x: 30, y: 0 },
      },
    } as const;
    expect(avatarFrame).toEqual(frozen);
    SEATS.forEach((seat) => expect(getAvatarFrameTuning(seat)).toEqual({
      ...frozen.seatOffsets[seat],
      size: frozen.size,
    }));

    try {
      avatarFrame.seatOffsets.bottom.x = frozen.seatOffsets.bottom.x + 12;
      avatarFrame.seatOffsets.bottom.y = frozen.seatOffsets.bottom.y - 8;
      expect(getAvatarFrameTuning('bottom')).toEqual({ x: 512, y: -108, size: 1.1 });
      SEATS.slice(1).forEach((seat) => expect(getAvatarFrameTuning(seat)).toEqual({
        ...frozen.seatOffsets[seat],
        size: frozen.size,
      }));

      avatarFrame.size = 1.2;
      SEATS.forEach((seat) => expect(getAvatarFrameTuning(seat).size).toBe(1.2));
      expect(getAvatarFrameTuning('bottom')).toMatchObject({ x: 512, y: -108 });
    } finally {
      avatarFrame.size = frozen.size;
      avatarFrame.seatOffsets.bottom.x = frozen.seatOffsets.bottom.x;
      avatarFrame.seatOffsets.bottom.y = frozen.seatOffsets.bottom.y;
    }
  });
});
