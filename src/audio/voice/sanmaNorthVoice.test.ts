import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceDirector } from './VoiceDirector';
import { VoicePresentationRuntime } from './VoicePresentationRuntime';
import { VOICE_PACK_REPOSITORY as repository } from './VoicePackRepository';
import { voiceEventFromPresentation } from './voiceEvents';
import { AudioManager } from '../AudioManager';
import { DEFAULT_AUDIO_SETTINGS } from '../audioSettings';
import type { AudioAssetDefinition } from '../audioRegistry';
import { presentationEventBus, type PresentationEvent } from '../../presentation/PresentationEventBus';
import { publishSanmaTransition, presentSanma } from '../../presentation/table/sanmaPresentation';
import { SANMA_CASES, loadSanmaCase } from '../../game/sanma/scenarios';
import { applySanma, legalSanmaActions } from '../../game/sanma/engine';
import { chooseSanmaAction, observeSanma } from '../../game/sanma/ai';
import { parseSanmaSave, saveSanma, replaySanma } from '../../game/sanma/persistence';
import { SANMA_SEATS, type SanmaSeat, type SanmaState, type SanmaAction } from '../../game/sanma/types';
import { MatchRuntime } from '../../game/timeControl/matchRuntime';
import { sanmaPolicy, SanmaTestClock } from '../../game/sanma/runtime';
const packs = ['xiaozhang', 'voice-20260821-001', 'yaya-001'] as const;
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); });
const fixture = (id: string) => loadSanmaCase(SANMA_CASES.find(c => c.caseId === id)!);
function harness(overrides = {}) {
  const created: Array<{ asset: AudioAssetDefinition; play: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; volume: number }> = [];
  const settings = { ...DEFAULT_AUDIO_SETTINGS, voiceEnabled: true, voiceVolume: .8, masterVolume: .5, ...overrides };
  const manager = new AudioManager(settings, { dispose() {}, createPlayback(asset) {
    const entry = { asset, play: vi.fn().mockResolvedValue(undefined), dispose: vi.fn(), volume: 0 }; created.push(entry);
    return { play: entry.play, pause() {}, dispose: entry.dispose, setVolume(v: number) { entry.volume = v; }, onEnded() { return () => {}; } };
  } });
  const director = new VoiceDirector(repository, manager, { ...settings, selectedVoicePackId: 'wrong-management-selection', voicePackBySeat: [...packs, null] });
  director.setActorSeatContext({ playerIds: [0, 1, 2], playerCount: 3 });
  const runtime = new VoicePresentationRuntime(director); runtime.start();
  const events: PresentationEvent[] = []; const off = presentationEventBus.subscribe(e => events.push(e));
  cleanups.push(() => { off(); director.stop(); runtime.dispose(); manager.dispose(); });
  const move = (s: SanmaState, seat: SanmaSeat, action: SanmaAction, session = 'voice-test') => {
    const next = applySanma(s, seat, action); publishSanmaTransition(s, next, undefined, session); return next;
  };
  const north = (s: SanmaState, seat: SanmaSeat, session?: string) => move(s, seat, legalSanmaActions(s, seat).find(a => a.type === 'north')!, session);
  return { created, director, runtime, events, move, north, manager, settings };
}
describe('authoritative Sanma declaration → existing nuki resource → shared Voice channel', () => {
  it.each(SANMA_SEATS)('player %i resolves its existing MP3 through the real repository', actor => {
    const h = harness(), s = fixture(`SM-04-VOICE-${actor}`);
    const action = actor === 0 ? legalSanmaActions(s, actor).find(a => a.type === 'north')! : chooseSanmaAction(observeSanma(s, actor), s.config.ai[actor - 1])!;
    expect(action.type).toBe('north'); h.move(s, actor, action);
    expect(repository.getPack(packs[actor])?.voiceAvailability['action.nuki'].status).toBe('available');
    expect(h.created).toHaveLength(1);
    expect(h.created[0].asset).toMatchObject({ channel: 'voice', src: repository.getAudioForKey(packs[actor], 'action.nuki') });
    expect(h.created[0].asset.src).toContain('action_nuki'); expect(h.created[0].play).toHaveBeenCalledOnce();
    expect(h.created[0].volume).toBeCloseTo(.4);
    expect(h.events.filter(e => e.type === 'north_declared')).toHaveLength(1);
    expect(h.events.filter(e => e.type === 'north_committed')).toHaveLength(1);
    expect(h.created[0].asset.id).toContain('action.nuki');
  });
  it('robbed declaration speaks before responses, then the real winner narrates ron', () => {
    const h = harness(); let s = h.north(fixture('SM-06-DOUBLE'), 0);
    expect(s.phase).toBe('response'); expect(h.created).toHaveLength(1);
    expect(h.events.some(e => e.type === 'north_committed')).toBe(false);
    s = h.move(s, 2, { type: 'ron' }); expect(h.created).toHaveLength(1);
    h.move(s, 1, { type: 'ron' });
    expect(h.events.findIndex(e => e.type === 'north_declared')).toBeLessThan(h.events.findIndex(e => e.type === 'win_scored'));
    expect(h.created[1].asset.src).toBe(repository.getAudioForKey(packs[1], 'action.ron'));
    expect(h.created[0].dispose).toHaveBeenCalledOnce();
    expect(h.events.filter(e => e.type === 'north_committed')).toHaveLength(0);
  });
  it('consecutive legal declarations differ, duplicate transitions and StrictMode subscription do not replay', () => {
    const h = harness(), initial = fixture('SM-04-CHAIN'); const next = h.north(initial, 0);
    h.runtime.stop(); h.runtime.start(); h.runtime.start();
    publishSanmaTransition(initial, next, undefined, 'voice-test');
    expect(h.created).toHaveLength(1); h.north(next, 0); expect(h.created).toHaveLength(2);
    expect(h.created[0].asset.id).not.toBe(h.created[1].asset.id);
    h.north(initial, 0, 'reset-session'); expect(h.created).toHaveLength(3);
    expect(h.runtime.activeVoiceConsumerSubscriptions).toBe(1);
  });
  it('illegal tile and stale/duplicate runtime commands produce no extra request', () => {
    const h = harness(), s = fixture('SM-04-NORTH'); h.move(s, 0, { type: 'north', tile: 'invalid' }); expect(h.created).toHaveLength(0);
    const r = new MatchRuntime(s, sanmaPolicy, s.config.time, new SanmaTestClock()); r.activate();
    const decision = r.decision('sanma:0')!, action = legalSanmaActions(s, 0).find(a => a.type === 'north')!;
    expect(r.command('sanma:0', decision.id, state => applySanma(state, 0, action), 'north-once')).toBe(true);
    publishSanmaTransition(s, r.state, undefined, 'runtime'); const before = r.state;
    expect(r.command('sanma:0', decision.id, state => applySanma(state, 0, action), 'north-once')).toBe(false);
    publishSanmaTransition(before, r.state, undefined, 'runtime'); expect(h.created).toHaveLength(1); r.dispose();
  });
  it('restore, seek, observer and dealer changes do not publish history or reassign voices', () => {
    const h = harness(), root = fixture('SM-15-RESTORE'), state = h.north(root, 0);
    const saved = parseSanmaSave(JSON.stringify(saveSanma(state, undefined, root, true)));
    for (const viewer of SANMA_SEATS) {
      presentSanma(saved.state, viewer); presentSanma({ ...saved.state, dealer: viewer }, viewer);
      replaySanma(saved, 0); replaySanma(saved); publishSanmaTransition(saved.state, saved.state);
    }
    expect(h.created).toHaveLength(1);
    const event = h.events.find(e => e.type === 'north_declared')!;
    expect(h.director.play(voiceEventFromPresentation(event)!)).toBe('ignored');
    h.north(fixture('SM-04-VOICE-2'), 2, 'new-game'); expect(h.created[1].asset.src).toBe(repository.getAudioForKey(packs[2], 'action.nuki'));
  });
  it.each([{ voiceEnabled: false }, { masterEnabled: false }, { masterVolume: 0 }, { voiceVolume: 0 }])('muting %j never queues old declarations for unmute', overrides => {
    const h = harness(overrides), s = fixture('SM-04-CHAIN'); const next = h.north(s, 0);
    expect(h.created).toHaveLength(0);
    const settings = { ...h.settings, voiceEnabled: true, masterEnabled: true, masterVolume: .5, voiceVolume: .8 };
    h.manager.setSettings(settings); h.director.setSettings({ ...settings, voicePackBySeat: [...packs, null] });
    publishSanmaTransition(s, next, undefined, 'voice-test'); expect(h.created).toHaveLength(0);
    h.north(next, 0); expect(h.created).toHaveLength(1);
  });
  it('active mute and exit dispose Voice handles and never revive late playback', async () => {
    const h = harness(); h.north(fixture('SM-04-NORTH'), 0);
    h.manager.setSettings({ ...h.settings, masterEnabled: false }); expect(h.created[0].dispose).toHaveBeenCalledOnce();
    h.director.stop(); h.runtime.stop(); h.manager.dispose(); await Promise.resolve();
    expect(h.created[0].play).toHaveBeenCalledOnce();
    h.north(fixture('SM-04-NORTH'), 0, 'after-exit'); expect(h.created).toHaveLength(1);
  });
  it('missing nuki keeps the existing missing policy with actionable actor/pack/key diagnosis', () => {
    const h = harness(); const director = new VoiceDirector({ listPacks: () => repository.listPacks(), getAudioForKey: () => undefined }, h.manager,
      { voiceEnabled: true, voiceVolume: .8, voicePackBySeat: [...packs, null] });
    director.setActorSeatContext({ playerIds: [0, 1, 2], playerCount: 3 });
    expect(director.play({ eventId: 'missing', actorId: '2', key: 'action.nuki', priority: 70 })).toBe('missing');
    expect(director.lastMissingVoice).toMatchObject({ packId: packs[2], actorId: '2', key: 'action.nuki' }); expect(h.created).toHaveLength(0);
  });
});
