import type { Table3DSeat } from '../coordinates/seatTransforms';
import { canonicalToSeat, TABLE_SCENE_LAYOUT } from '../coordinates/sceneTransforms';
import type { SeatSceneState } from '../sceneState/tableSceneTypes';
import { TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';
import { getFlatTileCenterY } from '../tile/tileGrounding';
import { MAHJONG_TILE_DIMENSIONS } from '../tile/tileGeometry';
import { Tile3D } from '../tile/Tile3D';
/** Dedicated north lane opposite the right-aligned meld lane, in the same table units. */
export function northTileTransform(seat: Table3DSeat, index: number, lane: Readonly<{ radialOffset: number; gap: number }> = { radialOffset: 0, gap: 0 }) {
  const scale = TABLE_PRESENTATION_TUNING.tileScale.meld;
  return canonicalToSeat(seat, [-TABLE_SCENE_LAYOUT.meldRightX + index * (MAHJONG_TILE_DIMENSIONS.width + lane.gap) * scale, getFlatTileCenterY(scale), TABLE_SCENE_LAYOUT.meldZ + lane.radialOffset]);
}
export function NorthTiles3D({ seatState, hiddenKeys }: { seatState: SeatSceneState; hiddenKeys?: ReadonlySet<string> }) {
  const scale = TABLE_PRESENTATION_TUNING.tileScale.meld;
  return <group name={`north-${seatState.seat}`}>{seatState.north?.map((tile, i) => {
    if (hiddenKeys?.has(tile.key)) return null;
    const target = northTileTransform(seatState.seat, i, seatState.northLane);
    return <Tile3D key={tile.key} tile={tile.tile} faceState={tile.faceState} orientation={tile.orientation} ownerPlayerId={seatState.playerId} position={target.position} rotationY={target.rotationY} tileScale={scale} raycastDisabled />;
  })}</group>;
}
