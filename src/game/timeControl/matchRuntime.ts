import { DecisionClock, monotonicClock, type Clock, type ClockSnapshot, type Decision, type DecisionSpec } from './decisionClock';
import { snapshotTimeControl, unlimitedTimeControl, type MatchMode, type TimeControlConfig } from './config';

export interface AutoPreferences { autoWin: boolean; suppressCalls: boolean; autoTsumogiri: boolean }
export const emptyPreferences = (): AutoPreferences => ({ autoWin: false, suppressCalls: false, autoTsumogiri: false });
export type ActionSource = 'manual' | 'ai-policy' | 'timeout' | 'auto-win' | 'suppress-calls' | 'auto-tsumogiri' | 'selection-timeout';
export interface ActionAudit {
  schemaVersion: 1; sequence: number; decisionId: string; participantId: string; source: ActionSource;
  policyVersion: 'infra-v1'; baseUsedMs: number; bankUsedMs: number; lagMs: number; terminal: boolean;
}
export interface RuntimeSave {
  schemaVersion: 1; config: TimeControlConfig; clock: ClockSnapshot;
  preferences: Record<string, AutoPreferences>; audit: ActionAudit[];
  draftRevisions?: Record<string, number>;
}
export interface ModePolicy<S> {
  mode: MatchMode;
  handId(state: S): string;
  resourceKey?(state: S): string;
  decisions(state: S): DecisionSpec[];
  timeout(state: S, decision: Decision): S;
  automatic(state: S, decision: Decision, preferences: AutoPreferences): { state: S; source: ActionSource } | null;
  /** Own Kan is a new step in the SAME budget. */
  suspend?(before: S, after: S, decision: Decision): boolean;
  editable?(state: S, decision: Decision): boolean;
  isSuppressedCall?(before: S, after: S, participantId: string): boolean;
}
// Initial resources gate input; never add a cosmetic thinking-time delay.
export const INPUT_TRANSITION_MS = 0;
/** One owner of current Rules state. React receives immutable snapshots only. */
export class MatchRuntime<S> {
  state: S;
  readonly time: DecisionClock;
  readonly config: TimeControlConfig;
  readonly preferences: Record<string, AutoPreferences> = {};
  readonly audit: ActionAudit[] = [];
  readonly draftRevisions: Record<string, number> = {};
  error: string | null = null;
  private active = false;
  private pausedAt: number | null = null;
  private started = false;
  private disposed = false;
  private running = false;
  private listeners = new Set<() => void>();
  private openListeners = new Set<() => void>();
  private commands = new Set<string>();
  private restoreData?: RuntimeSave;
  private commandSequence = 0;
  private auditUsage = new Map<string, { base: number; bank: number }>();
  private readyResources = new Set<string>();
  private prepared = new Map<string, { receivedAt: number; reduce: (state: S) => S }>();
  /** Accept a computed policy choice before presentation waits. The Match deadline
   * commits it if pacing is still blocked; it must never substitute timeout play. */
  preparePolicyCommand(participantId: string, reduce: (state: S) => S): { commit: () => void; cancel: () => void } | null {
    const d = this.decision(participantId);
    if (!this.active || this.disposed || this.error || !d || this.time.clock.now() < d.opensAt || this.time.expired(d)) { this.evaluate(); return null; }
    const entry = { receivedAt: this.time.clock.now(), reduce };
    this.prepared.set(d.id, entry);
    return {
      commit: () => {
        if (this.prepared.get(d.id) !== entry || !this.time.isCurrent(d)) return;
        this.command(participantId, d.id, reduce, undefined, undefined, 'ai-policy');
      },
      cancel: () => { if (this.prepared.get(d.id) === entry) this.prepared.delete(d.id); },
    };
  }
  constructor(state: S, readonly policy: ModePolicy<S>, config = unlimitedTimeControl(policy.mode), clock: Clock = monotonicClock,
    readonly transitionMs = INPUT_TRANSITION_MS, save?: RuntimeSave, private readonly requireResources = false) {
    this.state = state;
    this.config = snapshotTimeControl(save?.config ?? config, policy.mode);
    this.time = new DecisionClock(this.config, clock, () => this.evaluate(), () => this.openListeners.forEach(fn => fn()));
    this.restoreData = save;
  }
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  onInputOpen = (listener: () => void): (() => void) => { this.openListeners.add(listener); return () => this.openListeners.delete(listener); };
  private emit(): void { this.listeners.forEach(fn => fn()); }
  /** Resource readiness activates once. Remounting never creates fresh budgets. Headless callers activate directly. */
  activate(): void {
    if (this.disposed || this.error) return;
    const key = this.policy.resourceKey?.(this.state) ?? this.policy.handId(this.state);
    const newlyReady = !this.readyResources.has(key);
    this.readyResources.add(key);
    if (this.active) { if (newlyReady) { this.sync(); this.evaluate(); } return; }
    this.active = true;
    this.pausedAt = null;
    this.started = true;
    if (this.restoreData) {
      if (this.restoreData.schemaVersion !== 1) { this.fail('不支持的运行存档版本'); return; }
      try {
        this.time.restore({ ...this.restoreData.clock, decisions: this.restoreData.clock.decisions.map(d => ({ ...d, openingMs: Math.min(d.openingMs, this.transitionMs) })) });
      } catch (error) { this.fail(String(error)); return; }
      Object.assign(this.preferences, this.restoreData.preferences);
      Object.assign(this.draftRevisions, this.restoreData.draftRevisions);
      this.audit.splice(0, this.audit.length, ...this.restoreData.audit);
      this.restoreData = undefined;
    }
    this.sync(); this.time.start(); this.evaluate(); this.emit();
  }
  resourcesReady(): void {
    if (!this.started) { this.activate(); return; }
    if (!this.active || this.disposed || this.error) return;
    const key = this.policy.resourceKey?.(this.state) ?? this.policy.handId(this.state);
    if (this.readyResources.has(key)) return;
    this.readyResources.add(key); this.sync(); this.evaluate();
  }
  /** Effect reattachment (including StrictMode) resumes only an already-started session. */
  resumeAfterRemount(): void { if (this.started && this.paused) this.activate(); }
  decision(participantId: string): Decision | undefined { return this.time.decisions.get(participantId); }
  get paused(): boolean { return this.pausedAt !== null; }
  budgetView(participantId: string) { const d = this.decision(participantId); return d ? this.time.view(d, this.pausedAt ?? this.time.clock.now()) : null; }
  preference(participantId: string): AutoPreferences { return this.preferences[participantId] ??= emptyPreferences(); }
  setPreference(participantId: string, key: keyof AutoPreferences, value: boolean): void {
    this.evaluate();
    if (!this.active || this.disposed || this.error) return;
    if (this.policy.mode === 'seventeen' && key !== 'autoWin') return;
    this.preference(participantId)[key] = value; this.evaluate(); this.emit();
  }
  /** Receipt and reduction are synchronous: no React queue can move a pre-deadline command past its deadline. */
  command(participantId: string, decisionId: string | undefined, reduce: (state: S) => S,
    commandId = `manual-${++this.commandSequence}`, expectedDraftRevision?: number, source: 'manual' | 'ai-policy' = 'manual'): boolean {
    if (!this.active || this.disposed || this.error || this.commands.has(commandId)) return false;
    const receivedAt = this.time.clock.now();
    const d = this.decision(participantId);
    if (!d || d.id !== decisionId || receivedAt < d.opensAt) return false;
    this.commands.add(commandId);
    if (this.time.expired(d, receivedAt)) { this.evaluate(); return false; }
    if (expectedDraftRevision !== undefined && expectedDraftRevision !== (this.draftRevisions[participantId] ?? 0)) return false;
    const before = this.state;
    let next: S;
    try { next = reduce(before); } catch (error) { this.fail(error instanceof Error ? error.message : String(error)); return false; }
    if (next === before) return false;
    if (this.preference(participantId).suppressCalls && this.policy.isSuppressedCall?.(before, next, participantId)) return false;
    if (this.policy.editable?.(before, d)) this.draftRevisions[participantId] = (this.draftRevisions[participantId] ?? 0) + 1;
    this.apply(next, d, source, source === 'ai-policy' ? this.prepared.get(d.id)?.receivedAt ?? receivedAt : receivedAt);
    this.evaluate(); return true;
  }
  /** Existing AI/draw/round-transition producers enter the same synchronous owner. */
  advance(reduce: (state: S) => S): void {
    if (this.disposed || this.error || (this.started && !this.active)) return;
    this.evaluate();
    const next = reduce(this.state);
    if (next === this.state) return;
    this.state = next; this.sync(); this.evaluate(); this.emit();
  }
  private sync(): void {
    if (!this.active) return;
    const handId = this.policy.handId(this.state);
    if (handId !== this.time.handId) {
      this.time.newHand(handId); this.commands.clear();
      Object.values(this.preferences).forEach(p => { p.autoTsumogiri = false; });
      this.time.start();
    }
    const resourceKey = this.policy.resourceKey?.(this.state) ?? handId;
    const specs = this.requireResources && !this.readyResources.has(resourceKey) ? [] : this.policy.decisions(this.state);
    for (const d of [...this.time.decisions.values()]) if (!specs.some(s => s.participantId === d.participantId && s.key === d.key)) this.time.close(d);
    for (const spec of specs) this.time.open(spec, this.transitionMs);
    for (const id of this.prepared.keys()) if (![...this.time.decisions.values()].some(d => d.id === id)) this.prepared.delete(id);
  }
  private apply(next: S, d: Decision, source: ActionSource, at: number): void {
    this.prepared.delete(d.id); // Other responders retain their own decision-bound choices.
    const before = this.state;
    const nextSpec = this.policy.decisions(next).find(s => s.participantId === d.participantId);
    const suspend = this.policy.suspend?.(before, next, d) ?? false;
    const terminal = nextSpec?.key !== d.key || suspend;
    const v = this.time.view(d, at);
    if (terminal) this.time.close(d, at, suspend);
    // Draft edits and Ron→call share their existing decision and budget.
    const previousUsage = this.auditUsage.get(d.id) ?? { base: 0, bank: 0 };
    const usage = { base: d.baseMs === null ? 0 : d.baseMs - (v.baseMs ?? 0), bank: d.bankMs - v.bankMs };
    if (!this.policy.editable?.(before, d) || terminal) {
      this.auditUsage.set(d.id, usage);
      this.audit.push({ schemaVersion: 1, sequence: this.audit.length + 1,
      decisionId: d.id, participantId: d.participantId, source, policyVersion: 'infra-v1',
      baseUsedMs: usage.base - previousUsage.base, bankUsedMs: usage.bank - previousUsage.bank,
      lagMs: v.deadline === null ? 0 : Math.max(0, at - v.deadline), terminal });
    }
    this.state = next; this.sync(); this.emit();
  }
  evaluate(): void {
    if (!this.active || this.disposed || this.error || this.running) return;
    this.running = true;
    try {
      this.time.announceOpen();
      // A bounded loop allows Ron Pass → call Pass at the SAME deadline without granting time.
      for (let step = 0; step < 16; step++) {
        let changed = false;
        for (const d of [...this.time.decisions.values()]) {
          if (!this.time.isCurrent(d) || this.time.clock.now() < d.opensAt) continue;
          const at = this.time.clock.now();
          const expired = this.time.expired(d, at);
          const prepared = this.prepared.get(d.id);
          const chosen = expired && prepared ? prepared.reduce(this.state) : this.state;
          const allowed = chosen !== this.state && !(this.preference(d.participantId).suppressCalls && this.policy.isSuppressedCall?.(this.state, chosen, d.participantId));
          const result = expired && allowed ? { state: chosen, source: 'ai-policy' as const } : expired ? { state: this.policy.timeout(this.state, d), source: d.kind === 'selection' ? 'selection-timeout' as const : 'timeout' as const }
            : this.policy.automatic(this.state, d, this.preference(d.participantId));
          if (!result) continue;
          if (result.state === this.state) { if (expired) throw new Error('到期决策没有合法终结动作'); continue; }
          this.apply(result.state, d, result.source, result.source === 'ai-policy' ? prepared!.receivedAt : at); changed = true;
        }
        if (!changed) break;
        if (step === 15) throw new Error('自动策略超过单次推进上限');
      }
    } catch (error) { this.fail(error instanceof Error ? error.message : String(error)); }
    finally { this.running = false; if (!this.error) this.time.arm(); this.emit(); }
  }
  snapshot(): RuntimeSave { if (!this.active && this.restoreData) return this.restoreData; return { schemaVersion: 1, config: this.config, clock: this.time.snapshot(),
    preferences: structuredClone(this.preferences), audit: [...this.audit], draftRevisions: { ...this.draftRevisions } }; }
  pause(): RuntimeSave { if (!this.active && this.restoreData) return this.restoreData; this.evaluate(); const save = this.snapshot(); this.pausedAt = this.time.clock.now(); this.active = false; this.time.stop(); this.restoreData = save; this.emit(); return save; }
  dispose(): void { this.disposed = true; this.active = false; this.time.stop(); this.listeners.clear(); this.openListeners.clear(); }
  private fail(message: string): void { this.error = message; this.time.stop(); this.emit(); }
}
