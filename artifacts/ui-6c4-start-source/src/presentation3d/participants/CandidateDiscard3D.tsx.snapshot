import { candidateMotion } from './candidateMotion';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { candidateTraceEnabled, traceCandidate } from './candidateTrace';
import { useThree } from '@react-three/fiber';
import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import { HandVisualController } from '../../hand/HandVisualController';
import { projectHandContact } from '../../hand/handProjection';
import type { PresentationRect } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import { Tile3D } from '../tile/Tile3D';
import { MAHJONG_TILE_DIMENSIONS } from '../tile/tileGeometry';
import { TABLE_FELT_TOP_Y } from '../table/tableSurfaceSpec';

import { concealedCandidateSource, concealedCandidateTargets, participantRiverTarget } from './participantLayout';
import { concealedRemovalIndex } from './candidateRows';
import { type TableAnimation3DPlan } from '../animation/tableAnimation3D';
import { candidateRiverOwns, type CandidateFrame } from './candidateAnimation';

export function candidateSourceWorld(rect: PresentationRect, camera: Camera, viewport: PresentationRect) {
  const ray = new Raycaster();
  const plane = new Plane(new Vector3(0, 1, 0), -(TABLE_FELT_TOP_Y + 3));
  const point = (x: number) => {
    ray.setFromCamera(new Vector2((x - viewport.left) / viewport.width * 2 - 1,
      1 - (rect.top + rect.height / 2 - viewport.top) / viewport.height * 2), camera);
    return ray.ray.intersectPlane(plane, new Vector3());
  };
  const center = point(rect.left + rect.width / 2);
  const left = point(rect.left); const right = point(rect.left + rect.width);
  if (!center || !left || !right) return null;
  return { position: center.toArray() as [number, number, number], scale: left.distanceTo(right) / MAHJONG_TILE_DIMENSIONS.width,
    rotationX: Math.atan2(camera.position.z - center.z, camera.position.y - center.y) };
}
export function candidatePlan(frame: CandidateFrame, camera: Camera, viewport: PresentationRect, rect = frame.snapshot.source?.rect): TableAnimation3DPlan | null {
  if (!frame.event) return null;
  const { snapshot, event } = frame;
  const seat = snapshot.playerId === 0 ? 'bottom' : 'top';
  const destination = participantRiverTarget('duel', seat, snapshot.riverIndex, snapshot.river, viewport);
  if (!('tileScale' in destination)) return null;
  const source = rect ? candidateSourceWorld(rect, camera, viewport) : null;
  if (seat === 'bottom' && !source) return null;
  const concealed = snapshot.candidateCount ? concealedCandidateTargets(snapshot.candidateCount, 'top')[concealedRemovalIndex(snapshot.candidateCount)] : undefined;
  const position = source?.position ?? concealed?.position ?? concealedCandidateSource();
  return { action: event, seat, source: position, entry: position, destination: destination.position,
    sourceRotationX: source?.rotationX ?? concealed?.rotationX ?? 0, sourceRotationY: seat === 'top' ? Math.PI : 0,
    destinationRotationX: destination.rotationX, destinationRotationY: destination.rotationY,
    sourceScale: source?.scale ?? concealed?.tileScale ?? destination.tileScale!, destinationScale: destination.tileScale!,
    tile: snapshot.tile, faceState: 'face-up', showPrimaryTile: true, localDomDraw: false };
}

/** Existing finite scheduler supplies every frame; this consumer adds no clock. */
export function CandidateDiscard3D({ frame, assetsReady, onPrepared }: { frame: CandidateFrame; assetsReady: boolean; onPrepared?: (eventId: string) => void }) {
  const { camera, gl, size, invalidate } = useThree();
  const hand = useRef<HandVisualController | null>(null);
  const measured = useRef<{ snapshot: CandidateFrame['snapshot']; width: number; height: number } | null>(null);
  const plan = useMemo(() => {
    const source = frame.snapshot.source;
    const resized = measured.current?.snapshot === frame.snapshot && (measured.current.width !== size.width || measured.current.height !== size.height);
    // Start at the captured click center; only a real resize remeasures the frozen slot.
    const element = source && resized ? [...document.querySelectorAll<HTMLElement>('[data-candidate-instance]')].find(e => e.dataset.candidateInstance === source.instanceId)?.querySelector('.tile') : null;
    measured.current = { snapshot: frame.snapshot, width: size.width, height: size.height };
    return candidatePlan(frame, camera, gl.domElement.getBoundingClientRect(), element?.getBoundingClientRect() ?? source?.rect);
  }, [frame.snapshot, frame.event, camera, gl, size]);
  useLayoutEffect(() => {
    if (!frame.event) return;
    const controller = new HandVisualController(frame.event.eventId, frame.snapshot.playerId === 0 ? 'bottom' : 'top', frame.snapshot.pack, frame.snapshot.playerId);
    hand.current = controller;
    return () => { controller.dispose(); hand.current = null; };
  }, [frame.event?.eventId, frame.snapshot.pack, frame.snapshot.playerId]);
  useLayoutEffect(() => { if (assetsReady && frame.event && plan) onPrepared?.(frame.event.eventId); }, [assetsReady, frame.event?.eventId, Boolean(plan), onPrepared]);
  const motion = plan ? candidateMotion(plan, frame.phase, frame.progress) : null;
  const position = motion?.tilePosition ?? null;
  useLayoutEffect(() => {
    if (position) hand.current?.update(projectHandContact(position, camera, gl.domElement.getBoundingClientRect()), frame.phase, frame.progress);
    if (candidateTraceEnabled()) traceCandidate('visual frame', { eventId: frame.event?.eventId, phase: frame.phase, progress: frame.progress, position, source: plan?.source, target: plan?.destination,
      hand: frame.event ? { ...document.querySelector<HTMLElement>(`[data-hand-visual-event="${frame.event.eventId}"]`)?.dataset } : undefined });
    invalidate();
  }, [frame, camera, gl, position, invalidate]);
  if (!plan || !motion || !position) return null;
  // Mount/decode during prepare, before approach starts; ownership alone changes visibility.
  return <group visible={frame.phase !== 'approach' && !candidateRiverOwns(frame)} position={position} rotation={[0, motion.tileRotationY, 0]} scale={motion.tileScale} name="candidate-discard-proxy" userData={{ eventId: frame.event?.eventId, phase: frame.phase }}>
    <group rotation={[motion.tileRotationX, 0, 0]}><Tile3D tile={frame.snapshot.tile} ownerPlayerId={frame.snapshot.playerId} faceState="face-up" showRearFace raycastDisabled objectName="candidate-tile-proxy" /></group>
  </group>;
}
