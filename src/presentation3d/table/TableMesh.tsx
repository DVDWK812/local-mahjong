import { RoundedBox } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Mesh, MeshStandardMaterial, Texture } from 'three';
import { applyFeltSurfaceUvs } from './feltSurfaceUv';
import { FeltDecoration3D } from './FeltDecoration3D';
import { TABLE_SURFACE_SPEC } from './tableSurfaceSpec';
import { DEFAULT_TABLE_VISUAL_THEME, type TableVisualTheme } from './tableVisualTheme';

export const TABLE_WORLD_DIMENSIONS = {
  width: 38,
  depth: 35,
  edgeHeight: 0.15,
} as const;

const TABLE_SURFACE_INSET = 0.75;
const TABLE_EDGE_ACCENT_INSET = 1.45;

/** Physical felt geometry and custom main-view mapping share this one authority. */
export const TABLE_FELT_DIMENSIONS = {
  width: TABLE_WORLD_DIMENSIONS.width - TABLE_SURFACE_INSET,
  depth: TABLE_WORLD_DIMENSIONS.depth - TABLE_SURFACE_INSET,
} as const;

/**
 * The classic felt color is the builtin appearance, not a tint for user
 * supplied artwork. Keeping this decision beside the felt mesh prevents a
 * custom image from being multiplied into the classic green baseline.
 */
export function getFeltMaterialAppearance(
  theme: TableVisualTheme,
  feltTexture?: Texture,
) {
  return {
    ...theme.felt,
    color: feltTexture ? '#ffffff' : theme.felt.color,
    map: feltTexture ?? null,
  };
}

function FeltSurfaceMaterial({
  theme,
  feltTexture,
}: Readonly<{
  theme: TableVisualTheme;
  feltTexture?: Texture;
}>) {
  const materialRef = useRef<MeshStandardMaterial>(null);
  const invalidate = useThree((state) => state.invalidate);
  const appearance = getFeltMaterialAppearance(theme, feltTexture);

  useEffect(() => {
    // Switching between a mapped and unmapped standard material changes a
    // shader define. Mark it explicitly so demand rendering cannot retain the
    // classic-green program after a local image finishes decoding.
    if (materialRef.current) materialRef.current.needsUpdate = true;
    invalidate();
  }, [feltTexture, invalidate]);

  return <meshStandardMaterial ref={materialRef} {...appearance} />;
}

export function TableMesh({
  theme = DEFAULT_TABLE_VISUAL_THEME,
  feltTexture,
}: Readonly<{ theme?: TableVisualTheme; feltTexture?: Texture }>) {
  const feltRef = useRef<Mesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    // Runs after RoundedBox has centered its geometry, before the first draw.
    // UVs belong to the surface, so replacements/reset need no new geometry.
    if (feltRef.current) applyFeltSurfaceUvs(feltRef.current.geometry, TABLE_FELT_DIMENSIONS);
    invalidate();
  }, [invalidate]);

  return (
    <group>
      <RoundedBox args={[TABLE_WORLD_DIMENSIONS.width, TABLE_WORLD_DIMENSIONS.edgeHeight, TABLE_WORLD_DIMENSIONS.depth]} radius={0.58} smoothness={5} position={[0, -0.28, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...theme.edge} />
      </RoundedBox>

      <RoundedBox ref={feltRef} args={[
        TABLE_FELT_DIMENSIONS.width,
        TABLE_SURFACE_SPEC.feltThickness,
        TABLE_FELT_DIMENSIONS.depth,
      ]} radius={0.48} smoothness={5} position={[0, TABLE_SURFACE_SPEC.feltCenterY, 0]} renderOrder={-2} receiveShadow>
        <FeltSurfaceMaterial theme={theme} feltTexture={feltTexture} />
      </RoundedBox>

      <FeltDecoration3D theme={theme} />

      <mesh position={[0, 0.55, 9.45]} receiveShadow>
        <boxGeometry args={[9.4, 0.035, 0.035]} />
        <meshStandardMaterial {...theme.edgeAccent} />
      </mesh>
      <mesh position={[0, 0.55, -9.45]} receiveShadow>
        <boxGeometry args={[9.4, 0.035, 0.035]} />
        <meshStandardMaterial {...theme.edgeAccent} />
      </mesh>
      <mesh position={[
        TABLE_WORLD_DIMENSIONS.width / 2 - TABLE_EDGE_ACCENT_INSET,
        0.55,
        0,
      ]} receiveShadow>
        <boxGeometry args={[0.035, 0.035, 7.9]} />
        <meshStandardMaterial {...theme.edgeAccent} />
      </mesh>
      <mesh position={[
        -(TABLE_WORLD_DIMENSIONS.width / 2 - TABLE_EDGE_ACCENT_INSET),
        0.55,
        0,
      ]} receiveShadow>
        <boxGeometry args={[0.035, 0.035, 7.9]} />
        <meshStandardMaterial {...theme.edgeAccent} />
      </mesh>
    </group>
  );
}
