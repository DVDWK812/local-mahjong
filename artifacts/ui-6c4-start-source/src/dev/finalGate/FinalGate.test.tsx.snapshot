import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import FinalGate from './FinalGate';
import { AudioPresentationConsumer } from '../../audio/AudioPresentationConsumer';
import { PresentationAudioCues } from '../../presentation/PresentationAudioCue';
import { PresentationEventBus } from '../../presentation/PresentationEventBus';
import { createSeventeenGateFixture } from './scenarios';
import { discardCandidate } from '../../game/seventeenSteps';
import { participantRiverTarget } from '../../presentation3d/participants/participantLayout';
import { TABLE_PRESENTATION_TUNING } from '../../presentation3d/table/tablePresentationTuning';

afterEach(() => vi.unstubAllGlobals());

it('renders all 27 scenarios, manual unchecked progress and opt-in; does not write preferences', () => {
  const setItem = vi.fn();
  vi.stubGlobal('location', { search: '?testMode=1&uiFinalGate=1' });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem });
  const html = renderToStaticMarkup(<FinalGate />);
  expect(html).toContain('QA 音频：OFF');
  expect(html).toContain('0 / 27');
  expect(html.match(/<option value=/g)).toHaveLength(29); // 27 scenarios + 1x/2x
  expect(html).toContain('重演动作');
  expect(html).toContain('取消 / 退出场景');
  expect(html).not.toContain('checked=""');
  expect(setItem).not.toHaveBeenCalled();
  expect(renderToStaticMarkup(<FinalGate />)).toBe(html);
});

it('diagnostics receive real deduped cue identity and policy without creating an audio authority', () => {
  const cues = new PresentationAudioCues(), bus = new PresentationEventBus();
  const play = vi.fn(), trace = vi.fn();
  let allowed = false;
  const consumer = new AudioPresentationConsumer({ playSfx: play }, cues, () => allowed, trace);
  const event = bus.publish({ type: 'tile_drawn', playerId: 0 });
  expect(trace).not.toHaveBeenCalled();
  const run = cues.run(event);
  run.emit('draw-contact', 'grasp', 0);
  expect(trace).toHaveBeenCalledWith(expect.objectContaining({ event, phase: 'grasp', kind: 'draw-contact' }), 'draw', false);
  allowed = true;
  run.emit('draw-contact', 'grasp', 0);
  expect(trace).toHaveBeenCalledTimes(1);
  expect(play).not.toHaveBeenCalled();
  consumer.dispose();
  const next = new AudioPresentationConsumer({ playSfx: play }, cues, () => true, () => { throw new Error('diagnostic failure'); });
  run.emit('draw-contact', 'grasp', 0);
  cues.run(bus.publish({ type: 'tile_drawn', playerId: 0 })).emit('draw-contact', 'grasp', 0);
  expect(play).toHaveBeenCalledOnce();
  next.dispose();
});

it('12→13 uses a real candidate discard and only the short viewport enters compact scale', () => {
  const state = createSeventeenGateFixture('VIS-02');
  const next = discardCandidate(state, 0, state.players[0].discardCandidates[0].instanceId);
  expect(state.players[0].discardedTiles).toHaveLength(12);
  expect(next.players[0].discardedTiles).toHaveLength(13);
  const before = participantRiverTarget('duel', 'bottom', 0, state.players[0].discardedTiles, { width: 1280, height: 720 });
  const short = participantRiverTarget('duel', 'bottom', 0, next.players[0].discardedTiles, { width: 1280, height: 720 });
  const tall = participantRiverTarget('duel', 'bottom', 0, next.players[0].discardedTiles, { width: 1920, height: 1080 });
  expect(before.tileScale).toBe(TABLE_PRESENTATION_TUNING.tileScale.river);
  expect(tall.tileScale).toBe(before.tileScale);
  expect(short.tileScale).toBeLessThan(tall.tileScale);
});
