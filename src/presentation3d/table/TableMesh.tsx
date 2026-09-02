import { RoundedBox } from '@react-three/drei';
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

export function TableMesh({
  theme = DEFAULT_TABLE_VISUAL_THEME,
}: Readonly<{ theme?: TableVisualTheme }>) {
  return (
    <group>
      <RoundedBox args={[TABLE_WORLD_DIMENSIONS.width, TABLE_WORLD_DIMENSIONS.edgeHeight, TABLE_WORLD_DIMENSIONS.depth]} radius={0.58} smoothness={5} position={[0, -0.28, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...theme.edge} />
      </RoundedBox>

      <RoundedBox args={[
        TABLE_WORLD_DIMENSIONS.width - TABLE_SURFACE_INSET,
        TABLE_SURFACE_SPEC.feltThickness,
        TABLE_WORLD_DIMENSIONS.depth - TABLE_SURFACE_INSET,
      ]} radius={0.48} smoothness={5} position={[0, TABLE_SURFACE_SPEC.feltCenterY, 0]} renderOrder={-2} receiveShadow>
        <meshStandardMaterial {...theme.felt} />
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
