import { PerspectiveCamera, Vector3 } from 'three';
import type { PresentationRect } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import type { TableAnimation3DPlan } from './tableAnimation3D';
import { TABLE_CAMERA } from '../camera/FixedTableCamera';
import { MAHJONG_TILE_DIMENSIONS } from '../tile/tileGeometry';

export type LocalDiscardMotion = Readonly<{ source: PresentationRect; destination: PresentationRect }>;

/** DOM-to-river bridge only; uses the frozen camera and final river transform. */
export function captureLocalDiscardMotion(plan: TableAnimation3DPlan, source?: PresentationRect): LocalDiscardMotion | undefined {
  if (typeof document === 'undefined' || !plan.handSnapshot) return undefined;
  const canvas = document.querySelector('.table-3d-scene canvas');
  const row = document.querySelector('.local-hand-area--screen-space .local-hand-row');
  const tile = row?.querySelector('.tile');
  if (!canvas || !row || !tile) return undefined;
  const viewport = canvas.getBoundingClientRect();
  if (!viewport.width || !viewport.height) return undefined;
  const camera = new PerspectiveCamera(TABLE_CAMERA.fov, viewport.width / viewport.height, TABLE_CAMERA.near, TABLE_CAMERA.far);
  camera.position.set(...TABLE_CAMERA.position);
  camera.lookAt(...TABLE_CAMERA.target);
  camera.updateMatrixWorld();
  const project = (point: readonly number[]) => {
    const p = new Vector3(point[0], point[1], point[2]).project(camera);
    return { x: viewport.left + (p.x + 1) * viewport.width / 2, y: viewport.top + (1 - p.y) * viewport.height / 2 };
  };
  const halfWidth = MAHJONG_TILE_DIMENSIONS.width * plan.destinationScale / 2;
  const halfDepth = MAHJONG_TILE_DIMENSIONS.depth * plan.destinationScale / 2;
  const topY = plan.destination[1] + MAHJONG_TILE_DIMENSIONS.height * plan.destinationScale / 2;
  const corners = [-1, 1].flatMap((x) => [-1, 1].map((z) => project([
    plan.destination[0] + x * halfWidth * Math.cos(plan.destinationRotationY) + z * halfDepth * Math.sin(plan.destinationRotationY),
    topY,
    plan.destination[2] - x * halfWidth * Math.sin(plan.destinationRotationY) + z * halfDepth * Math.cos(plan.destinationRotationY),
  ])));
  const rect = tile.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const left = Math.min(...corners.map((point) => point.x));
  const top = Math.min(...corners.map((point) => point.y));
  const width = Math.max(...corners.map((point) => point.x)) - left;
  const height = Math.max(...corners.map((point) => point.y)) - top;
  const baseCount = plan.handSnapshot.visualHand.length - (plan.handSnapshot.drawnTile ? 1 : 0);
  const spacing = rect.width + parseFloat(getComputedStyle(row).columnGap || '0');
  const drawnGap = parseFloat(getComputedStyle(row).getPropertyValue('--drawn-tile-gap')) || 18;
  return { source: source ?? {
    left: rowRect.left + rowRect.width / 2 - (baseCount * spacing - (spacing - rect.width)) / 2
      + plan.handSnapshot.discardVisualSlot * spacing + (plan.handSnapshot.isTsumogiri ? drawnGap : 0),
    top: rect.top, width: rect.width, height: rect.height,
  }, destination: { left, top, width, height } };
}
