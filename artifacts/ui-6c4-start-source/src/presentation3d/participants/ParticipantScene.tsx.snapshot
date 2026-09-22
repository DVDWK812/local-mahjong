import { CandidateDiscard3D } from './CandidateDiscard3D';
import { candidateRiverOwns, candidateSourceHidden, type CandidateFrame } from './candidateAnimation';
import { concealedRemovalIndex } from './candidateRows';
import { Suspense, useLayoutEffect, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { SceneCanvasHost, SceneContentReady } from '../session/SceneCanvasHost';
import { AppearanceResources3D } from '../appearance/AppearanceResources3D';
import { TableMesh } from '../table/TableMesh';
import { Tile3D } from '../tile/Tile3D';
import { TileTextureWarmup } from '../tile/TileTextureWarmup';
import type { AppearanceSettings } from '../../presentation/appearance/appearanceSettings';
import type { PlayerSlotAppearances } from '../../presentation/appearance/playerSlotAppearance';
import type { TableParticipant } from './participantPresentation';
import { resolveTileAppearanceId } from '../../presentation/appearance/TileFaceDomAppearance';
import { PARTICIPANT_LAYOUTS, SEVENTEEN_COMPACT_RIVER, concealedCandidateTargets, interpolateParticipantRiverTarget, participantHandTarget, participantRiverTarget, resolveParticipantLayout, type ParticipantLayoutPreset, type ParticipantSeat } from './participantLayout';
import { FixedTableCamera, TABLE_CAMERA } from '../camera/FixedTableCamera';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import { TableLighting } from '../lighting/TableLighting';
import { TableEnvironment } from '../table/TableEnvironment';
import { CentralConsoleHudAnchor3D } from '../table/CentralConsoleHudAnchor3D';
import '../table3d.css';

function ModeCamera({ preset }: { preset: ParticipantLayoutPreset }) {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => { camera.lookAt(...PARTICIPANT_LAYOUTS[preset].target); camera.updateProjectionMatrix(); invalidate(); }, [camera, invalidate, preset]);
  return null;
}
function ParticipantRiver({ participant, seat, preset, candidateFrame }: { participant: TableParticipant; seat: Table3DSeat; preset: ParticipantLayoutPreset; candidateFrame?: CandidateFrame | null }) {
  const size = useThree(state => state.size);
  const viewport = { width: size.width, height: size.height };
  const enteringCompact = preset === 'duel' && candidateFrame?.snapshot.playerId === participant.appearanceSlot
    && candidateFrame.snapshot.riverIndex === SEVENTEEN_COMPACT_RIVER.firstCompactTileCount - 1
    && participant.discardedTiles.length === SEVENTEEN_COMPACT_RIVER.firstCompactTileCount;
  const beforeCompact = enteringCompact ? participant.discardedTiles.slice(0, candidateFrame.snapshot.riverIndex) : [];
  return participant.discardedTiles.map((tile, index) => {
    const settled = participantRiverTarget(preset, seat, index, participant.discardedTiles, viewport);
    const previous = enteringCompact && index < beforeCompact.length ? participantRiverTarget('duel', seat, index, beforeCompact, viewport) : null;
    const previousScale = previous && 'tileScale' in previous ? previous.tileScale : null;
    const settledScale = 'tileScale' in settled ? settled.tileScale : null;
    const blended = previous && typeof previousScale === 'number' && typeof settledScale === 'number'
      ? interpolateParticipantRiverTarget({ position: previous.position, tileScale: previousScale }, { position: settled.position, tileScale: settledScale },
        candidateFrame!.phase === 'retreat' ? candidateFrame!.progress : 0)
      : null;
    const transform = blended ? { ...settled, ...blended } : settled;
    return <group key={tile.instanceId} visible={!(candidateFrame && !candidateRiverOwns(candidateFrame) && participant.appearanceSlot === candidateFrame.snapshot.playerId && tile.instanceId === candidateFrame.snapshot.tile.instanceId)}>
      <Tile3D tile={tile} ownerPlayerId={participant.appearanceSlot} {...transform} raycastDisabled objectName={`participant-river-${participant.id}-${index}`} />
    </group>;
  });
}
export function ParticipantScene({ participants, mapping, preset, settings, sessionKey, onReady, onUnavailable, appearanceSlots, centralHud, candidateFrame, onCandidatePrepared }: {
  participants: readonly TableParticipant[]; mapping: readonly ParticipantSeat[]; preset: ParticipantLayoutPreset;
  settings: AppearanceSettings; sessionKey: string; onReady: () => void; onUnavailable: (error: Error) => void;
  appearanceSlots?: PlayerSlotAppearances;
  centralHud?: ReactNode;
  candidateFrame?: CandidateFrame | null;
  onCandidatePrepared?: (eventId: string) => void;
}) {
  const seats = resolveParticipantLayout(participants, mapping, preset);
  const slots = participants.map(p => p.appearanceSlot);
  const faceIds = [...new Set(participants.flatMap(p => p.discardedTiles.map(tile => resolveTileAppearanceId(tile.id, tile.red))))];
  return <SceneCanvasHost sessionKey={sessionKey} camera={preset === 'duel' ? TABLE_CAMERA : { position: PARTICIPANT_LAYOUTS[preset].camera, fov: 48, near: 0.1, far: 120 }} onReady={onReady} onUnavailable={onUnavailable}>
    {preset === 'duel' ? <><FixedTableCamera /><TableEnvironment /><TableLighting /></> : <>
      <ModeCamera preset={preset} /><color attach="background" args={['#0b2019']} />
      <hemisphereLight args={['#f1f3dd', '#10251f', 1.35]} /><directionalLight position={[-6, 16, 8]} intensity={2.5} />
    </>}
    <AppearanceResources3D settings={settings} playerAppearances={appearanceSlots} faceIds={faceIds} activePlayerIds={slots} criticalPlayerIds={slots} includeRiichiResources={false}>
      {({ feltTexture, criticalAssetsReady }) => <Suspense fallback={null}>
        <TileTextureWarmup />
        <TableMesh feltTexture={feltTexture} />
        {centralHud ? <CentralConsoleHudAnchor3D>{centralHud}</CentralConsoleHudAnchor3D> : null}
        {seats.map(({ participant, seat }) => <group key={participant.id} name={`participant-${participant.id}`}>
          {preset === 'duel' && participant.discardCandidates.visibility === 'hidden' && (seat === 'top' || seat === 'bottom') ? (() => {
            const pending = candidateFrame?.snapshot.playerId === participant.appearanceSlot && !candidateRiverOwns(candidateFrame) ? candidateFrame : null;
            const count = pending?.snapshot.candidateCount ?? participant.discardCandidates.count;
            return concealedCandidateTargets(count, seat).map((target, index) => <group key={`candidate-slot-${index}`}
              visible={!(pending && candidateSourceHidden(pending) && index === concealedRemovalIndex(count))}>
              <Tile3D ownerPlayerId={participant.appearanceSlot} faceState="face-down" showRearFace {...target} raycastDisabled objectName="concealed-candidate-slot" />
            </group>);
          })() : preset !== 'duel' && participant.fixedHand.visibility === 'hidden' ? Array.from({ length: participant.fixedHand.count }, (_, index) => <Tile3D
            key={`hidden-slot-${index}`} ownerPlayerId={participant.appearanceSlot} faceState="face-down"
            {...participantHandTarget(preset, seat, index, participant.fixedHand.visibility === 'hidden' ? participant.fixedHand.count : 0)} raycastDisabled
          />) : null}
          <ParticipantRiver participant={participant} seat={seat} preset={preset} candidateFrame={candidateFrame} />
        </group>)}
        {candidateFrame ? <CandidateDiscard3D frame={candidateFrame} assetsReady={criticalAssetsReady} onPrepared={onCandidatePrepared} /> : null}
        <SceneContentReady sceneReady criticalAssetsReady={criticalAssetsReady} />
      </Suspense>}
    </AppearanceResources3D>
  </SceneCanvasHost>;
}
