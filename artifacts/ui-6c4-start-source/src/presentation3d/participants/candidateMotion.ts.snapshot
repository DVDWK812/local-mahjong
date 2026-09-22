import type { HandAnimationPhase } from '../../presentation/handAnimation/HandAnimationController';
import type { TableAnimation3DPlan } from '../animation/tableAnimation3D';
import { getGroundedTileCenterY } from '../tile/tileGrounding';

/** One carry curve spans grip and travel. Phase labels only select the hand pose. */
export function candidateMotion(plan: TableAnimation3DPlan, phase: HandAnimationPhase, progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  const q = phase === 'approach' ? 0 : phase === 'grasp' ? p * 90 / 330
    : phase === 'travel' ? (90 + p * 240) / 330 : 1;
  const t = q * q * (3 - 2 * q);
  const mix = (a: number, b: number) => t === 1 ? b : a + (b - a) * t;
  const tileRotationX = mix(plan.sourceRotationX, plan.destinationRotationX);
  const tileRotationY = plan.sourceRotationY + Math.atan2(Math.sin(plan.destinationRotationY - plan.sourceRotationY), Math.cos(plan.destinationRotationY - plan.sourceRotationY)) * t;
  const tileScale = mix(plan.sourceScale, plan.destinationScale);
  const tilePosition = [mix(plan.source[0], plan.destination[0]),
    Math.max(getGroundedTileCenterY(tileRotationX, tileScale), mix(plan.source[1], plan.destination[1]) + Math.sin(Math.PI * t) * 0.35),
    mix(plan.source[2], plan.destination[2])] as const;
  return { tilePosition, tileRotationX, tileRotationY, tileScale };
}
