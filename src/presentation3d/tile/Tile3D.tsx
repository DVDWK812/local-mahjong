import { useTexture } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  PlaneGeometry,
  type ColorRepresentation,
  type MeshBasicMaterial,
  type Texture,
} from 'three';
import {
  resolveTileVisualSemantics,
  type TileVisualSemanticContext,
  type TileVisualSemantics,
} from '../../presentation/table/tileVisualSemantics';
import {
  MAHJONG_TILE_DIMENSIONS,
  MAHJONG_TILE_ANATOMY,
  MAHJONG_TILE_FACE,
  TILE_FACE_VIEW,
  sharedRedFiveMarkerGeometry,
  sharedStandingHandHitGeometry,
  sharedTileBodyGeometry,
  sharedTileFaceGeometry,
} from './tileGeometry';
import {
  getSharedTileBicolorBodyMaterial,
  getSharedTileBackSurfaceMaterial,
  getSharedTileFaceBaseMaterial,
  getSharedTileFaceGlyphMaterial,
  sharedDoraHighlightMaterial,
  sharedHoveredMatchOverlayMaterial,
  sharedRedFiveMarkerMaterial,
  sharedRedDoraHighlightMaterial,
  sharedRiichiCandidateOverlayMaterial,
  sharedSelectedTileOverlayMaterial,
  sharedTileHitMaterial,
} from './tileMaterials';
import {
  resolveTileOrientation,
  type TileFaceState,
  type TileOrientation,
} from './tileOrientation';
import {
  configureTileTexture,
  configureBuiltinFaceFit,
  resolveTile3DVisual,
  type TileDefinition,
} from './tileTextures';
import { getTileScaleGroundingLift } from './tileGrounding';
import { TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';
import { DoraHighlight3D } from '../dora/DoraHighlight3D';
import { useTileAppearance3D } from '../appearance/TileAppearance3DContext';
import { useTileFaceResources3D } from '../appearance/TileAppearance3DContext';

export type Tile3DProps = Readonly<{
  ownerPlayerId?: number;
  tile?: TileDefinition;
  faceState?: TileFaceState;
  orientation?: TileOrientation;
  position?: readonly [number, number, number];
  rotationX?: number;
  rotationY?: number;
  objectName?: string;
  metadata?: Readonly<Record<string, unknown>>;
  showRearFace?: boolean;
  interaction?: Readonly<{
    playable: boolean;
    selected: boolean;
    drawn: boolean;
    riichiCandidate: boolean;
  }>;
  stableHitTarget?: boolean;
  emphasized?: boolean;
  visualContext?: TileVisualSemanticContext;
  visualSemantics?: TileVisualSemantics;
  raycastDisabled?: boolean;
  tileScale?: number;
  doraSweepKey?: string;
  faceTexture?: Texture;
  backTexture?: Texture;
  backColor?: ColorRepresentation;
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}>;

export function Tile3D({
  ownerPlayerId,
  tile,
  faceState = 'face-up',
  orientation = 'upright',
  position = [0, 0, 0],
  rotationX = 0,
  rotationY = 0,
  objectName,
  metadata,
  showRearFace = false,
  interaction,
  stableHitTarget = false,
  emphasized = false,
  visualContext,
  visualSemantics: providedVisualSemantics,
  raycastDisabled = false,
  tileScale = 1,
  doraSweepKey,
  faceTexture,
  backTexture,
  backColor,
  onPointerOver,
  onPointerOut,
  onClick,
}: Tile3DProps) {
  const appearanceResources = useTileAppearance3D(ownerPlayerId);
  const transform = useMemo(
    () => resolveTileOrientation(faceState, orientation),
    [faceState, orientation],
  );
  const faceVisual = useMemo(
    () => resolveTile3DVisual(tile, 'face-up'),
    [tile?.id, tile?.red],
  );
  const backVisual = useMemo(() => resolveTile3DVisual(undefined, 'face-down'), []);
  const loadedTextures = useTexture([faceVisual.textureSource, backVisual.textureSource]);
  const faceAppearance = useTileFaceResources3D(faceVisual.visualKey);
  const resolvedFaceTexture = faceTexture ?? faceAppearance?.texture ?? loadedTextures[0];
  const resolvedBackTexture = backTexture ?? appearanceResources.backTexture ?? loadedTextures[1];
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const invalidate = useThree((state) => state.invalidate);
  const faceBaseMaterial = useMemo(
    () => getSharedTileFaceBaseMaterial(faceVisual),
    [faceVisual],
  );
  const faceGlyphMaterial = useMemo(
    () => getSharedTileFaceGlyphMaterial(faceVisual, resolvedFaceTexture),
    [faceVisual, resolvedFaceTexture],
  );
  const backSurfaceMaterial = useMemo(
    () => getSharedTileBackSurfaceMaterial(resolvedBackTexture),
    [resolvedBackTexture],
  );
  const bodyMaterial = useMemo(
    () => getSharedTileBicolorBodyMaterial(backColor ?? appearanceResources.backColor, faceAppearance?.sideColor),
    [appearanceResources.backColor, backColor, faceAppearance?.sideColor],
  );
  const visualSemantics = providedVisualSemantics ?? resolveTileVisualSemantics({
    tileId: tile?.id,
    faceUp: transform.faceState === 'face-up',
    doraKind: tile?.doraKind,
    context: visualContext,
  });
  const interactionLift = interaction?.selected ? 0.24 : 0;
  const interactionScale = interaction?.selected
    ? 1.035
    : interaction?.riichiCandidate ? 1.012 : 1;
  const overlayMaterial = emphasized || interaction?.selected
    ? sharedSelectedTileOverlayMaterial
    : interaction?.riichiCandidate
      ? sharedRiichiCandidateOverlayMaterial
      : visualSemantics.dimmedByHoveredMatch
        ? sharedHoveredMatchOverlayMaterial
        : null;
  const scaleGroundingLift = getTileScaleGroundingLift(rotationX, interactionScale);

  useEffect(() => {
    configureTileTexture(resolvedFaceTexture, maxAnisotropy);
    if (resolvedFaceTexture === loadedTextures[0]) configureBuiltinFaceFit(resolvedFaceTexture);
    configureTileTexture(resolvedBackTexture, maxAnisotropy);
    invalidate();
  }, [invalidate, maxAnisotropy, resolvedBackTexture, resolvedFaceTexture]);

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      name={objectName}
      userData={{ ...metadata, visualSemantics }}
      dispose={null}
      scale={tileScale}
      onPointerOver={stableHitTarget || raycastDisabled ? undefined : onPointerOver}
      onPointerOut={stableHitTarget || raycastDisabled ? undefined : onPointerOut}
      onClick={stableHitTarget || raycastDisabled ? undefined : onClick}
    >
      <group
        position={[0, interactionLift + scaleGroundingLift, 0]}
        scale={interactionScale}
        rotation={[rotationX, transform.rotation[1], transform.rotation[2]]}
      >
        <mesh
          geometry={sharedTileBodyGeometry}
          material={bodyMaterial}
          raycast={stableHitTarget || raycastDisabled ? () => undefined : undefined}
          castShadow
          receiveShadow
        />
        {transform.faceState === 'face-up' ? (
          <>
            <mesh
              geometry={sharedTileFaceGeometry}
              material={faceBaseMaterial}
              position={[0, MAHJONG_TILE_DIMENSIONS.height / 2 + MAHJONG_TILE_FACE.surfaceOffset, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={stableHitTarget || raycastDisabled ? () => undefined : undefined}
              receiveShadow
            />
            <mesh
              geometry={sharedTileFaceGeometry}
              material={faceGlyphMaterial}
              position={[0, MAHJONG_TILE_DIMENSIONS.height / 2 + MAHJONG_TILE_FACE.surfaceOffset + TILE_GLYPH_DECAL_OFFSET, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={stableHitTarget || raycastDisabled ? () => undefined : undefined}
            />
          </>
        ) : (
          <mesh
            geometry={sharedTileFaceGeometry}
            material={backSurfaceMaterial}
            position={[0, MAHJONG_TILE_DIMENSIONS.height / 2 + MAHJONG_TILE_FACE.surfaceOffset, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={stableHitTarget || raycastDisabled ? () => undefined : undefined}
            receiveShadow
          />
        )}
        {showRearFace ? (
          <mesh
            geometry={sharedTileFaceGeometry}
            material={backSurfaceMaterial}
            position={[
              0,
              -(MAHJONG_TILE_DIMENSIONS.height / 2 + MAHJONG_TILE_FACE.surfaceOffset),
              0,
            ]}
            rotation={[Math.PI / 2, 0, 0]}
            raycast={stableHitTarget || raycastDisabled ? () => undefined : undefined}
            receiveShadow
          />
        ) : null}
        {transform.faceState === 'face-up' && faceVisual.isRed ? (
          <mesh
            geometry={sharedRedFiveMarkerGeometry}
            material={sharedRedFiveMarkerMaterial}
            position={[
              (TILE_FACE_VIEW.aka.u - 0.5) * MAHJONG_TILE_FACE.width,
              MAHJONG_TILE_DIMENSIONS.height / 2 + MAHJONG_TILE_FACE.markerOffset + TILE_GLYPH_DECAL_OFFSET * 2,
              (TILE_FACE_VIEW.aka.v - 0.5) * MAHJONG_TILE_FACE.depth,
            ]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={stableHitTarget || raycastDisabled ? () => undefined : undefined}
          />
        ) : null}
        {overlayMaterial && transform.faceState === 'face-up' ? (
          <mesh
            geometry={sharedTileFaceGeometry}
            material={overlayMaterial}
            position={[
              0,
              MAHJONG_TILE_DIMENSIONS.height / 2 + MAHJONG_TILE_FACE.markerOffset,
              0,
            ]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={stableHitTarget || raycastDisabled ? () => undefined : undefined}
          />
        ) : null}
        {transform.faceState === 'face-up'
          && TABLE_PRESENTATION_TUNING.doraVisual.breathingEnabled === 1
          && (visualSemantics.doraHighlight || visualSemantics.redDoraHighlight) ? (
            <DoraHighlight3D
              sweepKey={doraSweepKey}
              variant={visualSemantics.combinedHighlight ? 'combined' : 'normal'}
              dimmed={visualSemantics.dimmedByHoveredMatch}
            />
          ) : null}
        {transform.faceState === 'face-up'
          && TABLE_PRESENTATION_TUNING.doraVisual.borderEnabled === 1
          && visualSemantics.doraHighlight ? (
          <TileHighlightFrame3D material={sharedDoraHighlightMaterial} renderOrder={3} />
        ) : null}
        {transform.faceState === 'face-up'
          && TABLE_PRESENTATION_TUNING.doraVisual.borderEnabled === 1
          && visualSemantics.redDoraHighlight ? (
          <TileHighlightFrame3D
            material={sharedRedDoraHighlightMaterial}
            renderOrder={4}
            scale={visualSemantics.combinedHighlight ? 0.72 : 1}
          />
        ) : null}
      </group>
      {stableHitTarget && !raycastDisabled ? (
        <mesh
          name={objectName ? `${objectName}-hit-target` : 'tile-hit-target'}
          geometry={sharedStandingHandHitGeometry}
          material={sharedTileHitMaterial}
          position={[0, 0.16, 0]}
          userData={{ ...metadata, hitTarget: true }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onClick={onClick}
        />
      ) : null}
    </group>
  );
}

const TILE_HIGHLIGHT_FRAME_WIDTH = 0.12;
const TILE_GLYPH_DECAL_OFFSET = 0.001;
const sharedTileHighlightHorizontalGeometry = new PlaneGeometry(
  MAHJONG_TILE_FACE.width,
  TILE_HIGHLIGHT_FRAME_WIDTH,
);
const sharedTileHighlightVerticalGeometry = new PlaneGeometry(
  TILE_HIGHLIGHT_FRAME_WIDTH,
  MAHJONG_TILE_FACE.depth,
);

function TileHighlightFrame3D({
  material,
  renderOrder,
  scale = 1,
}: Readonly<{
  material: MeshBasicMaterial;
  renderOrder: number;
  scale?: number;
}>) {
  const surfaceY = MAHJONG_TILE_DIMENSIONS.height / 2 + MAHJONG_TILE_FACE.markerOffset;
  const horizontalZ = MAHJONG_TILE_FACE.depth / 2 - TILE_HIGHLIGHT_FRAME_WIDTH / 2;
  const verticalX = MAHJONG_TILE_FACE.width / 2 - TILE_HIGHLIGHT_FRAME_WIDTH / 2;
  return (
    <group position={[0, surfaceY, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
      <mesh geometry={sharedTileHighlightHorizontalGeometry} material={material} position={[0, horizontalZ, 0]} raycast={() => undefined} renderOrder={renderOrder} />
      <mesh geometry={sharedTileHighlightHorizontalGeometry} material={material} position={[0, -horizontalZ, 0]} raycast={() => undefined} renderOrder={renderOrder} />
      <mesh geometry={sharedTileHighlightVerticalGeometry} material={material} position={[verticalX, 0, 0]} raycast={() => undefined} renderOrder={renderOrder} />
      <mesh geometry={sharedTileHighlightVerticalGeometry} material={material} position={[-verticalX, 0, 0]} raycast={() => undefined} renderOrder={renderOrder} />
    </group>
  );
}
