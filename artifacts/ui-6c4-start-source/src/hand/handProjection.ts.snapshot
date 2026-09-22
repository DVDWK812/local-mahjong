import { Vector3, type Camera } from 'three';
import type { PresentationRect } from '../presentation/handAnimation/DiscardSourceSnapshot';
import type { WorldPoint3D } from '../presentation3d/animation/DiscardSource3D';

/** Use the active R3F camera and actual Canvas viewport, including DOM offsets. */
export function projectHandContact(position: WorldPoint3D, camera: Camera, viewport: PresentationRect) {
  const point = new Vector3(...position).project(camera);
  return { x: viewport.left + (point.x + 1) * viewport.width / 2,
    y: viewport.top + (1 - point.y) * viewport.height / 2, width: 48 };
}
