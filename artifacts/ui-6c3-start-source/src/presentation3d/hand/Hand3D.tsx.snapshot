import type { SeatSceneState } from '../sceneState/tableSceneTypes';
import { getHandTileTransform } from '../coordinates/sceneTransforms';
import { Tile3D } from '../tile/Tile3D';
import type {
  LocalHandPresentation,
  TableInteractionActions,
} from '../../presentation/table/TablePresentationContract';
import {
  activateHand3DTile,
  clearHoveredTileIfMatching,
  clearHand3DSelection,
  resolveHand3DCursor,
  resolveHand3DInteractionBinding,
  selectHand3DTile,
  shouldCommitDeferredHoverRelease,
} from './handInteraction';
import type { DiscardSource3DCapture } from '../animation/DiscardSource3D';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import {
  resolveWinnerHandMotion3D,
  type WinPresentation3DState,
} from '../win/winPresentation3D';
import { getHandTileScale } from '../table/tablePresentationTuning';
import type { TileVisualSemanticContext } from '../../presentation/table/tileVisualSemantics';
import type { HandPresentationFrame } from '../../presentation/handAnimation/HandPresentationSnapshot';
import { resolveHandSnapshotLayout } from './handSnapshotLayout';

type Hand3DProps = Readonly<{
  handPresentation?: HandPresentationFrame;
  seatState: SeatSceneState;
  presentation?: LocalHandPresentation;
  interactionActions?: TableInteractionActions;
  hiddenTileKeys?: ReadonlySet<string>;
  winPresentation?: WinPresentation3DState | null;
  visualContext?: TileVisualSemanticContext;
  onDiscardSourceCapture?: (
    capture: Omit<DiscardSource3DCapture, 'sessionKey' | 'afterSequence'>,
  ) => (() => void) | void;
}>;

export function Hand3D({
  seatState,
  handPresentation,
  presentation,
  interactionActions,
  hiddenTileKeys,
  winPresentation = null,
  visualContext,
  onDiscardSourceCapture,
}: Hand3DProps) {
  const canvas = useThree((state) => state.gl.domElement);
  const hoveredPlayableTileIdRef = useRef<string | null>(null);
  const hoverRevisionRef = useRef(0);
  const ownsPointer = presentation !== undefined;
  const hasDrawnTile = seatState.hand.some((tile) => tile.drawn);
  const winMotion = resolveWinnerHandMotion3D(seatState.seat, winPresentation?.phase ?? 'ready');

  useEffect(() => {
    if (!ownsPointer) return undefined;
    return () => {
      hoverRevisionRef.current += 1;
      canvas.style.cursor = 'default';
    };
  }, [canvas, ownsPointer]);

  useEffect(() => {
    if (!ownsPointer || interactionActions) return;
    hoverRevisionRef.current += 1;
    hoveredPlayableTileIdRef.current = null;
    canvas.style.cursor = resolveHand3DCursor(null);
  }, [canvas, interactionActions, ownsPointer]);

  useEffect(() => {
    if (!ownsPointer || !interactionActions) return undefined;
    const clearHover = () => {
      hoverRevisionRef.current += 1;
      hoveredPlayableTileIdRef.current = null;
      canvas.style.cursor = resolveHand3DCursor(null);
      clearHand3DSelection(interactionActions);
    };
    canvas.addEventListener('pointerleave', clearHover);
    return () => {
      hoverRevisionRef.current += 1;
      canvas.removeEventListener('pointerleave', clearHover);
    };
  }, [canvas, interactionActions, ownsPointer]);

  return (
    <group name={`hand-${seatState.seat}`}>
      {handPresentation ? resolveHandSnapshotLayout(seatState, handPresentation).map((entry) => entry.hidden ? null : (
        <Tile3D key={entry.key} ownerPlayerId={seatState.playerId} tile={entry.definition}
          faceState={entry.faceState} orientation="upright" position={entry.transform.position}
          rotationX={entry.transform.rotationX} rotationY={entry.transform.rotationY}
          tileScale={getHandTileScale(seatState.seat)} showRearFace={entry.faceState === 'face-down'}
          visualContext={visualContext} doraSweepKey={entry.key}
          objectName={`hand-tile-${seatState.seat}-${entry.index}`}
          metadata={{ region: 'hand', seat: seatState.seat, index: entry.index, phase: handPresentation.phase }} raycastDisabled />
      )) : seatState.hand.map((tile, index) => {
        const transform = getHandTileTransform(
          seatState.seat,
          index,
          seatState.hand.length,
          hasDrawnTile,
        );
        const interaction = resolveHand3DInteractionBinding(
          seatState.playerId,
          tile.key,
          index,
          presentation,
        );
        const interactive = interaction?.playable === true && interactionActions !== undefined;
        const position = [
          transform.position[0] + winMotion.offset[0],
          transform.position[1] + winMotion.offset[1],
          transform.position[2] + winMotion.offset[2],
        ] as const;
        if (hiddenTileKeys?.has(tile.key)) return null;
        return (
          <Tile3D
            ownerPlayerId={seatState.playerId}
            key={tile.key}
            tile={tile.tile}
            faceState={tile.faceState}
            orientation={tile.orientation}
            position={position}
            rotationX={transform.rotationX + winMotion.tiltX}
            rotationY={transform.rotationY}
            tileScale={getHandTileScale(seatState.seat)}
            doraSweepKey={tile.key}
            visualContext={visualContext}
            objectName={`hand-tile-${seatState.seat}-${index}`}
            metadata={{
              region: 'hand',
              seat: seatState.seat,
              index,
              tileKey: tile.key,
              tileId: tile.tile?.id ?? null,
              drawn: tile.drawn,
              tileInstanceId: interaction?.tileInstanceId ?? null,
              playable: interaction?.playable ?? false,
              selected: interaction?.selected ?? false,
              riichiCandidate: interaction?.riichiCandidate ?? false,
              winPresentationEventId: winPresentation?.action.eventId ?? null,
            }}
            showRearFace={tile.faceState === 'face-down' || winPresentation !== null}
            interaction={interaction ?? undefined}
            stableHitTarget={interaction !== null}
            onPointerOver={interactive ? (event) => {
              event.stopPropagation();
              hoverRevisionRef.current += 1;
              hoveredPlayableTileIdRef.current = interaction.tileInstanceId;
              canvas.style.cursor = resolveHand3DCursor(interaction.tileInstanceId);
              selectHand3DTile(interaction, interactionActions);
            } : undefined}
            onPointerOut={interactive ? (event) => {
              event.stopPropagation();
              const scheduledRevision = ++hoverRevisionRef.current;
              queueMicrotask(() => {
                const current = hoveredPlayableTileIdRef.current;
                if (!shouldCommitDeferredHoverRelease(
                  current,
                  interaction.tileInstanceId,
                  scheduledRevision,
                  hoverRevisionRef.current,
                )) return;
                const next = clearHoveredTileIfMatching(current, interaction.tileInstanceId);
                hoveredPlayableTileIdRef.current = next;
                canvas.style.cursor = resolveHand3DCursor(next);
                clearHand3DSelection(interactionActions);
              });
            } : undefined}
            onClick={interactive ? (event) => {
              event.stopPropagation();
              const clearSource = tile.tile ? onDiscardSourceCapture?.({
                playerId: seatState.playerId,
                tileInstanceId: interaction.tileInstanceId,
                tile: tile.tile,
                position: transform.position,
                rotationX: transform.rotationX,
                rotationY: transform.rotationY,
              }) : undefined;
              try {
                if (!activateHand3DTile(interaction, interactionActions)) clearSource?.();
              } catch (error) {
                clearSource?.();
                throw error;
              }
            } : undefined}
          />
        );
      })}
    </group>
  );
}
