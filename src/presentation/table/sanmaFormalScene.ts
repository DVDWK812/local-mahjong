import type { SanmaState, SanmaSeat } from '../../game/sanma/types';
import { sanmaDora } from '../../game/sanma/wall';
import { presentSanma } from './sanmaPresentation';
import { buildSeatSceneState } from '../../presentation3d/sceneState/buildTableSceneState';
import type { OccupiedTableSceneState, SeatSceneState } from '../../presentation3d/sceneState/tableSceneTypes';
/** Read-only presentation projection. No fourth participant or four-player rules state. */
export function buildSanmaFormalScene(state: SanmaState, viewer: SanmaSeat, revealed: readonly number[] = []): OccupiedTableSceneState {
  const view = presentSanma(state, viewer);
  const seats: OccupiedTableSceneState['seats'] = Object.fromEntries(view.mapping.map(({ seat, participantId }) => {
    const participant = view.participants.find(p => p.id === participantId)!;
    const player = view.players[participant.appearanceSlot!];
    const base = buildSeatSceneState({ ...player, calls: [] }, seat, player.id === viewer || revealed.includes(player.id), false, view.dora);
    const projected: SeatSceneState = { ...base,
      north: participant.north?.map(tile => ({ key: `north-${player.id}-${tile.instanceId}`, tile, faceState: 'face-up', orientation: 'upright' })),
      melds: participant.publicMelds?.map((meld, index) => ({ key: `meld-${player.id}-${index}`, callType: meld.kind,
        tiles: [...(meld.kind === 'ankan' ? meld.tiles.filter(t => !t.stacked) : meld.tiles.filter(t => !t.stacked).reverse()), ...meld.tiles.filter(t => t.stacked)].map(t => ({ key: `meld-${player.id}-${t.tile.instanceId}`, tile: t.faceDown ? undefined : t.tile, faceState: t.faceDown ? 'face-down' : 'face-up', orientation: t.sideways ? 'sideways' : 'upright', called: t.sideways, stacked: t.stacked })) })) ?? [],
    };
    const withDora = <T extends { tile?: { id: import('../../game/types').TileId; red: boolean } }>(entry: T): T => {
      if (!entry.tile) return entry;
      const dora = view.dora.some(indicator => sanmaDora(indicator.id) === entry.tile!.id);
      return { ...entry, tile: { ...entry.tile, doraKind: dora ? entry.tile.red ? 'tile--double-dora' : 'tile--dora' : entry.tile.red ? 'tile--red-dora' : null } };
    };
    return [seat, { ...projected, hand: projected.hand.map(withDora), river: projected.river.map(withDora), melds: projected.melds.map(m => ({ ...m, tiles: m.tiles.map(withDora) })), north: projected.north?.map(withDora) }];
  }));
  return { seats, wall: state.wall.live.map((i, slotIndex) => ({ key: `wall-${i}`, slotIndex, visible: true, faceState: 'face-down', orientation: 'upright' })), deadWall: [...state.wall.replacements, ...state.wall.indicators].map((i, slotIndex) => ({ key: `reserve-${i}`, slotIndex, visible: true, faceState: 'face-down', orientation: 'upright' })), doraIndicators: view.dora.map(tile => ({ key: tile.instanceId, tile, faceState: 'face-up', orientation: 'upright' })) };
}
