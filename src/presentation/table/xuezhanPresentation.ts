import { buildSeatSceneState } from '../../presentation3d/sceneState/buildTableSceneState';
import type { Table3DSeat } from '../../presentation3d/coordinates/seatTransforms';
import type { TableSceneState } from '../../presentation3d/sceneState/tableSceneTypes';
import { legalActions, legalDiscards } from '../../game/xuezhan/engine';
import type { XzState } from '../../game/xuezhan/types';
import type { LocalHandPresentation, TableInteractionActions } from './TablePresentationContract';
import { presentationEventBus } from '../PresentationEventBus';
import type { PlayerState } from '../../game/types';
const seats: Table3DSeat[] = ['bottom', 'right', 'top', 'left'];
/** A projection only. No Riichi GameState is created and no Riichi Rules are called. */
export function presentXz(s: XzState, selected: string[] = [], revealWon = true, testOmniscient = false): { scene: TableSceneState; players: PlayerState[]; player: PlayerState; hand: LocalHandPresentation; actions: ReturnType<typeof legalActions> } {
  const players: PlayerState[] = s.players.map(p => ({
    id: p.id, name: p.name, score: p.score, hand: p.hand, calls: p.melds, river: p.river, drawnTile: p.hand.find(t => t.instanceId === p.drawn) ?? null,
    seatWind: (['east', 'south', 'west', 'north'] as const)[p.id], riichi: false, riichiState: null,
  }));
  const scene: TableSceneState = { seats: Object.fromEntries(s.players.map(p => [seats[p.id], { ...buildSeatSceneState(players[p.id], seats[p.id], p.id === 0 || testOmniscient || revealWon && p.won !== null, true, []), exposedHand: testOmniscient || revealWon && p.won !== null }])) as TableSceneState['seats'], wall: s.wall.map((tile, index) => ({ key: `xz-wall-${tile.instanceId}`, faceState: 'face-down', orientation: 'upright', slotIndex: 55 - s.wall.length + index, visible: true })), deadWall: [], doraIndicators: [] };
  const p = s.players[0], playable = s.phase === 'exchange' && !s.exchanges[0] ? p.hand : legalDiscards(s, 0), ids = playable.map(t => t.instanceId);
  const tiles = [...p.hand.filter(t => t.instanceId !== p.drawn), ...p.hand.filter(t => t.instanceId === p.drawn)];
  return { scene, players, player: players[0], hand: { playerId: 0, tiles: tiles.map(tile => ({ tile, drawn: tile.instanceId === p.drawn, playable: ids.includes(tile.instanceId), selected: selected.includes(tile.instanceId), riichiCandidate: false })), canDiscard: s.phase === 'turn' && ids.length > 0, playableTileInstanceIds: ids, selectedTileInstanceId: selected[0] ?? null, drawnTileInstanceId: p.drawn, riichiCandidateInstanceIds: [], kuikaeForbiddenTileIds: [] }, actions: legalActions(s, 0) };
}
export function xzInteraction(select: (id: string | null) => void, discard: (id: string) => void): TableInteractionActions { return { selectTile: select, discard }; }
/** Only common semantic events. Blood-battle scoring never enters Riichi yaku/settlement consumers. */
export function publishXzTransition(before: XzState, after: XzState): void {
  if (before.handNumber !== after.handNumber) return;
  for (const p of after.players) {
    const old = before.players[p.id];
    if (p.river.length > old.river.length && !before.pendingKong) {
      const tile = p.river[p.river.length - 1];
      presentationEventBus.publish({ type: 'tile_discarded', playerId: p.id, tile: { id: tile.id, red: false }, riverIndex: p.river.length - 1, isRiichiDiscard: false,
        handHistory: { preDiscardHand: old.hand, drawnTile: old.hand.find(t => t.instanceId === old.drawn) ?? null, discardedTile: tile, finalHand: p.hand, isTsumogiri: old.drawn === tile.instanceId } });
    }
    if (p.drawn && p.drawn !== old.drawn) presentationEventBus.publish({ type: 'tile_drawn', playerId: p.id });
    const meld = p.melds.find((m, i) => !old.melds[i] || m.tiles.length > old.melds[i].tiles.length);
    if (meld) presentationEventBus.publish({ type: 'meld_declared', playerId: p.id, meldType: meld.type, kanType: meld.kanType });
  }
}
