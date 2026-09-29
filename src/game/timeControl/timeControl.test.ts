import { describe, expect, it, vi } from 'vitest';
import { defaultTimeControl, loadTimeDraft, snapshotTimeControl, unlimitedTimeControl } from './config';
import { DecisionClock, type Clock } from './decisionClock';
import { MatchRuntime, type ModePolicy } from './matchRuntime';
import { createInitialGameState, discardTile, passRon } from '../engine';
import { executeKan, passChankan } from '../kanChecker';
import { executePon } from '../callChecker';
import type { GameState, TileId } from '../types';
import { canTsumo } from '../winChecker';
import { migrateSavedMatch } from '../persistence/migration';
import { sampleSavedMatch } from '../persistence/saveTestUtils';
import { sampleMatchLog } from '../replay/replayTestUtils';
import { createReplay, seekToEvent } from '../replay/replayEngine';
import { validateSavedMatch } from '../persistence/storageValidation';
import { fourPlayerPolicy, FOUR_HUMAN, canonicalLegalTile } from './fourPlayerPolicy';
import { createSeventeenPolicy, completeSelection, SEVENTEEN_HUMAN } from './seventeenPolicy';
import { createSeventeenStepsGame, selectFixedTile, confirmBuild, discardCandidate, passSeventeenStepsRon } from '../seventeenSteps';
import { createTile } from '../tileUtils';

export class FakeClock implements Clock {
  value = 0; next = 0; jobs = new Map<number, { at: number; callback: () => void }>();
  now = () => this.value;
  schedule = (callback: () => void, delayMs: number) => { const id = ++this.next; this.jobs.set(id, { at: this.value + delayMs, callback }); return id; };
  cancel = (handle: unknown) => { this.jobs.delete(handle as number); };
  advance(ms: number, late = false) {
    const end = this.value + ms;
    for (let n = 0; n < 100; n++) {
      const entry = [...this.jobs].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) { this.value = end; return; }
      this.jobs.delete(entry[0]); this.value = late ? end : entry[1].at; entry[1].callback();
    }
    throw new Error('unbounded timer');
  }
}
const spec = (key = 'turn1', participantId = 'human') => ({ key, participantId, kind: 'turn' as const, budgetId: key });
describe('versioned time control', () => {
  it('new selection drafts use minute presets while legacy runtime snapshots remain valid', () => {
    for (const durationMs of [60000, 120000, 180000, 300000]) {
      const config = { ...defaultTimeControl('seventeen'), seventeenSelection: { kind: 'fixed', durationMs } };
      expect(loadTimeDraft('seventeen', { getItem: () => JSON.stringify(config) }).seventeenSelection).toEqual(config.seventeenSelection);
    }
    const legacy = { ...defaultTimeControl('seventeen'), seventeenSelection: { kind: 'fixed', durationMs: 5000 } };
    expect(loadTimeDraft('seventeen', { getItem: () => JSON.stringify(legacy) }).seventeenSelection).toEqual({ kind: 'fixed', durationMs: 120000 });
    expect(snapshotTimeControl(legacy, 'seventeen').seventeenSelection).toEqual(legacy.seventeenSelection);
  });
  it('freezes a copy and keeps selection out of four-player config', () => {
    const config = defaultTimeControl('four'); expect(Object.isFrozen(config.turn)).toBe(true);
    expect(() => snapshotTimeControl(defaultTimeControl('seventeen'), 'four')).toThrow();
    expect(unlimitedTimeControl('four').turn.kind).toBe('unlimited');
  });
  it.each([0, -1, NaN, Infinity, 300001, '5000', null])('rejects invalid base %s', value => {
    expect(() => snapshotTimeControl({ schemaVersion: 1, turn: { kind: 'banked', decisionBaseMs: value, bankPerHandMs: 0 } }, 'four')).toThrow();
  });
  it('accepts zero bank but rejects a zero selection budget', () => {
    expect(snapshotTimeControl({ schemaVersion: 1, turn: { kind: 'banked', decisionBaseMs: 1, bankPerHandMs: 0 } }, 'four').turn.kind).toBe('banked');
    expect(() => snapshotTimeControl({ ...defaultTimeControl('seventeen'), seventeenSelection: { kind: 'fixed', durationMs: 0 } }, 'seventeen')).toThrow();
  });
});
describe('authority budgets and lifecycle', () => {
  it('spends base first, does not accumulate unused base, restores base each independent decision', () => {
    const f = new FakeClock(); const c = new DecisionClock(defaultTimeControl('four'), f); c.newHand('h1');
    let d = c.open(spec()); f.advance(3000); c.close(d); expect(c.banks.get('human')).toBe(20000);
    d = c.open(spec('turn2')); f.advance(8000); c.close(d); expect(c.banks.get('human')).toBe(17000);
    d = c.open(spec('turn3')); expect(c.view(d).baseMs).toBe(5000);
    f.advance(50000); c.close(d); expect(c.banks.get('human')).toBe(0);
    expect(c.open(spec('turn4')).baseMs).toBe(5000);
    c.newHand('h2'); expect(c.open(spec()).bankMs).toBe(20000);
  });
  it('submenus preserve identity, kan suspends remaining budget and waiting costs nothing', () => {
    const f = new FakeClock(); const c = new DecisionClock(defaultTimeControl('four'), f); c.newHand('h');
    const d = c.open(spec()); f.advance(8000); expect(c.open(spec())).toBe(d);
    c.close(d, f.now(), true); f.advance(60000);
    const resumed = c.open({ ...spec('rinshan'), budgetId: d.budgetId });
    expect(c.view(resumed)).toMatchObject({ baseMs: 0, bankMs: 17000 });
  });
  it('independent participant windows do not invalidate one another', () => {
    const f = new FakeClock(); const c = new DecisionClock(defaultTimeControl('four'), f); c.newHand('h');
    const a = c.open(spec('response', 'a')); const b = c.open(spec('response', 'b'));
    f.advance(8000); c.close(a); expect(c.isCurrent(b)).toBe(true); f.advance(1000); c.close(b);
    expect(c.banks.get('a')).toBe(17000); expect(c.banks.get('b')).toBe(16000);
  });
  it('saves relative budgets and recreates epoch without refilling', () => {
    const f = new FakeClock(); const c = new DecisionClock(defaultTimeControl('four'), f); c.newHand('h'); c.open(spec()); f.advance(8000);
    const saved = JSON.parse(JSON.stringify(c.snapshot())); const f2 = new FakeClock(); f2.value = 800000;
    const restored = new DecisionClock(defaultTimeControl('four'), f2); restored.restore(saved);
    expect(restored.epoch).not.toBe(c.epoch); expect(restored.view(restored.decisions.get('human')!)).toMatchObject({ baseMs: 0, bankMs: 17000 });
    expect(JSON.stringify(saved)).not.toContain('deadline');
  });
});
type Fixture = { hand: string; n: number; ended: boolean };
const policy: ModePolicy<Fixture> = { mode: 'four', handId: s => s.hand, decisions: s => s.ended ? [] : [spec(`turn${s.n}`)],
  timeout: s => ({ ...s, n: s.n + 1, ended: true }), automatic: () => null };
describe('serial runtime', () => {
  it.each([24999, 25000, 25001])('receipt at %d ms: one terminal action', received => {
    const f = new FakeClock(); const r = new MatchRuntime({ hand: 'h', n: 0, ended: false }, policy, defaultTimeControl('four'), f, 0); r.activate();
    const id = r.decision('human')!.id; f.value = received;
    expect(r.command('human', id, s => ({ ...s, ended: true, n: 7 }), 'one')).toBe(received < 25000);
    expect(r.command('human', id, s => ({ ...s, n: 99 }), 'one')).toBe(false);
    expect(r.audit.filter(a => a.terminal)).toHaveLength(1); expect(r.audit[0].source).toBe(received < 25000 ? 'manual' : 'timeout');
    expect(r.state.n).toBe(received < 25000 ? 7 : 1);
  });
  it('authoritative transition does not spend human time and needs no UI/animation', () => {
    const f = new FakeClock(); const r = new MatchRuntime({ hand: 'h', n: 0, ended: false }, policy, defaultTimeControl('four'), f, 2500); r.activate();
    const id = r.decision('human')!.id; f.advance(2499);
    expect(r.command('human', id, s => ({ ...s, ended: true }))).toBe(false);
    expect(r.time.view(r.decision('human')!).baseMs).toBe(5000);
    f.advance(25001); expect(r.state.ended).toBe(true); expect(f.jobs.size).toBe(0);
  });
  it('default resource-ready input opens immediately without an artificial countdown prelude', () => {
    const f = new FakeClock(); const r = new MatchRuntime({ hand: 'h', n: 0, ended: false }, policy, defaultTimeControl('four'), f, undefined, undefined, true);
    f.advance(60000); expect(r.decision('human')).toBeUndefined();
    r.resourcesReady(); const d = r.decision('human')!;
    expect(d.opensAt).toBe(f.now()); expect(r.budgetView('human')).toMatchObject({ status: 'open', baseMs: 5000, bankMs: 20000 });
    expect(r.command('human', d.id, s => ({ ...s, n: 1 }))).toBe(true);
    f.advance(1); expect(r.budgetView('human')?.baseMs).toBe(4999); r.dispose();
  });
  it('restoring an older preparation window does not reintroduce a cosmetic delay or refill budgets', () => {
    const f = new FakeClock(); const state = { hand: 'h', n: 0, ended: false };
    const old = new MatchRuntime(state, policy, defaultTimeControl('four'), f, 2500); old.activate();
    const saved = old.pause(); expect(saved.clock.decisions[0].openingMs).toBe(2500);
    const restored = new MatchRuntime(state, policy, defaultTimeControl('four'), f, undefined, saved, true);
    restored.resourcesReady(); expect(restored.budgetView('human')).toMatchObject({ status: 'open', baseMs: 5000, bankMs: 20000 });
    expect(restored.command('human', restored.decision('human')!.id, s => ({ ...s, ended: true }))).toBe(true);
    restored.dispose(); old.dispose();
  });
  it('stale callbacks and commands cannot affect a new hand or a disposed session', () => {
    const f = new FakeClock(); const r = new MatchRuntime({ hand: 'h', n: 0, ended: false }, policy, defaultTimeControl('four'), f, 0); r.activate();
    const old = r.decision('human')!.id; const callback = [...f.jobs.values()][0].callback;
    r.advance(s => ({ ...s, hand: 'next' })); callback();
    expect(r.command('human', old, s => ({ ...s, ended: true }))).toBe(false);
    r.dispose(); callback(); f.advance(100000); expect(r.state.ended).toBe(false); expect(f.jobs.size).toBe(0);
  });
  it('pause/resume never refills and repeated activation does not reset', () => {
    const f = new FakeClock(); const r = new MatchRuntime({ hand: 'h', n: 0, ended: false }, policy, defaultTimeControl('four'), f, 0); r.activate();
    f.advance(8000); r.activate(); const save = r.pause(); f.advance(60000); r.activate();
    expect(r.time.view(r.decision('human')!)).toMatchObject({ baseMs: 0, bankMs: 17000 });
    expect(save.clock.decisions[0].bankMs).toBe(17000); r.dispose(); expect(f.jobs.size).toBe(0);
  });
  it('late wake caps bank debit and records lag', () => {
    const f = new FakeClock(); const r = new MatchRuntime({ hand: 'h', n: 0, ended: false }, policy, defaultTimeControl('four'), f, 0); r.activate();
    f.advance(90000, true); expect(r.audit[0]).toMatchObject({ bankUsedMs: 20000, baseUsedMs: 5000, lagMs: 65000 });
  });
});
describe('mode policies', () => {
  it('discards true red drawn instance after hand sorting', () => {
    const s = createInitialGameState(); const drawn = { ...createTile(4, 0), red: true };
    s.players[0].hand = [drawn, ...s.players[0].hand.filter(t => t.id !== 4).slice(0, 12), createTile(33, 0)]; s.players[0].drawnTile = drawn;
    const f = new FakeClock(); const r = new MatchRuntime(s, fourPlayerPolicy, defaultTimeControl('four'), f, 0); r.activate(); f.advance(25000);
    expect(r.state.players[0].river[0]).toMatchObject({ instanceId: drawn.instanceId, red: true, isTsumogiri: true });
  });
  it('canonical order chooses last type, non-red, then ascending instance', () => {
    const red = { ...createTile(31, 0), red: true }; const a = { ...createTile(31, 1), instanceId: 'a' }; const b = { ...createTile(31, 2), instanceId: 'b' };
    expect(canonicalLegalTile([red, b, createTile(5, 0), a])).toBe(a);
  });
  it('missing drawn tile in an ordinary turn is controlled error, not a random discard', () => {
    const s = createInitialGameState(); s.players[0].drawnTile = null;
    const f = new FakeClock(); const r = new MatchRuntime(s, fourPlayerPolicy, defaultTimeControl('four'), f, 0); r.activate(); f.advance(25000);
    expect(r.error).toContain('缺失'); expect(r.state).toBe(s); expect(f.jobs.size).toBe(0);
  });
  it.each(Array.from({ length: 8 }, (_, n) => n))('automatic preference combination %d respects true draw', n => {
    const s = createInitialGameState(); s.players[0].hand = [createTile(0, 0), createTile(8, 0)]; s.players[0].drawnTile = s.players[0].hand[0];
    const f = new FakeClock(); const r = new MatchRuntime(s, fourPlayerPolicy, unlimitedTimeControl('four'), f, 0);
    r.preferences[FOUR_HUMAN] = { autoWin: !!(n & 1), suppressCalls: !!(n & 2), autoTsumogiri: !!(n & 4) }; r.activate();
    // Activation/new hand resets tsumogiri. The explicit command applies to this current window.
    r.setPreference(FOUR_HUMAN, 'autoTsumogiri', !!(n & 4));
    expect(r.state.players[0].river.length).toBe(n & 4 ? 1 : 0); r.dispose();
  });
  it('17-step selection completes deterministically, preserves draft and bank, then only discards candidates', () => {
    let s = createSeventeenStepsGame(); s = selectFixedTile(s, 0, s.players[0].sourceTiles[20].instanceId);
    const selected = s.players[0].fixedHand[0].instanceId;
    const f = new FakeClock(); const r = new MatchRuntime(s, createSeventeenPolicy(), defaultTimeControl('seventeen'), f, 0); r.activate(); f.advance(120000);
    expect(r.state.phase).toBe('active'); expect(r.state.players[0].fixedHand.some(t => t.instanceId === selected)).toBe(true);
    expect(r.time.banks.get(SEVENTEEN_HUMAN)).toBe(20000); const fixed = r.state.players[0].fixedHand;
    r.setPreference(SEVENTEEN_HUMAN, 'autoTsumogiri', true); expect(r.preference(SEVENTEEN_HUMAN).autoTsumogiri).toBe(false);
    f.advance(25000); expect(r.state.players[0].fixedHand).toEqual(fixed); expect(r.state.players[0].discardCandidates).toHaveLength(20); r.dispose();
  });
  it('selection completion distinguishes invalid pool, exhausted budget, and no completion', () => {
    const s = createSeventeenStepsGame(); expect(completeSelection(s, [], 0)).toEqual({ kind: 'failed', reason: 'budget-exhausted' });
    s.players[0].sourceTiles = []; expect(completeSelection(s)).toEqual({ kind: 'failed', reason: 'no-completion' });
    const duplicate = createTile(0, 0); s.players[0].sourceTiles = [duplicate, duplicate]; expect(completeSelection(s)).toEqual({ kind: 'failed', reason: 'invalid-pool' });
  });
  it('last legal selection wins over incomplete edits; confirmation ends selection without transferring time', () => {
    let s = createSeventeenStepsGame(); for (const t of s.players[0].sourceTiles.slice(0, 13)) s = selectFixedTile(s, 0, t.instanceId);
    const ids = s.players[0].fixedHand.map(t => t.instanceId); const f = new FakeClock(); const r = new MatchRuntime(s, createSeventeenPolicy(), defaultTimeControl('seventeen'), f, 0); r.activate();
    const d = r.decision(SEVENTEEN_HUMAN)!; r.command(SEVENTEEN_HUMAN, d.id, current => selectFixedTile(current, 0, ids[0]));
    f.advance(120000); expect(r.state.players[0].fixedHand.map(t => t.instanceId).sort()).toEqual(ids.sort()); expect(r.audit[0].source).toBe('selection-timeout'); r.dispose();
  });
  it('illegal duplicate/foreign 13 tiles cannot confirm', () => {
    const s = createSeventeenStepsGame(); s.players[0].fixedHand = Array(13).fill(s.players[0].sourceTiles[0]); expect(confirmBuild(s, 0)).toBe(s);
  });
  it('17-step 17 discards preserve fixed 13 and leave exactly four candidates', () => {
    let s = createSeventeenStepsGame(); for (const t of s.players[0].sourceTiles.slice(0, 13)) s = selectFixedTile(s, 0, t.instanceId); s = confirmBuild(s, 0);
    const fixed = s.players.map(p => [...p.fixedHand]);
    for (let n = 0; n < 34 && s.phase === 'active'; n++) {
      const id = s.currentPlayerId; s = discardCandidate(s, id, s.players[id].discardCandidates[0].instanceId);
      if (s.phase === 'ron-window') s = passSeventeenStepsRon(s, s.pendingRon!.winnerId);
    }
    expect(s.players.map(p => p.fixedHand)).toEqual(fixed);
    expect(s.phase).toBe('round-ended'); expect(s.players.map(p => p.discardCandidates.length)).toEqual([4, 4]);
  });
});

function hand(s: GameState, player: number, ids: number[]) {
  s.players[player].hand = ids.map((id, i) => createTile(id as TileId, i % 4));
  s.players[player].drawnTile = null;
  return s;
}
function fixture(): GameState {
  const s = createInitialGameState();
  for (let p = 0; p < 4; p++) hand(s, p, [0, 2, 4, 6, 8, 10, 12, 16, 18, 20, 22, 24, 26]);
  s.wall = [createTile(3, 0), createTile(7, 0), createTile(8, 0), createTile(9, 0)];
  s.deadWall = Array.from({ length: 14 }, (_, i) => createTile((i + 8) as TileId, 0));
  s.doraIndicators = [s.deadWall[4]]; s.firstTurnInterrupted = true;
  return s;
}
describe('rules integration boundaries', () => {
  it('effect reattachment resumes started sessions without bypassing first resource readiness', () => {
    const f = new FakeClock(); const r = new MatchRuntime({ hand: 'h', n: 0, ended: false }, policy, defaultTimeControl('four'), f, 0, undefined, true);
    r.pause(); r.resumeAfterRemount(); f.advance(60000); expect(r.time.decisions.size).toBe(0);
    r.resourcesReady(); f.advance(8000); r.pause(); f.advance(60000); r.resumeAfterRemount();
    expect(r.budgetView('human')).toMatchObject({ baseMs: 0, bankMs: 17000 });
    f.advance(17000); expect(r.state.ended).toBe(true); r.dispose();
  });
  it('old saves resume unlimited and replay never schedules authority timers', () => {
    const save = migrateSavedMatch(sampleSavedMatch()); const f = new FakeClock();
    const r = new MatchRuntime(save.gameState!, fourPlayerPolicy, undefined, f, 0, save.timeRuntime); r.activate();
    expect(r.config.turn.kind).toBe('unlimited'); expect(f.jobs.size).toBe(0);
    const timer = vi.spyOn(globalThis, 'setTimeout');
    try {
      const log = { ...sampleMatchLog(), timeControl: defaultTimeControl('four'), actionAudit: [] };
      expect(seekToEvent(createReplay(log), 999).controller.status).toBe('ended'); expect(timer).not.toHaveBeenCalled();
    } finally { timer.mockRestore(); r.dispose(); }
  });
  it('corrupt runtime budgets are rejected by existing save validation', () => {
    const save = sampleSavedMatch(); const f = new FakeClock(); const r = new MatchRuntime(save.gameState!, fourPlayerPolicy, defaultTimeControl('four'), f, 0); r.activate();
    save.timeRuntime = r.snapshot(); save.timeRuntime.clock.decisions[0].bankMs = -1;
    expect(() => validateSavedMatch(save)).toThrow('预算损坏'); r.dispose();
  });
  it('stale draft versions and duplicate confirmation cannot modify a locked selection', () => {
    const s = createSeventeenStepsGame(); const f = new FakeClock(); const r = new MatchRuntime(s, createSeventeenPolicy(), defaultTimeControl('seventeen'), f, 0); r.activate();
    const id = r.decision(SEVENTEEN_HUMAN)!.id;
    expect(r.command(SEVENTEEN_HUMAN, id, current => selectFixedTile(current, 0, s.players[0].sourceTiles[0].instanceId), 'draft1', 0)).toBe(true);
    expect(r.command(SEVENTEEN_HUMAN, id, current => selectFixedTile(current, 0, s.players[0].sourceTiles[1].instanceId), 'stale', 0)).toBe(false);
    f.advance(120000); expect(r.command(SEVENTEEN_HUMAN, id, current => confirmBuild(current, 0), 'confirm')).toBe(false); expect(r.state.players[0].buildConfirmed).toBe(true); r.dispose();
  });
  it('failed preparation stops without scoring, redealing, or leaving a timer', () => {
    const s = createSeventeenStepsGame(); s.players[0].sourceTiles = [];
    const f = new FakeClock(); const r = new MatchRuntime(s, createSeventeenPolicy(), defaultTimeControl('seventeen'), f, 0); r.activate(); f.advance(120000);
    expect(r.error).toContain('preparation-failed'); expect(r.state).toBe(s); expect(r.state.result).toBeNull(); expect(f.jobs.size).toBe(0);
  });
  it('resource-ready notifications cannot undo explicit save pause', () => {
    const f = new FakeClock(); const r = new MatchRuntime({ hand: 'h', n: 0, ended: false }, policy, defaultTimeControl('four'), f, 0);
    r.resourcesReady(); f.advance(8000); const saved = r.pause(); r.resourcesReady(); f.advance(60000);
    r.advance(current => ({ ...current, ended: true }));
    expect(r.paused).toBe(true); expect(r.budgetView('human')).toMatchObject({ baseMs: 0, bankMs: 17000 });
    expect(r.state.ended).toBe(false); expect(r.snapshot()).toEqual(saved); expect(f.jobs.size).toBe(0); r.activate();
    expect(r.paused).toBe(false);
    expect(r.time.view(r.decision('human')!)).toMatchObject({ baseMs: 0, bankMs: 17000 }); r.dispose();
  });
  it('same discarded tile shares Ron and Pon budget; timeout preserves temporary furiten then Passes calls', () => {
    let s = hand(fixture(), 0, [0, 1, 2, 9, 10, 11, 18, 19, 20, 5, 5, 5, 14]);
    const tile = createTile(5, 3);
    // Explicit legal response fixture; Rules remains the Pass side-effect owner.
    s.phase = 'ron-window'; s.currentPlayer = 1; s.lastDiscard = { player: 1, tile };
    s.pendingRon = { discarder: 1, tile, eligibleRonPlayers: [0], passedPlayers: [] };
    const f = new FakeClock(); const r = new MatchRuntime(s, fourPlayerPolicy, defaultTimeControl('four'), f, 0); r.activate();
    const d = r.decision(FOUR_HUMAN)!; f.advance(8000);
    r.command(FOUR_HUMAN, d.id, current => passRon(current, 0));
    expect(r.state.phase).toBe('call-window'); expect(r.decision(FOUR_HUMAN)?.id).toBe(d.id);
    expect(r.time.view(d).bankMs).toBe(17000); f.advance(17000);
    expect(r.state.pendingCall).toBeNull(); expect(r.state.players[0].furitenState?.temporaryFuriten).toBe(true);
    expect(r.audit.filter(a => a.terminal)).toHaveLength(1);
    expect(r.audit.reduce((n, a) => n + a.bankUsedMs, 0)).toBe(20000);
  });
  it('Pon starts fresh base without replenishing Bank, and timeout respects kuikae', () => {
    const s = hand(fixture(), 0, [33, 33, 33, 31, 30, 27, 0, 2, 4, 6, 8, 10, 12]);
    const tile = createTile(33, 3); s.phase = 'call-window'; s.currentPlayer = 1; s.lastDiscard = { player: 1, tile };
    s.pendingCall = { discarder: 1, tile, options: [{ type: 'pon', player: 0 }] }; s.players[1].river = [tile];
    const f = new FakeClock(); const r = new MatchRuntime(s, fourPlayerPolicy, defaultTimeControl('four'), f, 0); r.activate();
    f.advance(8000); r.command(FOUR_HUMAN, r.decision(FOUR_HUMAN)!.id, current => executePon(current, 0));
    expect(r.state.phase).toBe('discard'); expect(r.time.view(r.decision(FOUR_HUMAN)!)).toMatchObject({ baseMs: 5000, bankMs: 17000 });
    f.advance(22000); expect(r.state.players[0].river[0].id).toBe(31); expect(r.state.players[0].river[0].isTsumogiri).toBe(false);
  });
  it('own Ankan keeps the original budget despite changing dead wall', () => {
    const s = hand(fixture(), 0, [5, 5, 5, 5, 0, 2, 4, 6, 8, 10, 12, 16, 18, 20]);
    s.players[0].drawnTile = s.players[0].hand[13];
    const f = new FakeClock(); const r = new MatchRuntime(s, fourPlayerPolicy, defaultTimeControl('four'), f, 0); r.activate(); f.advance(8000);
    r.command(FOUR_HUMAN, r.decision(FOUR_HUMAN)!.id, current => executeKan(current, 0, 'ankan', 5));
    expect(r.state.lastDrawSource).toBe('rinshan'); expect(r.time.view(r.decision(FOUR_HUMAN)!)).toMatchObject({ baseMs: 0, bankMs: 17000 });
    f.advance(17000); expect(r.state.players[0].river).toHaveLength(1); expect(r.error).toBeNull();
  });
  it('own Kakan suspends for another player response then resumes the original budget', () => {
    const s = hand(fixture(), 0, [5, 0, 1, 2, 3, 4, 9, 10, 11, 18, 19]);
    hand(s, 1, [0, 1, 2, 9, 10, 11, 18, 19, 20, 3, 4, 14, 14]);
    const pon = [createTile(5, 0), createTile(5, 1), createTile(5, 2)];
    s.players[0].calls = [{ type: 'pon', tiles: pon, from: 3, opened: true, calledTile: pon[0] }]; s.players[0].drawnTile = s.players[0].hand[0];
    const f = new FakeClock(); const r = new MatchRuntime(s, fourPlayerPolicy, defaultTimeControl('four'), f, 0); r.activate(); f.advance(8000);
    r.command(FOUR_HUMAN, r.decision(FOUR_HUMAN)!.id, current => executeKan(current, 0, 'kakan', 5));
    expect(r.state.phase).toBe('chankan-window'); expect(r.decision(FOUR_HUMAN)).toBeUndefined(); f.advance(90000);
    r.advance(current => passChankan(current, 1));
    expect(r.time.view(r.decision(FOUR_HUMAN)!)).toMatchObject({ baseMs: 0, bankMs: 17000 }); r.dispose();
  });
  it.each(Array.from({ length: 8 }, (_, n) => n))('legal Tsumo priority for all preference combinations %d', n => {
    const s = hand(fixture(), 0, [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 14, 14]);
    s.players[0].drawnTile = s.players[0].hand[13]; expect(canTsumo(s, 0)).not.toBeNull();
    const f = new FakeClock(); const r = new MatchRuntime(s, fourPlayerPolicy, defaultTimeControl('four'), f, 0); r.activate();
    Object.assign(r.preference(FOUR_HUMAN), { autoWin: !!(n & 1), suppressCalls: !!(n & 2), autoTsumogiri: !!(n & 4) }); r.evaluate();
    if (n & 1) expect(r.state.result?.type).toBe('tsumo');
    else { expect(r.state).toBe(s); f.advance(25000); expect(r.state.players[0].river[0].instanceId).toBe(s.players[0].drawnTile!.instanceId); }
    r.dispose();
  });
  it('resource loading and draft remount do not consume time or create additional timers', () => {
    const f = new FakeClock(); const s = createSeventeenStepsGame();
    const r = new MatchRuntime(s, createSeventeenPolicy(), defaultTimeControl('seventeen'), f, 0, undefined, true);
    f.advance(500000); expect(r.time.decisions.size).toBe(0); r.activate(); f.advance(120000);
    expect(r.state.phase).toBe('active'); expect(r.time.decisions.size).toBe(0); f.advance(500000);
    r.activate(); expect(r.time.view(r.decision(SEVENTEEN_HUMAN)!)).toMatchObject({ baseMs: 5000, bankMs: 20000 }); r.dispose(); expect(f.jobs.size).toBe(0);
  });
});
