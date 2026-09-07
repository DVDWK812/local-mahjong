import type { HandPresentationFrame } from '../../presentation/handAnimation/HandPresentationSnapshot';
import type { TableAnimation3DPlan } from './tableAnimation3D';
import { resolveTableAnimation3DMotion } from './tableAnimation3D';

const ease = (p: number) => p * p * (3 - 2 * p);
export function discardLiftProgress(frame: HandPresentationFrame): number {
  return frame.phase === 'lift' ? Math.max(0, (frame.progress - 0.4) / 0.6) : frame.progress;
}

/** Reach fits inside lift; retract uses the existing gap/hold, without extending cadence. */
export function discardHandLifecycle(frame: HandPresentationFrame) {
  const { phase, progress: p, snapshot } = frame;
  const reach = phase === 'lift' ? ease(Math.min(1, p / 0.4)) : 1;
  const retract = phase === 'gap-hold' ? ease(p)
    : phase === 'complete' && snapshot.isTsumogiri ? ease(p)
    : phase === 'insert' || phase === 'reorder' || phase === 'complete' ? 1 : 0;
  return { reach, retract, visible: retract < 1 };
}

export function resolveSnapshotDiscardMotion(plan: TableAnimation3DPlan, frame: HandPresentationFrame) {
  const phase = frame.phase === 'lift' ? 'grasp' : frame.phase === 'carry' ? 'travel'
    : frame.phase === 'river-settle' ? 'release' : 'retreat';
  const tile = resolveTableAnimation3DMotion(plan, phase, discardLiftProgress(frame));
  const hand = discardHandLifecycle(frame);
  const contact = phase === 'retreat' ? plan.destination : tile.tilePosition;
  const blend = 1 - hand.reach + hand.retract;
  const handPosition = contact.map((value, axis) => value + (plan.entry[axis] - value) * blend) as [number, number, number];
  return { ...tile, handPosition, handVisible: hand.visible };
}
