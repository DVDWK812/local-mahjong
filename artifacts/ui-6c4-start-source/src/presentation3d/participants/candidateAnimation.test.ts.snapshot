import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { candidateSlots, CandidateAnimationTarget, candidateRiverOwns, candidateSourceHidden, confirmedCandidateDiscard, type CandidateDiscard, type CandidateFrame } from './candidateAnimation';
import { candidatePlan, candidateSourceWorld } from './CandidateDiscard3D';
import { concealedCandidateSource, participantHandTarget } from './participantLayout';
import { createSeventeenPresentationFixture } from '../../dev/seventeenPresentationFixtures';
import { discardCandidate, passSeventeenStepsRon } from '../../game/seventeenSteps';
import { TABLE_CAMERA } from '../camera/FixedTableCamera';
import { DEFAULT_HAND_PACK, getHandPack } from '../../hand/handPacks';
import { HandAnimationController } from '../../presentation/handAnimation/HandAnimationController';
import { HandAnimationConsumer } from '../../presentation/handAnimation/HandAnimationConsumer';
import { AnimationScheduler } from '../../presentation/animation/AnimationScheduler';
import { PresentationEventBus, type TileDiscardedPresentationEvent } from '../../presentation/PresentationEventBus';
import { PresentationPacingGate } from '../../presentation/pacing/PresentationPacingGate';
import { runPacedAutomaticAction } from '../../presentation/pacing/automaticActionPacing';
import { declareSeventeenStepsRon } from '../../game/seventeenSteps';
import { DEFAULT_PLAYER_SLOT_APPEARANCES, resolveHandPackForPlayer } from '../../presentation/appearance/playerSlotAppearance';
import { DEFAULT_APPEARANCE_SETTINGS } from '../../presentation/appearance/appearanceSettings';
import { candidateMotion } from './candidateMotion';
import { candidateRowSlots, candidateRows, concealedRemovalIndex } from './candidateRows';
import { concealedCandidateTargets } from './participantLayout';
import { readFileSync } from 'node:fs';

function setup() {
  const before = passSeventeenStepsRon(createSeventeenPresentationFixture('ron'), 0);
  const tile = before.players[0].discardCandidates[0];
  const after = discardCandidate(before, 0, tile.instanceId);
  const confirmed = confirmedCandidateDiscard(before, after, 0, tile.instanceId)!;
  const snapshot: CandidateDiscard = { session: 'one', playerId: 0, tile: confirmed, riverIndex: 0,
    river: after.players[0].discardedTiles, candidates: before.players[0].discardCandidates,
    source: { instanceId: tile.instanceId, row: 1, column: 1, rect: { left: 400, top: 590, width: 37, height: 52 } }, pack: DEFAULT_HAND_PACK };
  const event: TileDiscardedPresentationEvent = { eventId: 'discard:one', sequence: 1, type: 'tile_discarded', playerId: 0, tile, riverIndex: 0, isRiichiDiscard: true };
  return { before, after, snapshot, event };
}
afterEach(() => vi.useRealTimers());
describe('17-step candidate presentation', () => {
  it.each([21,20,19,17,12,11,10,5,4])('mirrors %i anonymous candidates without hidden identities or recentering', n => {
    const counts = candidateRows(n);
    expect(counts).toEqual({ outerCount: Math.min(11,n), innerCount: Math.max(0,n-11) });
    for (const seat of ['top','bottom'] as const) {
      const slots = candidateRowSlots(n,seat);
      expect(slots.filter(s=>s.outer)).toHaveLength(counts.outerCount);
      expect(slots.filter(s=>s.row===(seat==='top'?1:2))).toHaveLength(counts.outerCount);
      expect(Object.keys(slots[0]).sort()).toEqual(['column','outer','row']);
      const targets=concealedCandidateTargets(n,seat);
      expect(targets).toHaveLength(n);
      const outer=targets.find(t=>t.outer)!;
      const baseline=concealedCandidateTargets(21,seat).find(t=>t.outer)!;
      expect(outer.position).toEqual(baseline.position);
      if (n>11) expect(targets[concealedRemovalIndex(n)].outer).toBe(false);
      expect(JSON.stringify(targets)).not.toMatch(/instanceId|red|tileId|face/);
    }
  });
  it('keeps source/proxy within one CSS pixel and every phase boundary continuous, without stopping at grip→carry', () => {
    const camera=new PerspectiveCamera(TABLE_CAMERA.fov,1280/720,TABLE_CAMERA.near,TABLE_CAMERA.far);
    camera.position.set(...TABLE_CAMERA.position);camera.lookAt(...TABLE_CAMERA.target);camera.updateMatrixWorld();
    const {snapshot,event}=setup();
    const plan=candidatePlan({snapshot,event,phase:'grasp',progress:0},camera,{left:0,top:0,width:1280,height:720})!;
    const first=new Vector3(...candidateMotion(plan,'grasp',0).tilePosition).project(camera);
    expect(Math.hypot((first.x+1)*640-418.5,(1-first.y)*360-616)).toBeLessThanOrEqual(1);
    const phases=['approach','grasp','travel','release','retreat'] as const;
    for(let i=1;i<phases.length;i++) {
      const a=candidateMotion(plan,phases[i-1],1),b=candidateMotion(plan,phases[i],0);
      expect(new Vector3(...a.tilePosition).distanceTo(new Vector3(...b.tilePosition))).toBeLessThan(1e-9);
      expect(a.tileScale).toBeCloseTo(b.tileScale,10);
      expect(a.tileRotationX).toBeCloseTo(b.tileRotationX,10);
    }
    const at=new Vector3(...candidateMotion(plan,'grasp',1).tilePosition);
    const before=at.clone().sub(new Vector3(...candidateMotion(plan,'grasp',1-1/90).tilePosition));
    const after=new Vector3(...candidateMotion(plan,'travel',1/240).tilePosition).sub(at);
    expect(before.length()).toBeGreaterThan(0.01);
    expect(before.distanceTo(after)).toBeLessThan(0.002);
    expect(candidateMotion(plan,'release',0).tilePosition).toEqual(candidateMotion(plan,'retreat',0).tilePosition);
    expect(candidateMotion(plan,'release',0).tilePosition).toEqual(plan.destination);
  });
  it('has one visible owner and keeps the candidate snapshot until settled/released', () => {
    const {snapshot,event}=setup();
    for(const phase of ['approach','grasp','travel','release','retreat'] as const) {
      const frame={snapshot:{...snapshot,playerId:1 as const,candidateCount:12,candidates:[],source:undefined},event,phase,progress:0.5};
      const owners=[phase==='approach',candidateSourceHidden(frame),candidateRiverOwns(frame)];
      expect(owners.filter(Boolean)).toHaveLength(1);
      const count=candidateRiverOwns(frame)?11:frame.snapshot.candidateCount;
      expect(candidateRows(count).innerCount).toBe(phase==='retreat'?0:1);
    }
  });
  it('scopes wrapping and vertical scrolling to the fixed analysis panel without changing its width', () => {
    const css=readFileSync('src/presentation3d/participants/participantTable.css','utf8');
    expect(css).toContain('white-space: normal; overflow-wrap: anywhere;');
    expect(css).toContain('.seventeen-fixed-analysis .seventeen-analysis-scroll { overflow-x: hidden; overflow-y: auto; }');
    expect(css).toContain('--fixed-tile-width: clamp(49px, 3.2vw, 61px)');
    expect(css).toContain('grid-template-rows: repeat(2, calc(var(--fixed-tile-width) * 1.405))');
  });
  it.each([[21,10,11],[20,9,11],[17,6,11],[12,1,11],[11,0,11],[10,0,10],[4,0,4]])('packs %i without changing reading order', (n, top, bottom) => {
    const tiles = Array.from({ length: n }, (_, i) => ({ id: 4, instanceId: `same-face-${i}` }));
    const slots = candidateSlots(tiles);
    expect(slots.filter(s => s.row === 1)).toHaveLength(top);
    expect(slots.filter(s => s.row === 2)).toHaveLength(bottom);
    expect(slots.map(s => s.tile)).toEqual(tiles);
    expect(slots.filter(s => s.row === 2).map(s => s.column)).toEqual(Array.from({length: bottom}, (_, i) => i+1));
  });
  it('confirms only the exact successful candidate instance; fixed hand is immutable', () => {
    const { before, after, snapshot } = setup();
    expect(confirmedCandidateDiscard(before, before, 0, snapshot.tile.instanceId)).toBeNull();
    expect(confirmedCandidateDiscard(before, after, 0, before.players[0].fixedHand[0].instanceId)).toBeNull();
    expect(after.players.map(p => p.fixedHand)).toEqual(before.players.map(p => p.fixedHand));
    expect(after.players[0].fixedHand).toHaveLength(13);
  });
  it('projects either DOM row to exactly its source center and keeps the opponent off the fixed hand', () => {
    const camera = new PerspectiveCamera(TABLE_CAMERA.fov, 1280/720, TABLE_CAMERA.near, TABLE_CAMERA.far);
    camera.position.set(...TABLE_CAMERA.position); camera.lookAt(...TABLE_CAMERA.target); camera.updateMatrixWorld();
    const viewport = { left: 0, top: 0, width: 1280, height: 720 };
    for (const top of [590,650]) {
      const rect = {left:400,top,width:37,height:52};
      const world = candidateSourceWorld(rect,camera,viewport)!;
      const p = new Vector3(...world.position).project(camera);
      expect((p.x+1)*640).toBeCloseTo(418.5);
      expect((1-p.y)*360).toBeCloseTo(top+26);
      const {snapshot,event}=setup();
      expect(candidatePlan({snapshot,event,phase:'travel',progress:0.5},camera,viewport,rect)?.action.type).toBe('tile_discarded');
    }
    expect(concealedCandidateSource()).not.toEqual(participantHandTarget('duel','top',0,13).position);
  });
  it('holds the 12→11 snapshot/gap through release; river and repacking take ownership at retreat', () => {
    const {snapshot,event}=setup();
    const phases = ['approach','grasp','travel','release','retreat'] as const;
    for (const phase of phases) {
      const frame: CandidateFrame = {snapshot:{...snapshot,candidates:snapshot.candidates.slice(0,12)},event,phase,progress:0.5};
      expect(candidateRiverOwns(frame)).toBe(phase==='retreat');
      expect(candidateSourceHidden(frame)).toBe(['grasp','travel','release'].includes(phase));
      const shown = candidateRiverOwns(frame) ? frame.snapshot.candidates.slice(1) : frame.snapshot.candidates;
      expect(candidateSlots(shown).filter(s=>s.row===1)).toHaveLength(phase==='retreat'?0:1);
    }
  });
  it('uses the existing bus once, real phase tasks, and a pacing barrier through retract', async () => {
    vi.useFakeTimers();
    const {snapshot,event}=setup(); const gate=new PresentationPacingGate(); const frames: CandidateFrame[]=[];
    const target=new CandidateAnimationTarget(f=>{if(f)frames.push(f)},id=>gate.complete(id),async()=>{});
    const controller=new HandAnimationController(target,new AnimationScheduler(),{snapOnPlaybackChange:true});
    const bus=new PresentationEventBus();
    const sounds=vi.fn(); bus.subscribe(sounds);
    const consumer=new HandAnimationConsumer(controller,bus,()=>true,undefined,e=>e.type==='tile_discarded'&&target.matches(e)?e:undefined,gate);
    target.capture(snapshot);
    const published=bus.publish(event); target.prepared(published.eventId);
    const next=vi.fn(); const waiting=runPacedAutomaticAction(next,{gate});
    await vi.advanceTimersByTimeAsync(151);
    expect(target.frame?.phase).toBe('grasp'); expect(next).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(330);
    expect(target.frame?.phase).toBe('release'); expect(next).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(90);
    expect(target.frame?.phase).toBe('retreat'); expect(next).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(170); await waiting;
    expect(next).toHaveBeenCalledOnce(); expect(sounds).toHaveBeenCalledOnce();
    expect(target.frame).toBeNull(); expect(gate.pendingCount).toBe(0);
    expect(new Set(frames.map(f=>f.phase))).toEqual(new Set(['approach','grasp','travel','release','retreat']));
    consumer.dispose(); controller.dispose();
  });
  it('cancel during decode releases preparation immediately and stale completion cannot revive a frame', async () => {
    const {snapshot,event}=setup(); let decode!:()=>void;
    const gate=new PresentationPacingGate(); const target=new CandidateAnimationTarget(()=>{},id=>gate.complete(id),()=>new Promise<void>(r=>{decode=r}));
    const controller=new HandAnimationController(target,new AnimationScheduler(),{snapOnPlaybackChange:true});
    target.capture(snapshot); gate.begin(event); controller.enqueue(event); target.prepared(event.eventId);
    controller.cancelAll(); await controller.whenIdle(); expect(target.frame).toBeNull(); expect(gate.pendingCount).toBe(0);
    decode(); await Promise.resolve(); expect(target.frame).toBeNull(); controller.dispose();
  });
  it.each(['skip','speed','dispose'] as const)('%s releases source masks and pacing', async mode => {
    const {snapshot,event}=setup(); const gate=new PresentationPacingGate();
    const target=new CandidateAnimationTarget(()=>{},id=>gate.complete(id),async()=>{});
    const controller=new HandAnimationController(target,new AnimationScheduler(),{snapOnPlaybackChange:true});
    target.capture({...snapshot,pack:getHandPack('female')});gate.begin(event);controller.enqueue(event);
    if(mode==='skip')controller.setSkip(true);else if(mode==='speed')controller.setSpeed(2);else controller.dispose();
    await controller.whenIdle();expect(target.frame).toBeNull();expect(gate.pendingCount).toBe(0);controller.dispose();
  });
  it('keeps participant 1 on its own pack, independently of top/config slot 2', () => {
    const slots = { ...DEFAULT_PLAYER_SLOT_APPEARANCES,
      0: { ...DEFAULT_PLAYER_SLOT_APPEARANCES[0], handAppearance: 'female' as const },
      1: { ...DEFAULT_PLAYER_SLOT_APPEARANCES[1], handAppearance: 'male' as const } };
    expect(resolveHandPackForPlayer(0, slots, DEFAULT_APPEARANCE_SETTINGS).id).toBe('female');
    expect(resolveHandPackForPlayer(1, slots, DEFAULT_APPEARANCE_SETTINGS).id).toBe('male');
  });
  it('uses authoritative cross-row and final-turn fixtures, without changing either fixed hand', () => {
    for (const kind of ['cross-row', 'last-turn'] as const) {
      const before = createSeventeenPresentationFixture(kind);
      const after = discardCandidate(before, 0, before.players[0].discardCandidates[0].instanceId);
      expect(before.players[0].discardCandidates).toHaveLength(kind === 'cross-row' ? 12 : 5);
      expect(after.players[0].discardCandidates).toHaveLength(kind === 'cross-row' ? 11 : 4);
      expect(after.players.map(p => p.fixedHand)).toEqual(before.players.map(p => p.fixedHand));
      expect(after.scores).toEqual(before.scores);
    }
  });
  it('holds an existing authoritative ron response until release/retract completes', async () => {
    vi.useFakeTimers();
    const state = createSeventeenPresentationFixture('ron');
    const tile = state.players[1].discardedTiles[0];
    const gate = new PresentationPacingGate();
    const target = new CandidateAnimationTarget(() => {}, id => gate.complete(id), async () => {});
    const controller = new HandAnimationController(target, new AnimationScheduler());
    const { event, snapshot } = setup();
    const action: TileDiscardedPresentationEvent = { ...event, playerId: 1, tile };
    target.capture({ ...snapshot, playerId: 1, tile, candidates: [], source: undefined });
    gate.begin(action); controller.enqueue(action); target.prepared(action.eventId);
    const showResult = vi.fn(() => declareSeventeenStepsRon(state, 0).result);
    const completion = runPacedAutomaticAction(showResult, { gate });
    await vi.advanceTimersByTimeAsync(500);
    expect(target.frame?.phase).toBe('release'); expect(showResult).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300); await completion;
    expect(showResult).toHaveReturnedWith(declareSeventeenStepsRon(state, 0).result);
    controller.dispose();
  });
  it('fails open stalled prepare and ignores old-session callbacks after cancellation', async () => {
    vi.useFakeTimers(); const { snapshot, event } = setup(); const gate = new PresentationPacingGate();
    const target = new CandidateAnimationTarget(() => {}, id => gate.complete(id), () => new Promise(() => {}));
    const controller = new HandAnimationController(target, new AnimationScheduler());
    target.capture(snapshot); gate.begin(event); controller.enqueue(event);
    const waiting = gate.waitUntilClear().then(status => { if (status === 'timed-out') controller.cancelAll(); return status; });
    await vi.advanceTimersByTimeAsync(2501); expect(await waiting).toBe('timed-out');
    await controller.whenIdle(); expect(target.frame).toBeNull(); expect(gate.pendingCount).toBe(0);
    target.capture({ ...snapshot, session: 'two' }); target.prepared(event.eventId);
    expect(target.frame?.event).toBeUndefined(); expect(target.frame?.snapshot.session).toBe('two'); controller.dispose();
  });
  it('a rejected resource prepare releases input and its barrier', async () => {
    const { snapshot, event } = setup(); const gate = new PresentationPacingGate();
    const target = new CandidateAnimationTarget(() => {}, id => gate.complete(id), async () => { throw new Error('decode'); });
    const controller = new HandAnimationController(target, new AnimationScheduler(), { onError: () => target.clear() });
    target.capture(snapshot); gate.begin(event); controller.enqueue(event); target.prepared(event.eventId);
    await controller.whenIdle(); expect(target.frame).toBeNull(); expect(gate.pendingCount).toBe(0); controller.dispose();
  });
});
