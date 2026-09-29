import type { TableParticipant } from './participantPresentation';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import { getFlatTileCenterY } from '../tile/tileGrounding';
import { MAHJONG_TILE_DIMENSIONS } from '../tile/tileGeometry';
import { Tile3D } from '../tile/Tile3D';

/** One canonical bottom lane, rotated by display seat. No game/seat-wind authority here. */
export function sanmaPublicTarget(seat: Table3DSeat, x: number, z: number, stacked = false) {
  const rotationY = seat === 'right' ? -Math.PI / 2 : seat === 'left' ? Math.PI / 2 : 0;
  return { position: [x * Math.cos(rotationY) - z * Math.sin(rotationY), getFlatTileCenterY(0.82) + (stacked ? MAHJONG_TILE_DIMENSIONS.height * 0.82 : 0), x * Math.sin(rotationY) + z * Math.cos(rotationY)] as const, rotationY, tileScale: 0.82 };
}
export function SanmaPublicTiles({ participant, seat }: { participant: TableParticipant; seat: Table3DSeat }) {
  let lane = 11;
  return <group name={`sanma-public-${participant.id}`}>
    {participant.publicMelds?.map((meld, m) => {
      let width = 0; const slots: number[] = [];
      for (const t of meld.tiles.filter(t => !t.stacked)) { slots.push(width); width += t.sideways ? 1.25 : 0.95; }
      const origin = lane; lane -= width + 0.35;
      return <group key={`${m}-${meld.kind}`}>{meld.tiles.map((t, i) => {
        const target = sanmaPublicTarget(seat, origin - (slots[t.stacked ? t.stackSlot : i] ?? 0), 12, t.stacked);
        return <Tile3D key={t.tile.instanceId} ownerPlayerId={participant.appearanceSlot} tile={t.faceDown ? undefined : t.tile} faceState={t.faceDown ? 'face-down' : 'face-up'}
          {...target} rotationY={target.rotationY + (t.sideways ? Math.PI / 2 : 0)} raycastDisabled objectName={`sanma-meld-${participant.id}-${m}-${i}`} />;
      })}</group>;
    })}
    {participant.north?.map((tile, i) => <Tile3D key={tile.instanceId} tile={tile} ownerPlayerId={participant.appearanceSlot} {...sanmaPublicTarget(seat, -11 + i * 1.05, 10)} raycastDisabled objectName={`sanma-north-${participant.id}-${i}`} />)}
  </group>;
}
