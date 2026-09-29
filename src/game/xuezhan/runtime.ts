import type { ModePolicy } from '../timeControl/matchRuntime';
import { applyXz, defaultAction, legalActions, participantId, SEATS } from './engine';
import type { Seat, XzState } from './types';
const seatFrom = (id: string): Seat => Number(id.split(':')[1]) as Seat;
export const xzPolicy: ModePolicy<XzState> = {
  mode: 'xuezhan', handId: s => `xz:${s.seed}:${s.handNumber}`,
  decisions: s => SEATS.flatMap(seat => {
    if (s.phase === 'ended' || !legalActions(s, seat).length) return [];
    const preparation = s.phase === 'exchange' || s.phase === 'missing' ? s.phase : undefined;
    const key = preparation ? `${s.handNumber}:${preparation}` : s.phase === 'response' ? `${s.handNumber}:r${s.response!.id}` : `${s.handNumber}:t${s.turn}`;
    return [{ key: `${key}:${seat}`, participantId: participantId(seat), kind: preparation ? 'selection' as const : s.phase === 'response' ? 'response' as const : 'turn' as const,
      budgetId: `${s.handNumber}:${seat}`, ...(preparation ? { preparation } : {}) }];
  }),
  timeout: (s, d) => { const seat = seatFrom(d.participantId), a = defaultAction(s, seat); return a ? applyXz(s, seat, a) : s; },
  automatic: (s, d, preferences) => {
    const seat = seatFrom(d.participantId), legal = legalActions(s, seat);
    const win = legal.find(a => a.type === 'win');
    if (preferences.autoWin && win) return { state: applyXz(s, seat, win), source: 'auto-win' };
    if (preferences.suppressCalls && !win && s.phase === 'response') return { state: applyXz(s, seat, { type: 'pass' }), source: 'suppress-calls' };
    if (preferences.autoTsumogiri && s.phase === 'turn' && s.current === seat) { const a = defaultAction(s, seat); if (a) return { state: applyXz(s, seat, a), source: 'auto-tsumogiri' }; }
    return null;
  },
  editable: s => s.phase === 'exchange',
  suspend: (before, after, d) => before.phase === 'turn' && before.current === seatFrom(d.participantId) && (after.pendingKong !== null || after.lastKong !== null && before.lastKong?.id !== after.lastKong.id),
  isSuppressedCall: (before, after, id) => {
    const seat = seatFrom(id), action = after.actions[after.actions.length - 1];
    return after !== before && action?.seat === seat && ['kan', 'pon'].includes(action.action.type);
  },
};
