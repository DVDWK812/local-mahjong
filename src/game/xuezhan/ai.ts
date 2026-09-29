import type { AIPlayerSetting } from '../../components/MatchSettings';
import type { CallSet, Tile } from '../types';
import { standardShanten } from '../shanten';
import { completeExchange, defaultAction, legalActions, seededRandom } from './engine';
import { suitOf } from './scoring';
import type { XzRules } from './config';
import type { Seat, XzAction, XzState } from './types';
export interface XzObservation {
  seat: Seat; seed: number; sequence: number; phase: XzState['phase']; rules: XzRules;
  hand: Tile[]; melds: CallSet[]; missing: number | null; publicTiles: Tile[]; opponents: Array<{ seat: Seat; won: boolean; meldCount: number; missing: number | null }>;
  legal: XzAction[]; fallback: XzAction | null;
}
/** No wall, other concealed hands, concealed kong identities, or private preparation selections. */
export function observeXz(s: XzState, seat: Seat): XzObservation {
  const p = s.players[seat];
  return structuredClone({ seat, seed: s.seed, sequence: s.sequence, phase: s.phase, rules: s.config.rules, hand: p.hand, melds: p.melds, missing: p.missing,
    publicTiles: s.players.flatMap(other => [...other.river.filter(t => !t.claimed), ...other.melds.filter(m => other.id === seat || m.kanType !== 'ankan').flatMap(m => m.tiles)]),
    opponents: s.players.filter(other => other.id !== seat).map(other => ({ seat: other.id, won: other.won !== null, meldCount: other.melds.length, missing: other.missing })),
    legal: s.phase === 'exchange' && !s.exchanges[seat] ? [{ type: 'exchange', tiles: completeExchange(s, seat) }] : legalActions(s, seat), fallback: defaultAction(s, seat) });
}
function shapeValue(hand: Tile[], melds: CallSet[], advanced: boolean, seven: boolean): number {
  const counts = Array(27).fill(0) as number[]; hand.forEach(t => counts[t.id]++);
  let value = counts.reduce((n, c, id) => n + (c >= 3 ? 9 : c === 2 ? 5 : 0) + (id % 9 < 8 && c && counts[id + 1] ? 2 : 0) + (id % 9 < 7 && c && counts[id + 2] ? 1 : 0), 0);
  if (advanced) {
    const normal = standardShanten([...hand, ...melds.flatMap(m => m.tiles.slice(0, 3))]);
    const pairs = counts.reduce((n, c) => n + Math.floor(c / 2), 0);
    value -= Math.min(normal, !melds.length && seven ? 6 - pairs : 8) * 30;
  }
  return value;
}
export function chooseXzAction(o: XzObservation, settings: Pick<AIPlayerSetting, 'difficulty' | 'personality'>): XzAction | null {
  const win = o.legal.find(a => a.type === 'win'); if (win) return win;
  if (o.phase === 'exchange' || o.phase === 'missing') return o.fallback;
  const random = seededRandom(o.seed ^ o.sequence * 7919 ^ o.seat * 31);
  const level = ['chikukon', 'shintentai', 'upper', 'kishin'].indexOf(settings.difficulty);
  const kan = o.legal.find(a => a.type === 'kan');
  if (kan && (settings.personality !== 'defensive' || o.melds.length < 2 || random() < 0.25)) return kan;
  const pon = o.legal.find(a => a.type === 'pon');
  if (pon && (settings.personality === 'aggressive' || settings.personality === 'balanced' && random() < 0.65 || settings.personality === 'defensive' && random() < 0.2)) return pon;
  if (o.phase === 'response') return o.legal.find(a => a.type === 'pass') ?? o.fallback;
  const discards = o.legal.filter((a): a is Extract<XzAction, { type: 'discard' }> => a.type === 'discard');
  const suitCounts = [0, 1, 2].map(suit => o.hand.filter(t => suitOf(t.id) === suit).length + o.melds.flatMap(m => m.tiles).filter(t => suitOf(t.id) === suit).length * 3);
  const target = o.rules.missing === 'declared' ? o.missing : [0, 1, 2].sort((a, b) => suitCounts[a] - suitCounts[b] || a - b)[0];
  return discards.map(a => {
    const tile = o.hand.find(t => t.instanceId === a.tile)!;
    const remaining = o.hand.filter(t => t.instanceId !== a.tile);
    const safety = o.publicTiles.filter(t => t.id === tile.id).length + o.opponents.filter(p => !p.won && p.missing === suitOf(tile.id)).length;
    const noise = random() * [25, 8, 2, 0.1][level];
    const defensive = settings.personality === 'defensive' ? 5 : settings.personality === 'balanced' ? 1 : -0.5;
    const value = shapeValue(remaining, o.melds, level >= 2, o.rules.patterns.sevenPairs.enabled) + (suitOf(tile.id) === target ? 120 : 0) + safety * defensive + noise;
    return { a, value };
  }).sort((a, b) => b.value - a.value || a.a.tile.localeCompare(b.a.tile))[0]?.a ?? o.fallback;
}
