import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Object3D, type InstancedMesh } from 'three';
import {
  getCenterDecorationCenter,
  TABLE_PRESENTATION_TUNING,
} from './tablePresentationTuning';
import { TABLE_FELT_TOP_Y } from './tableSurfaceSpec';
import type { TableVisualTheme } from './tableVisualTheme';

const { centerDecoration } = TABLE_PRESENTATION_TUNING;
export const FELT_DECORATION_Y_EPSILON = centerDecoration.segmentHeight / 2
  + centerDecoration.surfaceClearance;
export const FELT_DECORATION_SURFACE_Y = TABLE_FELT_TOP_Y + FELT_DECORATION_Y_EPSILON;

export type FeltDecorationSegment = Readonly<{
  key: string;
  kind: 'frame' | 'guide';
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  rotationY: number;
}>;

export function buildFeltDecorationSegments(
  preset: TableVisualTheme['decoration']['preset'],
): readonly FeltDecorationSegment[] {
  if (preset === 'none') return [];
  const innerHalfSpan = centerDecoration.innerSquareSize / 2;
  const outerHalfSpan = centerDecoration.outerSquareSize / 2;
  const decorationCenter = getCenterDecorationCenter();
  const innerCorners = squareCorners(innerHalfSpan, decorationCenter);
  const outerCorners = squareCorners(outerHalfSpan, decorationCenter);
  return [
    ...squareSegments('inner', innerCorners),
    ...squareSegments('outer', outerCorners),
    segment('corner-nw', 'guide', innerCorners.nw, outerCorners.nw),
    segment('corner-ne', 'guide', innerCorners.ne, outerCorners.ne),
    segment('corner-se', 'guide', innerCorners.se, outerCorners.se),
    segment('corner-sw', 'guide', innerCorners.sw, outerCorners.sw),
  ];
}

export function FeltDecoration3D({
  theme,
}: Readonly<{ theme: TableVisualTheme }>) {
  const { decoration } = theme;
  const segments = useMemo(
    () => buildFeltDecorationSegments(decoration.preset),
    [decoration.preset],
  );
  if (segments.length === 0) return null;

  return (
    <group name="felt-decoration-3d" userData={{ region: 'felt-decoration', gameplay: false }}>
      <DecorationBatch
        kind="frame"
        segments={segments.filter((entry) => entry.kind === 'frame')}
        feltColor={theme.felt.color}
        color={decoration.frameColor}
        opacity={decoration.frameOpacity}
      />
      <DecorationBatch
        kind="guide"
        segments={segments.filter((entry) => entry.kind === 'guide')}
        feltColor={theme.felt.color}
        color={decoration.guideColor}
        opacity={decoration.guideOpacity}
      />
    </group>
  );
}

function DecorationBatch({
  kind,
  segments,
  feltColor,
  color,
  opacity,
}: Readonly<{
  kind: FeltDecorationSegment['kind'];
  segments: readonly FeltDecorationSegment[];
  feltColor: string;
  color: string;
  opacity: number;
}>) {
  const meshRef = useRef<InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  const blendedColor = useMemo(
    () => new Color(feltColor).lerp(new Color(color), opacity),
    [color, feltColor, opacity],
  );
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const transform = new Object3D();
    segments.forEach((entry, index) => {
      transform.position.set(...entry.position);
      transform.rotation.set(0, entry.rotationY, 0);
      transform.scale.set(...entry.scale);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [invalidate, segments]);
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, segments.length]}
      name={`felt-decoration-${kind}`}
      raycast={() => undefined}
      frustumCulled={false}
      renderOrder={-1}
      userData={{ region: 'felt-decoration', kind, gameplay: false }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color={blendedColor}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function segment(
  key: string,
  kind: FeltDecorationSegment['kind'],
  start: readonly [number, number],
  end: readonly [number, number],
  width = centerDecoration.lineWidth,
): FeltDecorationSegment {
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  return {
    key,
    kind,
    position: [(start[0] + end[0]) / 2, FELT_DECORATION_SURFACE_Y, (start[1] + end[1]) / 2],
    scale: [Math.hypot(deltaX, deltaZ), centerDecoration.segmentHeight, width],
    rotationY: -Math.atan2(deltaZ, deltaX),
  };
}

function squareSegments(
  keyPrefix: 'inner' | 'outer',
  corners: ReturnType<typeof squareCorners>,
): readonly FeltDecorationSegment[] {
  return [
    segment(`${keyPrefix}-north`, 'frame', corners.nw, corners.ne),
    segment(`${keyPrefix}-east`, 'frame', corners.ne, corners.se),
    segment(`${keyPrefix}-south`, 'frame', corners.se, corners.sw),
    segment(`${keyPrefix}-west`, 'frame', corners.sw, corners.nw),
  ];
}

function squareCorners(
  halfSpan: number,
  center: readonly [number, number],
) {
  const [centerX, centerZ] = center;
  return {
    nw: [centerX - halfSpan, centerZ - halfSpan],
    ne: [centerX + halfSpan, centerZ - halfSpan],
    se: [centerX + halfSpan, centerZ + halfSpan],
    sw: [centerX - halfSpan, centerZ + halfSpan],
  } as const;
}
