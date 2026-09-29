import type { PlayerState } from '../../game/types';
import { sortTiles } from '../../game/tileUtils';
import { legalSanmaActions, participantId, nextSeat } from '../../game/sanma/engine';
import { handTiles, indicators, seatWind } from '../../game/sanma/scoring';
import type { SanmaSeat, SanmaState } from '../../game/sanma/types';
import type { TableParticipant } from '../../presentation3d/participants/participantPresentation';
import type { ParticipantSeat } from '../../presentation3d/participants/participantLayout';
import type { LocalHandPresentation, TableInteractionActions } from './TablePresentationContract';
import { presentationEventBus } from '../PresentationEventBus';

/** One mapping for all scene, HUD, interaction and animation consumers. */
export function sanmaSeatMapping(viewer: SanmaSeat): ParticipantSeat[] {
  return [viewer, nextSeat(viewer), nextSeat(nextSeat(viewer))].map((id, offset) => ({
    participantId: participantId(id), seat: (['bottom', 'right', 'top'] as const)[offset],
  }));
}
export const sanmaHudPosition = (seat: ParticipantSeat['seat']) => ({ bottom: 'south', right: 'east', top: 'north', left: 'west' } as const)[seat];

export function presentSanma(s: SanmaState, viewer: SanmaSeat = 0, selected: string | null = null, riichiChoosing = false, reveal = false) {
  const mapping = sanmaSeatMapping(viewer);
  const legal = legalSanmaActions(s, viewer), p = s.players[viewer];
  const players: PlayerState[] = s.players.map(p => ({ id: p.id, name: p.name, score: p.score, seatWind: seatWind(s, p.id), hand: handTiles(s, p.id).sort(sortTiles),
    drawnTile: p.drawn === null ? null : s.wall.tiles[p.drawn], river: p.river.map(r => ({ ...s.wall.tiles[r.index], claimed: r.claimed, isRiichiDiscard: r.riichi, isTsumogiri: r.tsumogiri })),
    calls: p.melds.map(m => ({ type: m.kind === 'pon' ? 'pon' : 'kan', tiles: m.tiles.map(i => s.wall.tiles[i]), from: m.from, opened: m.kind !== 'ankan', kanType: m.kind === 'pon' ? undefined : m.kind, calledTile: m.called === null ? undefined : s.wall.tiles[m.called] })),
    riichi: p.riichi, riichiState: p.riichi ? { kind: p.doubleRiichi ? 'double-riichi' : 'riichi', declaredAtTurn: 0, ippatsuAvailable: p.ippatsu } : null }));
  const participants: TableParticipant[] = s.players.map(p => ({ id: p.participantId, appearanceSlot: p.id, name: p.name, score: p.score,
    fixedHand: p.id === viewer || reveal ? { visibility: 'visible', tiles: players[p.id].hand } : { visibility: 'hidden', count: p.hand.length },
    discardCandidates: { visibility: 'hidden', count: 0 }, discardedTiles: players[p.id].river.filter(t => !t.claimed),
    seatWind: seatWind(s, p.id), riichi: p.riichi, north: p.north.map(i => s.wall.tiles[i]),
    publicMelds: p.melds.map(m => {
      const added = m.kind === 'kakan' ? m.tiles[m.tiles.length - 1] : null;
      // Resolve real identities first; only display directions use the four physical anchors.
      const positions = { bottom: 0, right: 1, top: 2, left: 3 };
      const actorSeat = mapping.find(entry => entry.participantId === p.participantId)!.seat;
      const sourceSeat = mapping.find(entry => entry.participantId === participantId(m.from))!.seat;
      const direction = (positions[sourceSeat] - positions[actorSeat] + 4) % 4;
      const base = m.tiles.filter(i => i !== m.called && i !== added), calledSlot = direction === 1 ? 2 : direction === 2 ? 1 : 0;
      if (m.called !== null) base.splice(calledSlot, 0, m.called);
      if (added !== null) base.push(added);
      return { kind: m.kind, tiles: base.map((index, n) => ({ tile: s.wall.tiles[index], faceDown: m.kind === 'ankan' && (n === 0 || n === 3),
        sideways: index === m.called, stacked: index === added, stackSlot: calledSlot })) };
    }),
  }));
  const riichiIds = legal.flatMap(a => a.type === 'riichi' ? [a.tile] : []), playable = legal.flatMap(a => a.type === (riichiChoosing ? 'riichi' : 'discard') && 'tile' in a ? [a.tile] : []);
  const hand: LocalHandPresentation = { playerId: viewer, tiles: players[viewer].hand.map(tile => ({ tile, drawn: p.drawn !== null && tile.instanceId === s.wall.tiles[p.drawn].instanceId,
    selected: tile.instanceId === selected, playable: playable.includes(tile.instanceId), riichiCandidate: riichiChoosing && riichiIds.includes(tile.instanceId) })),
    canDiscard: playable.length > 0, playableTileInstanceIds: playable, selectedTileInstanceId: selected, drawnTileInstanceId: p.drawn === null ? null : s.wall.tiles[p.drawn].instanceId,
    riichiCandidateInstanceIds: riichiChoosing ? riichiIds : [], kuikaeForbiddenTileIds: p.forbiddenDiscard === null ? [] : [p.forbiddenDiscard] };
  return { participants, mapping, players, player: players[viewer], hand, legal, dora: indicators(s) };
}
export function sanmaInteraction(selectTile: (id: string | null) => void, discard: (id: string) => void): TableInteractionActions { return { selectTile, discard }; }

/** Called only for new authoritative live transitions. Restore/replay never republishes history. */
export function publishSanmaTransition(before: SanmaState, after: SanmaState, northSources?: ReadonlyMap<string, import('../handAnimation/DiscardSourceSnapshot').PresentationRect>, sessionId = `sanma:${before.seed}`): void {
  if (before.roundSerial !== after.roundSerial) return;
  for (const event of after.events.slice(before.events.length)) {
    const playerId = event.actor, p = after.players[playerId];
    if (event.type === 'north-declared') presentationEventBus.publish({ type: 'north_declared', playerId, declarationId: `${sessionId}:${event.round}:${event.id}:north` });
    if (event.type === 'draw') presentationEventBus.publish({ type: 'tile_drawn', playerId });
    if (event.type === 'discard') {
      const r = p.river.find(r => r.index === event.tile)!, tile = after.wall.tiles[r.index];
      presentationEventBus.publish({ type: 'tile_discarded', playerId, tile, riverIndex: p.river.indexOf(r), isRiichiDiscard: r.riichi,
        handHistory: { preDiscardHand: handTiles(before, playerId).sort(sortTiles), drawnTile: before.players[playerId].drawn === null ? null : before.wall.tiles[before.players[playerId].drawn!], discardedTile: tile, finalHand: handTiles(after, playerId).sort(sortTiles), isTsumogiri: r.tsumogiri } });
    }
    if (event.type === 'riichi') presentationEventBus.publish({ type: 'riichi_declared', playerId, riverIndex: p.river.length - 1, kind: p.doubleRiichi ? 'double-riichi' : 'riichi' });
    if (event.type === 'pon' || event.type === 'kan') {
      const meld = p.melds.find(m => event.tile !== undefined && m.tiles.includes(event.tile));
      presentationEventBus.publish({ type: 'meld_declared', playerId, meldType: event.type === 'pon' ? 'pon' : 'kan', kanType: meld?.kind === 'pon' ? undefined : meld?.kind });
    }
    // Only a committed extraction animates. A pending/robbed declaration remains in hand.
    if (event.type === 'north' && event.tile !== undefined) {
      const sorted = handTiles(before, playerId).sort(sortTiles), tile = after.wall.tiles[event.tile];
      const drawnId = before.players[playerId].drawn === null ? undefined : before.wall.tiles[before.players[playerId].drawn!].instanceId;
      const tiles = [...sorted.filter(t => t.instanceId !== drawnId), ...sorted.filter(t => t.instanceId === drawnId)];
      presentationEventBus.publish({ type: 'north_committed', playerId, tile, sourceIndex: tiles.findIndex(t => t.instanceId === tile.instanceId), sourceCount: tiles.length, sourceRect: northSources?.get(tile.instanceId) });
    }
    if (event.type === 'settlement' && after.result?.kind === 'win') for (const win of after.result.winners) {
      if (after.result.reason === '流局满贯') continue;
      const winType = win.from === null ? 'tsumo' : 'ron';
      presentationEventBus.publish({ type: 'win_declared', playerId: win.winner, winType });
      presentationEventBus.publish({ type: 'win_scored', winnerId: win.winner, winType, yakuIds: win.score.yaku.map(y => y.id),
        yaku: win.score.yaku.map(y => ({ id: y.id, sourceTile: y.sourceTile, han: y.han, yakuman: !!y.yakuman })), limitTier: win.score.limitTier, yakumanMultiplier: win.score.yakumanMultiplier, totalDora: win.score.totalDora });
    }
    if (event.type === 'settlement' && after.result?.kind === 'exhaustive') presentationEventBus.publish({ type: 'round_settled', settlementType: 'exhaustive-draw', activePlayerIds: [0, 1, 2], tenpaiPlayers: after.result.tenpai, notenPlayers: [0, 1, 2].filter(id => !after.result!.tenpai.includes(id as SanmaSeat)) as SanmaSeat[] });
    if (event.type === 'settlement' && after.result?.kind === 'abort') presentationEventBus.publish({ type: 'round_settled', settlementType: 'abortive-draw', reason: after.result.reason === '九种九牌' ? 'kyuushu-kyuuhai' : 'suukan-sanra', triggeringPlayerId: after.current });
  }
}
