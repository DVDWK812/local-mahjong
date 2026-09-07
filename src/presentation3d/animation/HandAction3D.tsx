import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import type { Group } from 'three';
import {
  HAND_ANIMATION_PHASES,
  type HandAnimationPhase,
} from '../../presentation/handAnimation/HandAnimationController';
import { Tile3D } from '../tile/Tile3D';
import { useTileAppearance3D } from '../appearance/TileAppearance3DContext';
import { RiichiStick3D } from '../riichi/RiichiStick3D';
import type { RiichiStick3DAppearance } from '../riichi/riichiStickAppearance';
import { HandVisualController } from '../../hand/HandVisualController';
import { projectHandContact } from '../../hand/handProjection';
import { resolveHandSnapshotLayout } from '../hand/handSnapshotLayout';
import type { HandPresentationFrame } from '../../presentation/handAnimation/HandPresentationSnapshot';
import { resolveSnapshotDiscardMotion } from './discardHandLifecycle';
import { DemandFrameInvalidator } from './DemandFrameInvalidator';
import {
  resolveTableAnimation3DMotion,
  resolveTransientTile3DMotion,
  type TableAnimation3DPlan,
} from './tableAnimation3D';

export type ActiveTableAnimation3D = Readonly<{
  handPresentation?: HandPresentationFrame;
  plan: TableAnimation3DPlan;
  phase: HandAnimationPhase;
}>;

const PHASE_DURATION = Object.fromEntries(
  HAND_ANIMATION_PHASES.map(({ phase, durationMs }) => [phase, durationMs]),
) as Record<HandAnimationPhase, number>;

export function HandAction3D({ active, riichiStickAppearance }: Readonly<{
  active: ActiveTableAnimation3D;
  riichiStickAppearance?: RiichiStick3DAppearance;
}>) {
  if (active.handPresentation) return <SnapshotDiscardProxy3D active={active} />;
  return <LegacyHandAction3D active={active} riichiStickAppearance={riichiStickAppearance} />;
}

/** Discard frames come from the shared scheduler, including the DOM consumer. */
function SnapshotDiscardProxy3D({ active }: { active: ActiveTableAnimation3D }) {
  const frame = active.handPresentation!;
  const motion = resolveSnapshotDiscardMotion(active.plan, frame);
  const invalidate = useThree((state) => state.invalidate);
  const { camera, gl } = useThree((state) => state);
  const hand = useVisualHand(active);
  useLayoutEffect(() => {
    const update = () => {
      let position = motion.tilePosition;
      if (!frame.snapshot.isTsumogiri && ['insert', 'reorder', 'complete'].includes(frame.phase)) {
        // Consume the very same slot resolver as Hand3D, including insertion lift.
        const slots = resolveHandSnapshotLayout({ seat: active.plan.seat, playerId: frame.snapshot.playerId,
          hand: [], river: [], melds: [], riichi: false }, frame);
        const entry = slots.find(slot => !slot.hidden && slot.tile.instanceId === frame.snapshot.drawnTile?.instanceId)
          ?? slots.find(slot => !slot.hidden);
        if (entry) position = entry.transform.position;
      }
      hand.current?.update(projectHandContact(position, camera, gl.domElement.getBoundingClientRect()),
        frame.phase, frame.progress, frame.snapshot.isTsumogiri);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [active.plan.seat, frame, camera, gl, hand, motion.tilePosition]);
  useLayoutEffect(() => { invalidate(); }, [frame, invalidate]);
  return <group name="table-animation-3d" userData={{ eventId: frame.snapshot.eventId, phase: frame.phase }}>
    {motion.tileVisible && active.plan.showPrimaryTile ? <group position={motion.tilePosition} rotation={[0, motion.tileRotationY, 0]} scale={motion.tileScale}>
      <group rotation={[motion.tileRotationX, 0, 0]}>
        <Tile3D ownerPlayerId={active.plan.action.playerId} tile={active.plan.tile}
          faceState={active.plan.faceState} orientation="upright" showRearFace
          objectName="table-animation-tile-proxy" raycastDisabled />
      </group>
    </group> : null}
  </group>;
}

function useVisualHand(active: ActiveTableAnimation3D) {
  const hand = useRef<HandVisualController | null>(null);
  const domOwned = active.plan.localDomDraw || Boolean(active.plan.localDiscardMotion);
  useLayoutEffect(() => {
    if (domOwned) return;
    const controller = new HandVisualController(active.plan.action.eventId, active.plan.seat);
    hand.current = controller;
    return () => { controller.dispose(); hand.current = null; };
  }, [active.plan.action.eventId, active.plan.seat, domOwned]);
  return hand;
}

function LegacyHandAction3D({ active, riichiStickAppearance }: Readonly<{
  active: ActiveTableAnimation3D;
  riichiStickAppearance?: RiichiStick3DAppearance;
}>) {
  const ownerAppearance = useTileAppearance3D(active.plan.action.playerId);
  const hand = useVisualHand(active);
  const { camera, gl } = useThree((state) => state);
  const tileRef = useRef<Group>(null);
  const tilePitchRef = useRef<Group>(null);
  const transientRefs = useRef(new Map<string, Group>());
  const transientPitchRefs = useRef(new Map<string, Group>());
  const stickRef = useRef<Group>(null);
  const phaseStartRef = useRef(performance.now());
  const frameInvalidatorRef = useRef(new DemandFrameInvalidator());
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    frameInvalidatorRef.current.cancelPending();
    phaseStartRef.current = performance.now();
    frameInvalidatorRef.current.markInvalidated(phaseStartRef.current);
    invalidate();
    return () => frameInvalidatorRef.current.cancelPending();
  }, [active.phase, active.plan.action.eventId, invalidate]);

  useFrame(() => {
    const duration = PHASE_DURATION[active.phase];
    const progress = duration <= 0 ? 1 : Math.min(1, (performance.now() - phaseStartRef.current) / duration);
    const motion = resolveTableAnimation3DMotion(active.plan, active.phase, progress);
    hand.current?.update(projectHandContact(motion.tilePosition, camera, gl.domElement.getBoundingClientRect()),
      active.phase, progress);
    if (tileRef.current) {
      tileRef.current.position.set(...motion.tilePosition);
      tileRef.current.rotation.set(0, motion.tileRotationY, 0);
      tileRef.current.scale.setScalar(motion.tileScale);
      tileRef.current.visible = motion.tileVisible;
    }
    if (tilePitchRef.current) tilePitchRef.current.rotation.set(motion.tileRotationX, 0, 0);
    active.plan.transientTiles?.forEach((tile) => {
      const tileMotion = resolveTransientTile3DMotion(tile, active.phase, progress);
      const group = transientRefs.current.get(tile.key);
      const pitch = transientPitchRefs.current.get(tile.key);
      if (group) {
        group.position.set(...tileMotion.position);
        group.rotation.set(0, tileMotion.rotationY, 0);
        group.scale.setScalar(tileMotion.tileScale);
        group.visible = tileMotion.visible;
      }
      if (pitch) pitch.rotation.set(tileMotion.rotationX, 0, 0);
    });
    if (stickRef.current) {
      stickRef.current.position.set(...motion.tilePosition);
      stickRef.current.rotation.set(0, motion.tileRotationY, 0);
      stickRef.current.visible = active.phase !== 'approach' && active.phase !== 'retreat';
    }
    if (progress < 1) frameInvalidatorRef.current.request(invalidate);
  });

  const initial = resolveTableAnimation3DMotion(active.plan, active.phase, 0);
  return (
    <group
      name="table-animation-3d"
      userData={{ eventId: active.plan.action.eventId, phase: active.phase }}
    >
      {active.plan.showPrimaryTile ? (
        <group
          ref={tileRef}
          position={initial.tilePosition as [number, number, number]}
          rotation={[0, initial.tileRotationY, 0]}
          scale={initial.tileScale}
          visible={initial.tileVisible}
        >
          <group ref={tilePitchRef} rotation={[initial.tileRotationX, 0, 0]}>
            <Tile3D
              ownerPlayerId={active.plan.action.playerId}
              tile={active.plan.tile}
              faceState={active.plan.faceState}
              orientation="upright"
              showRearFace={active.plan.faceState === 'face-down'}
              objectName="table-animation-tile-proxy"
              metadata={{ region: 'transient-tile-proxy', eventId: active.plan.action.eventId }}
              raycastDisabled
            />
          </group>
        </group>
      ) : null}
      {active.plan.transientTiles?.map((tile) => {
        const motion = resolveTransientTile3DMotion(tile, active.phase, 0);
        return (
          <group
            key={tile.key}
            ref={(node) => {
              if (node) transientRefs.current.set(tile.key, node);
              else transientRefs.current.delete(tile.key);
            }}
            position={motion.position as [number, number, number]}
            rotation={[0, motion.rotationY, 0]}
            scale={motion.tileScale}
            visible={motion.visible}
          >
            <group
              ref={(node) => {
                if (node) transientPitchRefs.current.set(tile.key, node);
                else transientPitchRefs.current.delete(tile.key);
              }}
              rotation={[motion.rotationX, 0, 0]}
            >
              <Tile3D
                ownerPlayerId={active.plan.action.playerId}
                tile={tile.tile}
                faceState={tile.faceState}
                orientation={tile.orientation}
                showRearFace={tile.faceState === 'face-down'}
                objectName="table-animation-meld-tile-proxy"
                metadata={{ region: 'transient-meld-tile-proxy', eventId: active.plan.action.eventId }}
                raycastDisabled
              />
            </group>
          </group>
        );
      })}
      {active.plan.stickProxy ? (
        <group
          ref={stickRef}
          position={initial.tilePosition as [number, number, number]}
          rotation={[0, initial.tileRotationY, 0]}
          visible={active.phase !== 'approach' && active.phase !== 'retreat'}
        >
          <RiichiStick3D seat={active.plan.seat} position={[0, 0, 0]} rotationY={0} objectName="table-animation-riichi-stick-proxy" raycastDisabled appearance={ownerAppearance.riichiStickAppearance ?? riichiStickAppearance} />
        </group>
      ) : null}
    </group>
  );
}
