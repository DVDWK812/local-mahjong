import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import type { PerspectiveCamera } from 'three';
// 调整视角
export const TABLE_CAMERA = {
  position: [0, 35, 27] as const,
  target: [0, 0.72, 4] as const,
  fov: 32,
  near: 0.1,
  far: 60,
} as const;

export function FixedTableCamera() {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const { width, height } = useThree((state) => state.size);

  useLayoutEffect(() => {
    camera.position.set(...TABLE_CAMERA.position);
    camera.fov = TABLE_CAMERA.fov;
    camera.near = TABLE_CAMERA.near;
    camera.far = TABLE_CAMERA.far;
    camera.lookAt(...TABLE_CAMERA.target);
    camera.updateProjectionMatrix();
  }, [camera, height, width]);

  return null;
}
