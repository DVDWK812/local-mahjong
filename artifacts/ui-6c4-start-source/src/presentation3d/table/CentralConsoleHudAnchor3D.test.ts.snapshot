import { describe, expect, it } from 'vitest';
import {
  CENTRAL_CONSOLE_HUD_ANCHOR,
  getCentralConsoleHudPosition,
  getCentralConsoleHudScale,
} from './CentralConsoleHudAnchor3D';
import { CENTRAL_CONSOLE_DIMENSIONS } from './CentralConsole3D';
import { getRiichiStickTransform } from '../riichi/RiichiStick3D';
import {
  getCenterDecorationCenter,
  getEffectiveCentralHudPosition,
  TABLE_PRESENTATION_TUNING,
} from './tablePresentationTuning';

describe('3D central console HUD anchor', () => {
  it('keeps the authoritative HUD readable at 720p without oversizing it at 1080p', () => {
    expect(getCentralConsoleHudScale(720)).toBe(0.96);
    expect(getCentralConsoleHudScale(800)).toBe(0.96);
    expect(getCentralConsoleHudScale(1080)).toBe(0.72);
  });

  it('places the DOM authority directly on the recessed physical panel', () => {
    expect(CENTRAL_CONSOLE_HUD_ANCHOR.position[1] - CENTRAL_CONSOLE_DIMENSIONS.panelSurfaceY)
      .toBeCloseTo(0.008);
    expect(CENTRAL_CONSOLE_HUD_ANCHOR.rotation).toEqual([-Math.PI / 2, 0, 0]);
  });

  it('adds the shared and HUD-only offsets without changing the HUD base anchor', () => {
    const tuning = TABLE_PRESENTATION_TUNING as unknown as {
      lowerTableContentOffsetZ: number;
    };
    const previousOffset = tuning.lowerTableContentOffsetZ;
    const basePosition = [...CENTRAL_CONSOLE_HUD_ANCHOR.position];
    try {
      tuning.lowerTableContentOffsetZ = 2;
      expect(getCentralConsoleHudPosition()).toEqual([
        basePosition[0] + TABLE_PRESENTATION_TUNING.centralHud.hudOnlyOffsetX,
        basePosition[1],
        basePosition[2] + 2 + TABLE_PRESENTATION_TUNING.centralHud.hudOnlyOffsetZ,
      ]);
      expect(CENTRAL_CONSOLE_HUD_ANCHOR.position).toEqual(basePosition);
    } finally {
      tuning.lowerTableContentOffsetZ = previousOffset;
    }
  });

  it('applies HUD-only offsets after the shared center without moving decoration or sticks', () => {
    const centralHud = TABLE_PRESENTATION_TUNING.centralHud as unknown as {
      hudOnlyOffsetX: number;
      hudOnlyOffsetZ: number;
    };
    const previousX = centralHud.hudOnlyOffsetX;
    const previousZ = centralHud.hudOnlyOffsetZ;
    const sharedCenter = getEffectiveCentralHudPosition();
    const decorationCenter = getCenterDecorationCenter();
    const stickTransforms = (['bottom', 'right', 'top', 'left'] as const)
      .map((seat) => getRiichiStickTransform(seat));
    try {
      centralHud.hudOnlyOffsetX = 1.25;
      centralHud.hudOnlyOffsetZ = -0.75;

      expect(getCentralConsoleHudPosition()).toEqual([
        sharedCenter[0] + 1.25,
        sharedCenter[1],
        sharedCenter[2] - 0.75,
      ]);
      expect(getEffectiveCentralHudPosition()).toEqual(sharedCenter);
      expect(getCenterDecorationCenter()).toEqual(decorationCenter);
      expect((['bottom', 'right', 'top', 'left'] as const)
        .map((seat) => getRiichiStickTransform(seat))).toEqual(stickTransforms);
    } finally {
      centralHud.hudOnlyOffsetX = previousX;
      centralHud.hudOnlyOffsetZ = previousZ;
    }
  });
});
