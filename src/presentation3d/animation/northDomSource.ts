import { Vector3, type Camera } from 'three';
import type { PresentationRect } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import type { TableAnimation3DPlan } from './tableAnimation3D';
/** Project the captured DOM tile anchor through the active camera, without moving that camera. */
export function resolveNorthDomSource(plan: TableAnimation3DPlan, camera: Camera, viewport: PresentationRect): TableAnimation3DPlan {
  if (plan.seat !== 'bottom' || plan.action.type !== 'north_committed' || !plan.action.sourceRect || !viewport.width || !viewport.height) return plan;
  const rect = plan.action.sourceRect;
  const origin = new Vector3(); camera.getWorldPosition(origin);
  const point = new Vector3(((rect.left + rect.width / 2 - viewport.left) / viewport.width) * 2 - 1,
    1 - ((rect.top + rect.height / 2 - viewport.top) / viewport.height) * 2, .5).unproject(camera);
  const direction = point.sub(origin).normalize();
  if (Math.abs(direction.y) < .0001) return plan;
  const position = origin.addScaledVector(direction, (plan.source[1] - origin.y) / direction.y);
  const source = position.toArray() as [number,number,number];
  return { ...plan, source, entry: [source[0], source[1], source[2] + 2.8] };
}
