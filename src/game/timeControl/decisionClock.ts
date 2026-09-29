import type { TimeControlConfig } from './config';

export interface Clock {
  now(): number;
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}
export const monotonicClock: Clock = {
  now: () => performance.now(),
  schedule: (callback, delay) => setTimeout(callback, delay),
  cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
export interface DecisionSpec { key: string; participantId: string; kind: 'turn' | 'response' | 'selection'; budgetId: string; preparation?: 'exchange' | 'missing' }
export interface Decision extends DecisionSpec {
  id: string; generation: number; opensAt: number; baseMs: number | null; bankMs: number; startedAt: number;
}
export interface BudgetView { baseMs: number | null; bankMs: number; elapsedMs: number; deadline: number | null; status: 'scheduled' | 'open' }
export interface ClockSnapshot {
  schemaVersion: 1; handId: string; banks: Record<string, number>;
  decisions: Array<DecisionSpec & { baseMs: number | null; bankMs: number; openingMs: number }>;
  suspended: Record<string, { baseMs: number | null; bankMs: number }>;
}
let epoch = 0;
/** Owns only budgets, never Mahjong state. Timers wake this authority; they do not count ticks. */
export class DecisionClock {
  readonly epoch = ++epoch;
  readonly decisions = new Map<string, Decision>();
  readonly banks = new Map<string, number>();
  private suspended = new Map<string, { baseMs: number | null; bankMs: number }>();
  private generation = 0;
  private timer: unknown = null;
  private live = false;
  private opened = new Set<string>();
  handId = '';
  constructor(readonly config: TimeControlConfig, readonly clock: Clock = monotonicClock,
    private readonly wake: () => void = () => {}, private readonly onOpen: () => void = () => {}) {}
  start(): void { this.live = true; this.arm(); }
  stop(): void { this.live = false; if (this.timer !== null) this.clock.cancel(this.timer); this.timer = null; }
  get activeTimerCount(): number { return this.timer === null ? 0 : 1; }
  newHand(handId: string): void {
    if (handId === this.handId) return;
    this.stop(); this.handId = handId; this.decisions.clear(); this.suspended.clear(); this.banks.clear(); this.opened.clear(); ++this.generation;
  }
  open(spec: DecisionSpec, transitionMs = 0): Decision {
    const current = this.decisions.get(spec.participantId);
    if (current?.key === spec.key) return current;
    if (current) this.close(current, this.clock.now());
    const bank = this.banks.get(spec.participantId) ?? (this.config.turn.kind === 'banked' ? this.config.turn.bankPerHandMs : 0);
    this.banks.set(spec.participantId, bank);
    const saved = this.suspended.get(spec.budgetId);
    this.suspended.delete(spec.budgetId);
    const selection = spec.preparation ? this.config.preparation?.[spec.preparation] : this.config.seventeenSelection;
    const baseMs = spec.kind === 'selection'
      ? selection?.kind === 'fixed' ? selection.durationMs : null
      : saved ? saved.baseMs : this.config.turn.kind === 'banked' ? this.config.turn.decisionBaseMs : null;
    const now = this.clock.now();
    const decision: Decision = { ...spec, id: `${this.epoch}/d${++this.generation}`, generation: this.generation,
      opensAt: now + transitionMs, startedAt: now + transitionMs, baseMs, bankMs: spec.kind === 'selection' ? 0 : bank };
    this.decisions.set(spec.participantId, decision); this.arm(); return decision;
  }
  view(decision: Decision, at = this.clock.now()): BudgetView {
    const elapsedMs = Math.max(0, at - decision.startedAt);
    const base = decision.baseMs;
    return { baseMs: base === null ? null : Math.max(0, base - elapsedMs),
      bankMs: base === null ? decision.bankMs : Math.max(0, decision.bankMs - Math.max(0, elapsedMs - base)), elapsedMs,
      deadline: base === null ? null : decision.startedAt + base + decision.bankMs,
      status: at < decision.opensAt ? 'scheduled' : 'open' };
  }
  isCurrent(decision: Decision): boolean { return this.decisions.get(decision.participantId)?.id === decision.id; }
  expired(decision: Decision, at = this.clock.now()): boolean { const deadline = this.view(decision, at).deadline; return deadline !== null && at >= deadline; }
  close(decision: Decision, at = this.clock.now(), suspend = false): BudgetView {
    const view = this.view(decision, at);
    if (!this.isCurrent(decision)) return view;
    if (decision.kind !== 'selection') this.banks.set(decision.participantId, view.bankMs);
    if (suspend) this.suspended.set(decision.budgetId, { baseMs: view.baseMs, bankMs: view.bankMs });
    this.decisions.delete(decision.participantId); this.opened.delete(decision.id); this.arm(); return view;
  }
  /** Called before policy evaluation, including on background resume and commands. */
  announceOpen(): void {
    let changed = false;
    for (const d of this.decisions.values()) if (this.clock.now() >= d.opensAt && !this.opened.has(d.id)) { this.opened.add(d.id); changed = true; }
    if (changed) this.onOpen();
  }
  snapshot(): ClockSnapshot {
    return { schemaVersion: 1, handId: this.handId, banks: Object.fromEntries(this.banks), suspended: Object.fromEntries(this.suspended),
      decisions: [...this.decisions.values()].map(d => { const v = this.view(d); return { key: d.key, participantId: d.participantId, kind: d.kind, budgetId: d.budgetId,
        baseMs: v.baseMs, bankMs: v.bankMs, openingMs: Math.max(0, d.opensAt - this.clock.now()) }; }) };
  }
  restore(snapshot: ClockSnapshot): void {
    if (snapshot.schemaVersion !== 1) throw new Error('不支持的计时存档版本');
    const valid = (n: number | null) => n === null || (Number.isFinite(n) && n >= 0 && n <= 3_600_000);
    if (!Object.values(snapshot.banks).every(n => n !== null && valid(n)) || !snapshot.decisions.every(d => valid(d.baseMs) && d.bankMs !== null && valid(d.bankMs) && d.openingMs !== null && valid(d.openingMs))
      || !Object.values(snapshot.suspended).every(b => valid(b.baseMs) && b.bankMs !== null && valid(b.bankMs))) throw new Error('计时存档预算损坏');
    this.stop(); this.decisions.clear(); this.banks.clear(); this.opened.clear();
    this.handId = snapshot.handId;
    for (const [id, bank] of Object.entries(snapshot.banks)) this.banks.set(id, bank);
    this.suspended = new Map(Object.entries(snapshot.suspended));
    const now = this.clock.now();
    for (const d of snapshot.decisions) this.decisions.set(d.participantId, { ...d, id: `${this.epoch}/d${++this.generation}`,
      generation: this.generation, opensAt: now + d.openingMs, startedAt: now + d.openingMs });
  }
  arm(): void {
    if (this.timer !== null) this.clock.cancel(this.timer); this.timer = null;
    if (!this.live) return;
    const now = this.clock.now();
    const times = [...this.decisions.values()].flatMap(d => {
      if (now < d.opensAt) return [d.opensAt];
      const deadline = this.view(d, now).deadline; return deadline === null ? [] : [deadline];
    });
    if (!times.length) return;
    const version = this.generation;
    const handle = this.clock.schedule(() => {
      if (!this.live || version !== this.generation || this.timer !== handle) return;
      this.timer = null; this.wake(); this.arm();
    }, Math.max(0, Math.min(...times) - now));
    this.timer = handle;
  }
}
