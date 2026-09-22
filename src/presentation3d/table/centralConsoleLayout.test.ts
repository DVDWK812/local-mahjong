import { describe, expect, it } from 'vitest';
import { getCentralConsoleLayout } from './centralConsoleLayout';
import { getRiichiStickTransform } from '../riichi/RiichiStick3D';
import { RIICHI_STICK_3D_LAYOUT as stick } from '../riichi/riichiStickGeometry';
import { getCenterDecorationCenter, TABLE_PRESENTATION_TUNING } from './tablePresentationTuning';
import { getCentralConsoleHudScale } from './CentralConsoleHudAnchor3D';

describe('central console assembly', () => {
  it.each([720, 1080])('all four lanes fit inside the existing frame, outside the score at %ip', height => {
    const layout = getCentralConsoleLayout(height);
    expect(layout.outerFrame.center).toEqual(getCenterDecorationCenter());
    expect(layout.outerFrame.size).toBe(8.2);
    for (const [seat, lane] of Object.entries(layout.riichiLanes)) {
      const radialAxis = seat === 'bottom' || seat === 'top' ? 2 : 0;
      const inlineAxis = radialAxis === 2 ? 0 : 2;
      const centerRadial = layout.outerFrame.center[radialAxis === 2 ? 1 : 0];
      const centerInline = layout.outerFrame.center[inlineAxis === 2 ? 1 : 0];
      expect(Math.abs(lane.position[radialAxis] - centerRadial) + stick.width / 2).toBeLessThan(layout.outerFrame.size / 2);
      expect(Math.abs(lane.position[inlineAxis] - centerInline) + stick.length / 2).toBeLessThan(layout.outerFrame.size / 2);
      expect(Math.abs(lane.position[radialAxis] - layout.scoreHud.position[radialAxis]) - stick.width / 2)
        .toBeGreaterThan(layout.scoreHud.halfSize);
      expect(getRiichiStickTransform(seat as keyof typeof layout.riichiLanes)).toEqual(lane);
    }
  });
  it('keeps the HUD center, ordinary river and non-riichi preview scale unchanged', () => {
    expect(getCentralConsoleLayout().scoreHud.position).toEqual([-0.1, 0.698, 2.3]);
    expect(getCentralConsoleHudScale(720)).toBe(0.96);
    expect(getCentralConsoleHudScale(1080)).toBe(0.72);
    expect(TABLE_PRESENTATION_TUNING.riverSeatOffsets.bottom).toEqual({ inlineX: 0, radialZ: 2.8 });
  });
});
