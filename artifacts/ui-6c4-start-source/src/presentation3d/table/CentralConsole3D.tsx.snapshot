import { RoundedBox } from '@react-three/drei';

export const CENTRAL_CONSOLE_DIMENSIONS = {
  outerSize: 3.9,
  bezelSize: 3.58,
  panelSize: 3.38,
  baseHeight: 0.2,
  panelSurfaceY: 0.69,
} as const;

export function CentralConsole3D() {
  return (
    <group name="central-console-3d" userData={{ region: 'central-console' }}>
      <RoundedBox
        args={[
          CENTRAL_CONSOLE_DIMENSIONS.outerSize,
          CENTRAL_CONSOLE_DIMENSIONS.baseHeight,
          CENTRAL_CONSOLE_DIMENSIONS.outerSize,
        ]}
        radius={0.38}
        smoothness={5}
        position={[0, 0.555, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#4d422d" roughness={0.52} metalness={0.16} />
      </RoundedBox>
      <RoundedBox
        args={[CENTRAL_CONSOLE_DIMENSIONS.bezelSize, 0.075, CENTRAL_CONSOLE_DIMENSIONS.bezelSize]}
        radius={0.28}
        smoothness={4}
        position={[0, 0.645, 0]}
        receiveShadow
      >
        <meshStandardMaterial color="#b69b58" roughness={0.5} metalness={0.12} />
      </RoundedBox>
      <RoundedBox
        args={[CENTRAL_CONSOLE_DIMENSIONS.panelSize, 0.035, CENTRAL_CONSOLE_DIMENSIONS.panelSize]}
        radius={0.24}
        smoothness={4}
        position={[0, CENTRAL_CONSOLE_DIMENSIONS.panelSurfaceY - 0.0175, 0]}
        receiveShadow
      >
        <meshStandardMaterial color="#0b2721" roughness={0.72} metalness={0.035} />
      </RoundedBox>
    </group>
  );
}
