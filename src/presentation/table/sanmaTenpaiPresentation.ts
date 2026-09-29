import type { SanmaState, SanmaSeat } from '../../game/sanma/types';
import { waitsFor, furiten, scoreSanma, indicators } from '../../game/sanma/scoring';
import { tileLabel } from '../../game/tileUtils';
import type { TenpaiDisplay } from '../../game/tenpaiDisplay';
/** Public information only; wait and scoring decisions remain in the sanma rules. */
export function sanmaTenpaiDisplay(state: SanmaState, seat: SanmaSeat, discard?: string | null): TenpaiDisplay | null {
  if (state.phase === 'ended') return null;
  const original = state.players[seat];
  const discardIndex = discard ? original.hand.find(i => state.wall.tiles[i].instanceId === discard) : undefined;
  const hand = original.hand.filter(i => i !== discardIndex);
  if (hand.length % 3 !== 1) return null;
  const s = { ...state, players: state.players.map(p => p.id === seat ? { ...p, hand, drawn: null } : p) };
  const waits = waitsFor(s, seat); if (!waits.length) return null;
  const isFuriten = furiten(s, seat);
  const visible = new Set([...original.hand, ...state.players.flatMap(p => [...p.river.filter(r => !r.claimed).map(r => r.index), ...p.melds.flatMap(m => m.tiles), ...p.north])]);
  indicators(state).forEach(t => visible.add(state.wall.tiles.findIndex(candidate => candidate.instanceId === t.instanceId)));
  const rows = waits.map(id => ({ id, label: tileLabel(id), remaining: Math.max(0, 4 - [...visible].filter(i => state.wall.tiles[i].id === id).length), furiten: isFuriten,
    status: isFuriten ? original.permanentFuriten ? 'permanent-furiten' as const : 'furiten' as const : scoreSanma(s, seat, state.wall.tiles.findIndex(t => t.id === id), 'discard') ? 'winnable' as const : 'no-yaku' as const }));
  return { waits: rows, totalRemaining: rows.reduce((n, r) => n + r.remaining, 0), currentFuriten: isFuriten, currentFuritenLabel: isFuriten ? original.permanentFuriten ? '永久振听' : '当前振听' : null,
    previewDiscardLabel: discardIndex === undefined ? undefined : tileLabel(state.wall.tiles[discardIndex]) };
}
