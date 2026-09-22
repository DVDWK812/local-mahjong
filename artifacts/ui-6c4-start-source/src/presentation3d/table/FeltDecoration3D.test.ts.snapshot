import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getRiverTileTransform } from '../coordinates/sceneTransforms';
import { RIICHI_STICK_3D_LAYOUT } from '../riichi/RiichiStick3D';
import {
  buildFeltDecorationSegments,
  FELT_DECORATION_SURFACE_Y,
  FELT_DECORATION_Y_EPSILON,
} from './FeltDecoration3D';
import { TABLE_FELT_TOP_Y } from './tableSurfaceSpec';
import {
  getCenterDecorationCenter,
  TABLE_PRESENTATION_TUNING,
} from './tablePresentationTuning';
import { DEFAULT_TABLE_VISUAL_THEME } from './tableVisualTheme';

function sourcePath(relativePath: string): string {
  return decodeURIComponent(new URL(relativePath, import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
}

describe('UI-5F.1 felt decoration and table theme boundary', () => {
  it('reproduces the existing table material baseline through the default theme', () => {
    expect(DEFAULT_TABLE_VISUAL_THEME.felt).toEqual({
      color: '#175f49', roughness: 0.88, metalness: 0.01,
    });
    expect(DEFAULT_TABLE_VISUAL_THEME.edge).toEqual({
      color: '#281d19', roughness: 0.48, metalness: 0.08,
    });
    expect(DEFAULT_TABLE_VISUAL_THEME.edgeAccent).toEqual({
      color: '#d6c48a', roughness: 0.5,
    });
  });

  it('keeps decoration above the felt and independent from gameplay transforms', () => {
    const riverBefore = getRiverTileTransform('bottom', 6);
    const segments = buildFeltDecorationSegments(DEFAULT_TABLE_VISUAL_THEME.decoration.preset);
    const riverAfter = getRiverTileTransform('bottom', 6);

    expect(segments).toHaveLength(12);
    expect(segments.filter((entry) => entry.kind === 'frame')).toHaveLength(8);
    expect(segments.filter((entry) => entry.kind === 'guide')).toHaveLength(4);
    expect(FELT_DECORATION_SURFACE_Y).toBe(TABLE_FELT_TOP_Y + FELT_DECORATION_Y_EPSILON);
    expect(segments.every((entry) => entry.position[1] === FELT_DECORATION_SURFACE_Y)).toBe(true);
    expect(riverAfter).toEqual(riverBefore);
    expect(buildFeltDecorationSegments('none')).toEqual([]);
  });

  it('centers both squares on the effective HUD plus the decoration offset', () => {
    const { innerSquareSize, outerSquareSize, riichiGap } = TABLE_PRESENTATION_TUNING.centerDecoration;
    const [centerX, centerZ] = getCenterDecorationCenter();
    const segments = buildFeltDecorationSegments('classic-lines');
    const byKey = new Map(segments.map((entry) => [entry.key, entry]));

    expect(outerSquareSize).toBe(innerSquareSize + riichiGap * 2);
    expect(RIICHI_STICK_3D_LAYOUT.width).toBeLessThan(riichiGap);
    expect(byKey.get('inner-north')?.position[0]).toBe(centerX);
    expect(byKey.get('inner-north')?.position[2]).toBe(centerZ - innerSquareSize / 2);
    expect(byKey.get('inner-east')?.position[0]).toBe(centerX + innerSquareSize / 2);
    expect(byKey.get('inner-east')?.position[2]).toBe(centerZ);
    expect(byKey.get('outer-north')?.position[0]).toBe(centerX);
    expect(byKey.get('outer-north')?.position[2]).toBe(centerZ - outerSquareSize / 2);
    expect(segments.map((entry) => entry.key)).toEqual([
      'inner-north', 'inner-east', 'inner-south', 'inner-west',
      'outer-north', 'outer-east', 'outer-south', 'outer-west',
      'corner-nw', 'corner-ne', 'corner-se', 'corner-sw',
    ]);
  });

  it('moves the complete decoration with the shared lower-content offset', () => {
    const tuning = TABLE_PRESENTATION_TUNING as unknown as {
      lowerTableContentOffsetZ: number;
    };
    const previousOffset = tuning.lowerTableContentOffsetZ;
    try {
      tuning.lowerTableContentOffsetZ = 0;
      const baseline = buildFeltDecorationSegments('classic-lines');
      tuning.lowerTableContentOffsetZ = 2;
      const shifted = buildFeltDecorationSegments('classic-lines');

      shifted.forEach((entry, index) => {
        expect(entry.position[0]).toBe(baseline[index].position[0]);
        expect(entry.position[2] - baseline[index].position[2]).toBe(2);
      });
    } finally {
      tuning.lowerTableContentOffsetZ = previousOffset;
    }
  });

  it('freezes the independent per-seat River offsets without changing packing', () => {
    expect(TABLE_PRESENTATION_TUNING.riverSeatOffsets).toEqual({
      bottom: { inlineX: 0, radialZ: 2.8 },
      right: { inlineX: -0.5, radialZ: 0 },
      top: { inlineX: 0, radialZ: 1.8 },
      left: { inlineX: 0.5, radialZ: 0 },
    });
  });

  it('does not participate in raycasting or start a render loop', () => {
    const source = readFileSync(sourcePath('./FeltDecoration3D.tsx'), 'utf8');
    expect(source).toContain('raycast={() => undefined}');
    expect(source).not.toContain('useFrame');
    expect(source).not.toContain('requestAnimationFrame');
  });

  it('keeps the visual theme renderer-only and free of semantic fields', () => {
    const source = readFileSync(sourcePath('./tableVisualTheme.ts'), 'utf8');
    const tuningSource = readFileSync(sourcePath('./tablePresentationTuning.ts'), 'utf8');
    expect(source).not.toContain("from '../../game");
    expect(tuningSource).not.toContain("from '../../game");
    expect(source).not.toContain('GameState');
    expect(tuningSource).not.toContain('GameState');
    expect(source).not.toContain('tileId');
    expect(Object.keys(DEFAULT_TABLE_VISUAL_THEME)).toEqual([
      'id', 'felt', 'edge', 'edgeAccent', 'decoration',
    ]);
  });
});
