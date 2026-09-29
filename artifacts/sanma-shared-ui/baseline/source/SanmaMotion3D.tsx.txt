import { useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { HandVisualController } from '../../hand/HandVisualController';
import { projectHandContact } from '../../hand/handProjection';
import { candidateSourceWorld } from './CandidateDiscard3D';
import { candidateMotion } from './candidateMotion';
import { participantHandTarget, participantRiverTarget } from './participantLayout';
import type { SanmaMotionFrame } from './useSanmaAnimation';
import type { TableAnimation3DPlan } from '../animation/tableAnimation3D';
import { Tile3D } from '../tile/Tile3D';

export function SanmaMotion3D({ frame }: { frame: SanmaMotionFrame }) {
  const { camera, gl, size, invalidate } = useThree();
  const hand = useRef<HandVisualController | null>(null);
  const plan = useMemo((): TableAnimation3DPlan | null => {
    const a = frame.action;
    if (a.type !== 'tile_discarded' && a.type !== 'tile_drawn') return null;
    if (a.type === 'tile_drawn' && frame.local) return null; // Existing local DOM draw consumer owns this visual.
    const viewport = gl.domElement.getBoundingClientRect();
    const target = participantHandTarget('sanma', frame.seat, Math.max(0, frame.count - 1), frame.count);
    const destination = a.type === 'tile_discarded' ? participantRiverTarget('sanma', frame.seat, Math.max(0, frame.river.findIndex(t => t.instanceId === frame.tile?.instanceId)), frame.river, size) : target;
    const dom = frame.rect ? candidateSourceWorld(frame.rect, camera, viewport) : null;
    const source = a.type === 'tile_drawn' ? [target.position[0] * .85, target.position[1] + 1, target.position[2] * .85] as [number, number, number] : dom?.position ?? target.position;
    return { action: a, seat: frame.seat, source, entry: source, destination: destination.position,
      sourceRotationX: dom?.rotationX ?? target.rotationX ?? 0, sourceRotationY: target.rotationY ?? 0, destinationRotationX: destination.rotationX ?? 0, destinationRotationY: destination.rotationY ?? 0,
      sourceScale: dom?.scale ?? 1, destinationScale: 1, tile: frame.tile ?? undefined, faceState: a.type === 'tile_discarded' ? 'face-up' : 'face-down', showPrimaryTile: true, localDomDraw: false };
  }, [frame.action, frame.rect, frame.seat, frame.count, frame.river, camera, gl, size]);
  useLayoutEffect(() => {
    if (!plan) return;
    const visual = new HandVisualController(frame.action.eventId, frame.seat, frame.pack, frame.playerId); hand.current = visual;
    return () => { visual.dispose(); hand.current = null; };
  }, [frame.action.eventId, frame.pack, frame.seat, !!plan]);
  const motion = plan && candidateMotion(plan, frame.phase, frame.progress);
  useLayoutEffect(() => { if (motion) hand.current?.update(projectHandContact(motion.tilePosition, camera, gl.domElement.getBoundingClientRect()), frame.phase, frame.progress); invalidate(); }, [frame, motion, camera, gl, invalidate]);
  if (!motion || !plan) return null;
  return <group visible={frame.phase !== 'retreat'} position={motion.tilePosition} rotation={[0, motion.tileRotationY, 0]} scale={motion.tileScale} name="sanma-motion-proxy">
    <group rotation={[motion.tileRotationX, 0, 0]}><Tile3D tile={frame.tile ?? undefined} ownerPlayerId={frame.playerId} faceState={plan.faceState} showRearFace raycastDisabled /></group>
  </group>;
}
