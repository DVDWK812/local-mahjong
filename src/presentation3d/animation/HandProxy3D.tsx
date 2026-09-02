import { RoundedBox } from '@react-three/drei';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import { getSeatRotation } from '../coordinates/seatTransforms';
import type { WorldPoint3D } from './DiscardSource3D';

export function HandProxy3D({ seat, position }: Readonly<{
  seat: Table3DSeat;
  position: WorldPoint3D;
}>) {
  return (
    <group
      name={`hand-action-proxy-${seat}`}
      position={[position[0], position[1] + 0.74, position[2]]}
      rotation={[0, getSeatRotation(seat), 0]}
      userData={{ region: 'transient-hand-proxy', seat }}
    >
      <RoundedBox args={[0.92, 0.24, 1.08]} radius={0.16} smoothness={3} raycast={() => undefined} castShadow>
        <meshStandardMaterial color="#d9a06f" roughness={0.78} metalness={0} />
      </RoundedBox>
      <RoundedBox args={[1.02, 0.32, 1.18]} radius={0.12} smoothness={3} position={[0, -0.06, 0.92]} raycast={() => undefined} castShadow>
        <meshStandardMaterial color="#183f46" roughness={0.86} metalness={0} />
      </RoundedBox>
    </group>
  );
}
