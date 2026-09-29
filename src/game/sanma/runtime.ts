import type { ModePolicy } from '../timeControl/matchRuntime';
import type { Clock } from '../timeControl/decisionClock';
import { applySanma, defaultSanmaAction, legalSanmaActions, participantId } from './engine';
import { SANMA_SEATS, type SanmaSeat, type SanmaState } from './types';
const seatFor = (id: string): SanmaSeat => Number(id.split(':')[1]) as SanmaSeat;
export const sanmaPolicy: ModePolicy<SanmaState> = {
  mode: 'sanma', handId: s => `sanma:${s.seed}:${s.roundSerial}`,
  decisions: s => s.phase === 'ended' ? [] : SANMA_SEATS.flatMap(seat => {
    if (!legalSanmaActions(s, seat).length) return [];
    return [{ key: `${s.roundSerial}:${s.phase === 'response' ? `r${s.response!.id}` : `t${s.turn}`}:${seat}`, participantId: participantId(seat),
      kind: s.phase === 'response' ? 'response' as const : 'turn' as const,
      budgetId: `${s.roundSerial}:t${s.turn}:${seat}` }];
  }),
  timeout: (s, d) => { const seat = seatFor(d.participantId), a = defaultSanmaAction(s, seat); return a ? applySanma(s, seat, a) : s; },
  automatic: (s, d, p) => {
    const seat = seatFor(d.participantId), legal = legalSanmaActions(s, seat), win = legal.find(a => a.type === 'ron' || a.type === 'tsumo');
    if (p.autoWin && win) return { state: applySanma(s, seat, win), source: 'auto-win' };
    if (p.suppressCalls && !win && s.phase === 'response') return { state: applySanma(s, seat, { type: 'pass' }), source: 'suppress-calls' };
    if (p.autoTsumogiri && s.phase === 'turn') { const a = defaultSanmaAction(s, seat); if (a) return { state: applySanma(s, seat, a), source: 'auto-tsumogiri' }; }
    return null;
  },
  // North / Kan (including immediate completion with no responders) suspend the original turn budget.
  suspend: (before, after, d) => before.phase === 'turn' && before.current === seatFor(d.participantId)
    && ['north', 'ankan', 'kakan'].includes(after.actions[after.actions.length - 1]?.action.type),
  isSuppressedCall: (before, after, id) => after !== before && after.actions[after.actions.length - 1]?.actor === seatFor(id)
    && ['pon', 'minkan', 'ankan', 'kakan'].includes(after.actions[after.actions.length - 1]?.action.type),
};
/** Injected into exactly the same runtime for test controls. Never installed into a formal match. */
export class SanmaTestClock implements Clock {
  private at = 0; private serial = 0; private timers = new Map<number, { at: number; callback: () => void }>();
  now = () => this.at;
  schedule = (callback: () => void, delay: number) => { const id = ++this.serial; this.timers.set(id, { at: this.at + delay, callback }); return id; };
  cancel = (id: unknown) => { this.timers.delete(id as number); };
  advance(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) throw new Error('测试时钟只能向前');
    const target = this.at + ms;
    for (let i = 0; i < 10000; i++) {
      const due = [...this.timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) { this.at = target; return; }
      this.at = due[1].at; this.timers.delete(due[0]); due[1].callback();
    }
    throw new Error('测试时钟触发防死锁保护');
  }
  get pending() { return this.timers.size; }
}
