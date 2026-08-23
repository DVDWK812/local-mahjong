import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ManagedVoicePlayback } from '../AudioManager';
import type { AudioPlaybackHandle } from '../audioBackend';
import { ResultDialog } from '../../components/ResultDialog';
import { createInitialGameState } from '../../game/engine';
import { createTile } from '../../game/tileUtils';
import type { GameState, WinResultEntry } from '../../game/types';
import { PresentationEventBus } from '../../presentation/PresentationEventBus';
import { VoiceDirector, type VoicePlaybackChannel } from './VoiceDirector';
import { VoicePresentationRuntime } from './VoicePresentationRuntime';

function playback(): { readonly managed: ManagedVoicePlayback; readonly played: ReturnType<typeof vi.fn>; readonly finish: () => void } {
  const ended = new Set<() => void>();
  const played = vi.fn().mockResolvedValue(undefined);
  const handle: AudioPlaybackHandle = {
    play: played,
    pause: vi.fn(),
    setVolume: vi.fn(),
    onEnded: (listener) => {
      ended.add(listener);
      return () => ended.delete(listener);
    },
    dispose: vi.fn(),
  };
  return {
    managed: { handle, stop: vi.fn() },
    played,
    finish: () => [...ended].forEach((listener) => listener()),
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function resultState(): GameState {
  const state = createInitialGameState();
  const winner: WinResultEntry = {
    winner: 1,
    from: 0,
    winType: 'ron',
    winTile: createTile(13, 0),
    yaku: [
      { id: 'riichi', name: '立直', han: 1 },
      { id: 'pinfu', name: '平和', han: 1 },
      { id: 'sanshoku-doujun', name: '三色同顺', han: 2 },
    ],
    yakuIds: ['riichi', 'pinfu', 'sanshoku-doujun'],
    dora: 3,
    totalDora: 3,
    limitTier: 'mangan',
    yakumanMultiplier: 0,
    han: 10,
    fu: 30,
    points: 18000,
    pointDeltas: [-18000, 18000, 0, 0],
  };
  return { ...state, result: { type: 'ron', winners: [winner], pointDeltas: winner.pointDeltas } };
}

function publishOrdinaryWin(bus: PresentationEventBus): void {
  bus.publish({
    type: 'win_scored',
    winnerId: 1,
    winType: 'ron',
    yakuIds: ['riichi', 'pinfu', 'sanshoku-doujun'],
    yaku: [
      { id: 'riichi', han: 1, yakuman: false },
      { id: 'pinfu', han: 1, yakuman: false },
      { id: 'sanshoku-doujun', han: 2, yakuman: false },
    ],
    totalDora: 3,
    limitTier: 'mangan',
    yakumanMultiplier: 0,
  });
}

describe('VoicePresentationRuntime app wiring', () => {
  it('uses one Director for EventBus audio and the persistent ResultDialog stream, including a late Dialog mount', async () => {
    const bus = new PresentationEventBus();
    const created: ReturnType<typeof playback>[] = [];
    const createdIds: string[] = [];
    const channel: VoicePlaybackChannel = {
      createVoicePlayback: (id) => {
        const next = playback();
        createdIds.push(id);
        created.push(next);
        return next.managed;
      },
    };
    const director = new VoiceDirector(
      {
        listPacks: () => [{ id: 'xiaozhang', name: '校长', locale: 'zh-CN', path: 'xiaozhang' }],
        getAudioForKey: () => '/voice.mp3',
      },
      channel,
      { voiceEnabled: true, voiceVolume: 0.8, selectedVoicePackId: 'xiaozhang', voicePackBySeat: [null, null, null, null] },
    );
    director.setActorSeatContext({ playerIds: [0, 1, 2, 3], playerCount: 4 });
    const runtime = new VoicePresentationRuntime(director, bus);
    runtime.start();

    publishOrdinaryWin(bus);
    expect(created).toHaveLength(1);
    expect(runtime.controller.getSnapshot().sequences[0]?.visibleItems.map((item) => item.displayLabel)).toEqual(['荣和']);

    created[0].finish();
    await flush();
    expect(created).toHaveLength(2);
    const afterRiichi = runtime.controller.getSnapshot();
    expect(afterRiichi.sequences[0]?.visibleItems.map((item) => item.displayLabel)).toEqual(['荣和', '立直']);

    // ResultDialog deliberately mounts only after the first yaku has started.
    const html = renderToStaticMarkup(
      <ResultDialog gameState={resultState()} onReset={() => undefined} winPresentationController={runtime.controller} />,
    );
    expect(html).toContain('>立直<');
    expect(html).not.toContain('役种播报中…');

    created[1].finish();
    await flush();
    expect(runtime.controller.getSnapshot().sequences[0]?.visibleItems.map((item) => item.displayLabel)).toEqual(['荣和', '立直', '平和']);
    expect(created).toHaveLength(3);
    created[2].finish();
    await flush();
    created[3].finish();
    await flush();
    created[4].finish();
    await flush();
    expect(createdIds.map((id) => {
      const parts = id.split(':');
      return parts[parts.length - 1];
    })).toEqual([
      'action.ron', 'yaku.riichi', 'yaku.pinfu', 'yaku.sanshoku', 'yaku.dora_3', 'score.mangan',
    ]);
    expect(runtime.controller.getSnapshot().sequences[0]?.visibleItems.map((item) => item.voiceKey)).toEqual([
      'action.ron', 'yaku.riichi', 'yaku.pinfu', 'yaku.sanshoku', 'yaku.dora_3', 'score.mangan',
    ]);
    runtime.dispose();
  });

  it('keeps the same item-by-item stream when audio is unavailable', async () => {
    vi.useFakeTimers();
    const bus = new PresentationEventBus();
    const director = new VoiceDirector(
      {
        listPacks: () => [{ id: 'xiaozhang', name: '校长', locale: 'zh-CN', path: 'xiaozhang' }],
        getAudioForKey: () => undefined,
      },
      { createVoicePlayback: () => undefined },
      { voiceEnabled: true, voiceVolume: 0.8, selectedVoicePackId: 'xiaozhang', voicePackBySeat: [null, null, null, null] },
    );
    director.setActorSeatContext({ playerIds: [0, 1, 2, 3], playerCount: 4 });
    const runtime = new VoicePresentationRuntime(director, bus);
    runtime.start();

    publishOrdinaryWin(bus);
    await flush();
    expect(runtime.controller.getSnapshot().sequences[0]?.visibleItems.map((item) => item.displayLabel)).toEqual(['荣和']);
    await vi.advanceTimersByTimeAsync(2500);
    await flush();
    expect(runtime.controller.getSnapshot().sequences[0]?.visibleItems.map((item) => item.displayLabel)).toEqual(['荣和', '立直', '平和', '三色同顺', '宝牌', '满贯']);
    runtime.dispose();
    vi.useRealTimers();
  });

  it('starts one reversible runtime subscription and delivers ordinary semantic events to real VoiceDirector playback', async () => {
    const bus = new PresentationEventBus();
    const created: ReturnType<typeof playback>[] = [];
    const createdIds: string[] = [];
    const director = new VoiceDirector(
      {
        listPacks: () => [{ id: 'mambo', name: '曼波', locale: 'zh-CN', path: 'mambo' }],
        getAudioForKey: (_packId, key) => `/audio/${key}.mp3`,
      },
      {
        createVoicePlayback: (id) => {
          const next = playback();
          createdIds.push(id);
          created.push(next);
          return next.managed;
        },
      },
      { voiceEnabled: true, voiceVolume: 0.37, selectedVoicePackId: 'mambo', voicePackBySeat: ['mambo', null, null, null] },
    );
    director.setActorSeatContext({ playerIds: [0, 1, 2, 3], playerCount: 4 });
    const runtime = new VoicePresentationRuntime(director, bus);

    expect(runtime.activeVoiceConsumerSubscriptions).toBe(0);
    expect(runtime.activePresentationControllerSubscriptions).toBe(0);
    expect(runtime.start()).toBe(true);
    expect(runtime.start()).toBe(false);
    expect(runtime.startCount).toBe(1);
    expect(runtime.activeVoiceConsumerSubscriptions).toBe(1);
    expect(runtime.activePresentationControllerSubscriptions).toBe(1);

    bus.publish({ type: 'meld_declared', playerId: 0, meldType: 'chi' });
    created[0].finish();
    bus.publish({ type: 'meld_declared', playerId: 0, meldType: 'pon' });
    created[1].finish();
    bus.publish({ type: 'riichi_declared', playerId: 0, riverIndex: 3, kind: 'riichi' });
    created[2].finish();
    bus.publish({ type: 'meld_declared', playerId: 0, meldType: 'kan', kanType: 'ankan' });
    created[3].finish();
    bus.publish({ type: 'round_settled', settlementType: 'exhaustive-draw', activePlayerIds: [0, 1, 2, 3], tenpaiPlayers: [0, 2], notenPlayers: [1, 3] });

    // The draw announcement and four player statuses occupy one serial narration channel.
    created[4].finish(); await flush();
    created[5].finish(); await flush();
    created[6].finish(); await flush();
    created[7].finish(); await flush();

    expect([
      ...createdIds.slice(0, 4).map((id) => id.split(':')[1]),
      ...createdIds.slice(4).map((id) => {
        const parts = id.split(':');
        return parts[parts.length - 1];
      }),
    ]).toEqual([
      'action.chi', 'action.pon', 'action.riichi', 'action.ankan', 'game.draw', 'yaku.tenpai', 'yaku.noten', 'yaku.tenpai', 'yaku.noten',
    ]);
    expect(created.every((item) => item.played.mock.calls.length === 1)).toBe(true);

    expect(runtime.stop()).toBe(true);
    expect(runtime.activeVoiceConsumerSubscriptions).toBe(0);
    expect(runtime.activePresentationControllerSubscriptions).toBe(0);
    // Mirrors StrictMode cleanup followed by its second effect setup.
    expect(runtime.start()).toBe(true);
    expect(runtime.startCount).toBe(2);
    expect(runtime.stopCount).toBe(1);
    expect(runtime.activeVoiceConsumerSubscriptions).toBe(1);
    expect(runtime.activePresentationControllerSubscriptions).toBe(1);
    runtime.dispose();
  });
});
