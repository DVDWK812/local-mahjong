import { Euler, Quaternion, Vector3 } from 'three';
import { motionRegion, type RegionTuning, type Point3 } from '../coordinates/regionTuning';
export type MotionTuning = Readonly<{ source?: RegionTuning; destination?: RegionTuning }>;
export type RotationQuaternion = readonly [number, number, number, number];
export function tuneAnimationMotion(position: Point3, yaw: number, scale: number, tuning: MotionTuning, phase: string, progress: number) {
  const t = phase === 'approach' || phase === 'grasp' ? 0 : phase === 'travel' ? progress * progress * (3 - 2 * progress) : 1;
  const region = motionRegion(tuning.source, tuning.destination, t);
  return {
    position: new Vector3(...position).applyMatrix4(region.matrix).toArray() as Point3,
    quaternion: region.rotation.multiply(new Quaternion().setFromEuler(new Euler(0, yaw, 0))).toArray() as RotationQuaternion,
    scale: scale * region.scale,
    matrix: region.matrix,
  };
}
