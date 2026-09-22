import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import {
  BoxGeometry,
  ClampToEdgeWrapping,
  CylinderGeometry,
  LinearFilter,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import type { WorldPoint3D } from '../animation/DiscardSource3D';
import {
  DEFAULT_RIICHI_STICK_3D_APPEARANCE,
  type RiichiStick3DAppearance,
} from './riichiStickAppearance';
import { getRiichiStickTransform as resolveRiichiStickTransform } from './riichiStickLayout';

import { RIICHI_STICK_3D_LAYOUT, RIICHI_STICK_FACE_SIZE } from './riichiStickGeometry';
export { RIICHI_STICK_3D_LAYOUT } from './riichiStickGeometry';

const bodyGeometry = new BoxGeometry(
  RIICHI_STICK_3D_LAYOUT.length,
  RIICHI_STICK_3D_LAYOUT.height,
  RIICHI_STICK_3D_LAYOUT.width,
);
const faceGeometry = new PlaneGeometry(
  RIICHI_STICK_FACE_SIZE.length,
  RIICHI_STICK_FACE_SIZE.width,
);
const dotGeometry = new CylinderGeometry(0.075, 0.075, 0.012, 20);

export function getRiichiStickTransform(seat: Table3DSeat) {
  return resolveRiichiStickTransform(
    seat,
    RIICHI_STICK_3D_LAYOUT.height,
    RIICHI_STICK_3D_LAYOUT.epsilon,
  );
}

export function RiichiStick3D({
  seat,
  position,
  rotationY,
  objectName = `riichi-stick-${seat}`,
  raycastDisabled = false,
  appearance = DEFAULT_RIICHI_STICK_3D_APPEARANCE,
}: Readonly<{
  seat: Table3DSeat;
  position?: WorldPoint3D;
  rotationY?: number;
  objectName?: string;
  raycastDisabled?: boolean;
  appearance?: RiichiStick3DAppearance;
}>) {
  const transform = getRiichiStickTransform(seat);
  const finalPosition = position ?? transform.position;
  return (
    <group
      name={objectName}
      position={finalPosition as [number, number, number]}
      rotation={[0, rotationY ?? transform.rotationY, 0]}
      userData={{ region: 'riichi-stick', seat }}
      dispose={null}
    >
      <mesh
        geometry={bodyGeometry}
        raycast={raycastDisabled ? () => undefined : undefined}
        castShadow
        receiveShadow
        frustumCulled={false}
        renderOrder={10}
      >
        <meshStandardMaterial
          color={appearance.bodyColor}
          emissive={appearance.bodyColor}
          emissiveIntensity={0.14}
          roughness={appearance.bodyRoughness}
          metalness={appearance.bodyMetalness}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh
        geometry={dotGeometry}
        position={[0, RIICHI_STICK_3D_LAYOUT.height / 2 + 0.003, 0]}
        raycast={raycastDisabled ? () => undefined : undefined}
        frustumCulled={false}
        renderOrder={11}
      >
        <meshBasicMaterial color="#d83232" depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <Suspense fallback={null}>
        <RiichiStickTextureFace3D
          textureSource={appearance.textureSource}
          textureOverride={appearance.texture}
          raycastDisabled={raycastDisabled}
        />
      </Suspense>
    </group>
  );
}

function RiichiStickTextureFace3D({
  textureSource,
  textureOverride,
  raycastDisabled,
}: Readonly<{
  textureSource: string;
  textureOverride?: import('three').Texture;
  raycastDisabled: boolean;
}>) {
  const loadedTexture = useTexture(textureSource);
  const texture = textureOverride ?? loadedTexture;
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    invalidate();
  }, [invalidate, texture]);

  return (
    <mesh
      geometry={faceGeometry}
      position={[0, RIICHI_STICK_3D_LAYOUT.height / 2 + 0.004, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={raycastDisabled ? () => undefined : undefined}
      frustumCulled={false}
      renderOrder={12}
    >
      <meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
