import { describe, expect, it } from 'vitest';
import { getRiichiStickTransform, RIICHI_STICK_3D_LAYOUT } from './RiichiStick3D';
import { DEFAULT_RIICHI_STICK_3D_APPEARANCE } from './riichiStickAppearance';
import {
  getCenterDecorationCenter,
  TABLE_PRESENTATION_TUNING,
} from '../table/tablePresentationTuning';
import { TABLE_FELT_TOP_Y } from '../table/tableSurfaceSpec';

describe('UI-5E.2 RiichiStick3D', () => {
  it('maps the shared center lane deterministically to all four seats', () => {
    const bottom = getRiichiStickTransform('bottom');
    const right = getRiichiStickTransform('right');
    const top = getRiichiStickTransform('top');
    const left = getRiichiStickTransform('left');
    const [centerX, centerZ] = getCenterDecorationCenter();
    const laneOffset = TABLE_PRESENTATION_TUNING.riichiStickLayout.laneOffset;

    expect(bottom.position).toEqual([centerX, bottom.position[1], centerZ + laneOffset]);
    expect(right.position[0]).toBeCloseTo(centerX + laneOffset);
    expect(right.position[2]).toBeCloseTo(centerZ);
    expect(top.position[2]).toBeCloseTo(centerZ - laneOffset);
    expect(left.position[0]).toBeCloseTo(centerX - laneOffset);
    expect([bottom.rotationY, right.rotationY, top.rotationY, left.rotationY]).toEqual([
      0, Math.PI / 2, Math.PI, -Math.PI / 2,
    ]);
  });

  it('grounds the physical stick on the frozen felt surface authority', () => {
    const transform = getRiichiStickTransform('bottom');
    const lowestPoint = transform.position[1] - RIICHI_STICK_3D_LAYOUT.height / 2;
    expect(lowestPoint).toBeCloseTo(
      TABLE_FELT_TOP_Y + RIICHI_STICK_3D_LAYOUT.epsilon,
    );
  });

  it('keeps the authoritative stick inside the inner frame and exposes a default texture', () => {
    expect(TABLE_PRESENTATION_TUNING.riichiStickLayout.laneOffset).toBeLessThan(
      TABLE_PRESENTATION_TUNING.centerDecoration.innerSquareSize / 2,
    );
    expect(DEFAULT_RIICHI_STICK_3D_APPEARANCE.textureSource)
      .toBe('/assets/riichi-stick-default.svg');
  });

  it('moves static and animation authority with the effective center', () => {
    const tuning = TABLE_PRESENTATION_TUNING as unknown as {
      lowerTableContentOffsetZ: number;
    };
    const previousOffset = tuning.lowerTableContentOffsetZ;
    try {
      tuning.lowerTableContentOffsetZ = 0;
      const baseline = (['bottom', 'right', 'top', 'left'] as const)
        .map((seat) => getRiichiStickTransform(seat));
      tuning.lowerTableContentOffsetZ = 2;
      const shifted = (['bottom', 'right', 'top', 'left'] as const)
        .map((seat) => getRiichiStickTransform(seat));

      shifted.forEach((transform, index) => {
        expect(transform.position[0]).toBe(baseline[index].position[0]);
        expect(transform.position[2] - baseline[index].position[2]).toBeCloseTo(2);
      });
    } finally {
      tuning.lowerTableContentOffsetZ = previousOffset;
    }
  });
});
