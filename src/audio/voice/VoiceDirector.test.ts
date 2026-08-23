import { describe, expect, it, vi } from 'vitest';
import type { ManagedVoicePlayback } from '../AudioManager';
import type { AudioPlaybackHandle } from '../audioBackend';
import { VoiceDirector, type VoicePlaybackChannel } from './VoiceDirector';
import { VOICE_EVENT_PRIORITIES, type VoiceEvent } from './voiceEvents';
import type { MatchResultPresentationEvent, MatchStartedPresentationEvent, RoundSettledPresentationEvent, WinScoredPresentationEvent } from '../../presentation/PresentationEventBus';
import { PresentationEventBus } from '../../presentation/PresentationEventBus';
import { NO_VOICE_PACK_ID } from './voicePreferences';

function event(key: VoiceEvent['key'], eventId = `${key}-1`, actorId?: string): VoiceEvent {
  return { eventId, key, actorId, priority: VOICE_EVENT_PRIORITIES[key] };
}

function playback(reject = false): { managed: ManagedVoicePlayback; handle: AudioPlaybackHandle; stop: ReturnType<typeof vi.fn>; finish(): void } {
  const stop = vi.fn(); const ended = new Set<() => void>();
  const handle: AudioPlaybackHandle = {
    play: reject ? vi.fn().mockRejectedValue(new Error('blocked')) : vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(), setVolume: vi.fn(), onEnded: (listener) => { ended.add(listener); return () => ended.delete(listener); }, dispose: vi.fn(),
  };
  return { managed: { handle, stop }, handle, stop, finish: () => [...ended].forEach((listener) => listener()) };
}

function scored(eventId = 'win-scored', winnerId: 0 | 1 | 2 | 3 = 1, yaku: WinScoredPresentationEvent['yaku'] = []): WinScoredPresentationEvent {
  return { eventId, sequence: 1, type: 'win_scored', winnerId, winType: 'ron', yaku, yakuIds: yaku.map((item) => item.id), limitTier: 'none', yakumanMultiplier: 0, totalDora: 0 };
}

async function flush(): Promise<void> { await Promise.resolve(); await Promise.resolve(); }

function fixture(options: { enabled?: boolean; packId?: string | null; url?: string; assignments?: readonly [string | null, string | null, string | null, string | null]; playerIds?: readonly (string | number)[]; playerCount?: number; packs?: readonly string[]; discardVoiceEnabled?: boolean; discardVoiceScope?: 'all' | 'self' } = {}) {
  const created: Array<{ id: string; url: string; volume: number; playback: ReturnType<typeof playback> }> = [];
  const channel: VoicePlaybackChannel = { createVoicePlayback: (id, url, volume) => { const item = playback(); created.push({ id, url, volume, playback: item }); return item.managed; } };
  const getAudioForKey = vi.fn((packId: string, key: string) => options.url === undefined ? `/assets/${packId}/${key}.mp3` : options.url || undefined);
  const packId = options.packId === undefined ? 'xiaozhang' : options.packId;
  const packs = options.packs
    ? options.packs.map((id) => ({ id, name: id, locale: 'zh-CN', path: id }))
    : packId ? [{ id: packId, name: packId, locale: 'zh-CN', path: packId }] : [];
  const director = new VoiceDirector({ getAudioForKey, listPacks: () => packs }, channel, { voiceEnabled: options.enabled ?? true, voiceVolume: 0.8, selectedVoicePackId: packId, voicePackBySeat: options.assignments ?? [null, null, null, null], discardVoiceEnabled: options.discardVoiceEnabled, discardVoiceScope: options.discardVoiceScope });
  director.setActorSeatContext({ playerIds: options.playerIds ?? [0, 1, 2, 3], playerCount: options.playerCount ?? 4 });
  return { director, created, getAudioForKey, channel };
}

describe('VoiceDirector', () => {
  it('语音关闭、未知 Pack 或缺失资源均安全跳过', () => {
    expect(fixture({ enabled: false }).director.play(event('action.riichi'))).toBe('disabled');
    expect(fixture({ packId: null }).director.play(event('action.riichi'))).toBe('missing');
    expect(fixture({ url: '' }).director.play(event('action.riichi'))).toBe('missing');
  });

  it('使用当前 Pack 的正确 URL 与独立语音音量播放', () => {
    const { director, created, getAudioForKey } = fixture({ packId: 'robot_01' });
    director.setVolume(0.4);
    expect(director.play(event('action.riichi'))).toBe('played');
    expect(getAudioForKey).toHaveBeenCalledWith('robot_01', 'action.riichi');
    expect(created[0]).toMatchObject({ url: '/assets/robot_01/action.riichi.mp3', volume: 0.4 });
    expect(created[0].playback.handle.play).toHaveBeenCalledOnce();
  });

  it('stop 停止当前语音，播放 reject 被捕获且不会留下活动项', async () => {
    const item = playback(true);
    const channel: VoicePlaybackChannel = { createVoicePlayback: () => item.managed };
    const director = new VoiceDirector({ getAudioForKey: () => '/voice.mp3', listPacks: () => [{ id: 'xiaozhang', name: '校长', locale: 'zh-CN', path: 'xiaozhang' }] }, channel, { voiceEnabled: true, voiceVolume: 0.8, selectedVoicePackId: 'xiaozhang', voicePackBySeat: [null, null, null, null] });
    director.play(event('action.riichi'));
    await Promise.resolve();
    expect(item.stop).toHaveBeenCalledOnce();
    director.stop();
    expect(item.stop).toHaveBeenCalledOnce();
  });

  it('高优先级打断低优先级；低优先级不会打断 ron', () => {
    const { director, created } = fixture();
    director.play(event('action.pon', 'pon-1'));
    director.play(event('action.riichi', 'riichi-1'));
    expect(created[0].playback.stop).toHaveBeenCalledOnce();
    director.play(event('action.ron', 'ron-1'));
    expect(created[1].playback.stop).toHaveBeenCalledOnce();
    expect(director.play(event('action.pon', 'pon-2'))).toBe('ignored');
    expect(created).toHaveLength(3);
  });

  it('流局语音优先级为 85，可打断立直和杠', () => {
    const { director, created } = fixture();
    director.play(event('action.riichi', 'riichi-before-draw', '0'));
    director.play(event('game.four_riichi_abortive_draw', 'four-riichi', '3'));
    expect(created[0].playback.stop).toHaveBeenCalledOnce();
    director.stop();
    director.play(event('action.kan', 'kan-before-draw', '1'));
    director.play(event('game.four_kans_abortive_draw', 'four-kans', '1'));
    expect(created[2].playback.stop).toHaveBeenCalledOnce();
  });

  it('无 actor 的荒牌流局使用当前默认 Pack，有 actor 的中止流局使用对应座位 Pack', () => {
    const { director, getAudioForKey } = fixture({ packs: ['xiaozhang', 'mambo'], assignments: ['xiaozhang', 'mambo', null, null] });
    director.setActorSeatContext({ playerIds: ['p1', 'p2'], playerCount: 2 });
    director.play(event('game.draw', 'exhaustive-draw'));
    director.stop();
    director.play(event('game.nine_terminals_and_honors_abortive_draw', 'kyuushu', 'p2'));
    expect(getAudioForKey.mock.calls).toEqual([
      ['xiaozhang', 'game.draw'],
      ['mambo', 'game.nine_terminals_and_honors_abortive_draw'],
    ]);
  });

  it('game.start 始终使用 Player 1 的座位语音，而不读取残留的 selectedVoicePackId', () => {
    const start = new PresentationEventBus().publish({ type: 'match_started', matchId: 'table-voice', activePlayerIds: [0, 1] }) as MatchStartedPresentationEvent;

    const mamboFirst = fixture({
      packId: 'robot',
      packs: ['xiaozhang', 'mambo', 'robot'],
      assignments: ['mambo', 'xiaozhang', null, null],
      playerIds: [0, 1],
      playerCount: 2,
    });
    mamboFirst.director.playMatchStarted(start);
    expect(mamboFirst.getAudioForKey).toHaveBeenCalledWith('mambo', 'game.start');

    const xiaozhangFirst = fixture({
      packId: 'robot',
      packs: ['xiaozhang', 'mambo', 'robot'],
      assignments: ['xiaozhang', 'mambo', null, null],
      playerIds: [0, 1],
      playerCount: 2,
    });
    xiaozhangFirst.director.playMatchStarted({ ...start, eventId: 'match-start-xiaozhang' });
    expect(xiaozhangFirst.getAudioForKey).toHaveBeenCalledWith('xiaozhang', 'game.start');
  });

  it('相同 eventId 只消费一次，不受重复事件消费影响', () => {
    const { director, created } = fixture();
    expect(director.play(event('action.riichi', 'confirmed-event'))).toBe('played');
    expect(director.play(event('action.riichi', 'confirmed-event'))).toBe('ignored');
    expect(created).toHaveLength(1);
  });

  it('按照当前玩家顺序而非 actorId 数值选择座位角色', () => {
    const created: string[] = [];
    const getAudioForKey = vi.fn((packId: string) => `/assets/${packId}.mp3`);
    const channel: VoicePlaybackChannel = { createVoicePlayback: (_id, url) => { created.push(url); return playback().managed; } };
    const packs = ['xiaozhang', 'mambo', 'robot', 'master'].map((id) => ({ id, name: id, locale: 'zh-CN', path: id }));
    const director = new VoiceDirector(
      { getAudioForKey, listPacks: () => packs },
      channel,
      { voiceEnabled: true, voiceVolume: 0.6, selectedVoicePackId: 'xiaozhang', voicePackBySeat: ['xiaozhang', 'mambo', 'robot', 'master'] },
    );
    director.setActorSeatContext({ playerIds: [42, 7, 91, 3], playerCount: 4 });
    director.play(event('action.riichi', 'p1-riichi', '42'));
    director.stop();
    director.play(event('action.riichi', 'p2-riichi', '7'));
    director.stop();
    director.play(event('action.tsumo', 'p3-tsumo', '91'));
    director.stop();
    director.play(event('action.ron', 'p4-ron', '3'));
    expect(getAudioForKey.mock.calls).toEqual([
      ['xiaozhang', 'action.riichi'], ['mambo', 'action.riichi'], ['robot', 'action.tsumo'], ['master', 'action.ron'],
    ]);
    expect(created).toEqual(['/assets/xiaozhang.mp3', '/assets/mambo.mp3', '/assets/robot.mp3', '/assets/master.mp3']);
  });

  it('二人和三人上下文只使用活跃座位，缺失或失效 assignment 安全回退默认 Pack', () => {
    const packs = [{ id: 'xiaozhang', name: '校长', locale: 'zh-CN', path: 'xiaozhang' }, { id: 'mambo', name: '曼波', locale: 'zh-CN', path: 'mambo' }];
    const getAudioForKey = vi.fn(() => '/voice.mp3');
    const director = new VoiceDirector({ getAudioForKey, listPacks: () => packs }, { createVoicePlayback: () => playback().managed }, { voiceEnabled: true, voiceVolume: 0.5, selectedVoicePackId: 'xiaozhang', voicePackBySeat: ['mambo', 'mambo', 'deleted', 'mambo'] });
    director.setActorSeatContext({ playerIds: ['p1', 'p2', 'p3', 'p4'], playerCount: 3 });
    director.play(event('action.riichi', 'three-player', 'p3'));
    director.play(event('action.ron', 'inactive-player', 'p4'));
    director.setActorSeatContext({ playerIds: ['p1', 'p2'], playerCount: 2 });
    director.play(event('action.tsumo', 'two-player', 'p2'));
    expect(getAudioForKey.mock.calls).toEqual([
      ['xiaozhang', 'action.riichi'],
      ['xiaozhang', 'action.ron'],
      ['mambo', 'action.tsumo'],
    ]);
  });

  it('座位选择“无”时，该玩家的确认事件不会回退到默认角色', () => {
    const { director, created, getAudioForKey } = fixture({
      packs: ['xiaozhang', 'mambo'], assignments: ['xiaozhang', NO_VOICE_PACK_ID, null, null], playerIds: [0, 1], playerCount: 2,
    });
    expect(director.play(event('action.riichi', 'muted-seat', '1'))).toBe('missing');
    expect(getAudioForKey).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it('出牌报牌默认关闭，all/self 按权威本地玩家 ID 过滤，且连续牌名只替换当前播放', () => {
    expect(fixture().director.play(event('tile.p5', 'off', '1'))).toBe('disabled');
    const all = fixture({ discardVoiceEnabled: true, discardVoiceScope: 'all' });
    expect(all.director.play(event('tile.p5', 'p2', '1'))).toBe('played');
    expect(all.director.play(event('tile.s5', 'p3', '2'))).toBe('played');
    expect(all.created).toHaveLength(2);
    expect(all.created[0].playback.stop).toHaveBeenCalledOnce();
    expect(all.director.play(event('action.pon', 'pon-after-tile', '1'))).toBe('played');
    expect(all.created[1].playback.stop).toHaveBeenCalledOnce();

    const self = fixture({ discardVoiceEnabled: true, discardVoiceScope: 'self', playerIds: [0, 1], playerCount: 2 });
    expect(self.director.play(event('tile.m5', 'other-tile', '1'))).toBe('disabled');
    expect(self.director.play(event('tile.m5', 'local-tile', '0'))).toBe('played');

    const perSeat = fixture({
      discardVoiceEnabled: true,
      packs: ['xiaozhang', 'mambo'],
      assignments: ['xiaozhang', 'mambo', null, null],
      playerIds: [0, 1],
      playerCount: 2,
    });
    expect(perSeat.director.play(event('tile.p5', 'p2-tile', '1'))).toBe('played');
    expect(perSeat.getAudioForKey).toHaveBeenCalledWith('mambo', 'tile.p5');
  });

  it('和牌 sequence 等待 ended 后才开始下一项，且迟到实时动作不能插入', async () => {
    const { director, created } = fixture();
    director.playWinSequence(scored('ordered-win', 1, [
      { id: 'riichi', han: 1, yakuman: false }, { id: 'pinfu', han: 1, yakuman: false },
    ]));
    expect(created).toHaveLength(1);
    expect(created[0].playback.handle.play).toHaveBeenCalledOnce();
    expect(director.play(event('action.pon', 'late-pon', '2'))).toBe('ignored');
    expect(director.play(event('tile.p5', 'late-tile', '2'))).toBe('ignored');
    expect(created).toHaveLength(1);
    created[0].playback.finish(); await flush();
    expect(created).toHaveLength(2);
    created[1].playback.finish(); await flush();
    expect(created).toHaveLength(3);
    created[2].playback.finish(); await flush();
    expect(created.map((item) => item.url)).toEqual([
      '/assets/xiaozhang/action.ron.mp3', '/assets/xiaozhang/yaku.riichi.mp3', '/assets/xiaozhang/yaku.pinfu.mp3',
    ]);
  });

  it('multi-ron 整套先后串行，并为每个赢家快照各自座位 Pack', async () => {
    const { director, created } = fixture({ packs: ['xiaozhang', 'mambo'], assignments: ['xiaozhang', 'mambo', null, null] });
    director.playWinSequence(scored('winner-a', 0));
    director.playWinSequence(scored('winner-b', 1));
    expect(created.map((item) => item.url)).toEqual(['/assets/xiaozhang/action.ron.mp3']);
    created[0].playback.finish(); await flush();
    expect(created.map((item) => item.url)).toEqual(['/assets/xiaozhang/action.ron.mp3', '/assets/mambo/action.ron.mp3']);
    created[1].playback.finish(); await flush();
  });

  it('缺音频与关闭语音会逐项完成 sequence，不会卡死未来展示流', async () => {
    const { director, created } = fixture({ url: '' });
    const signals: string[] = [];
    director.subscribeWinSequence((signal) => signals.push(signal.type));
    director.playWinSequence(scored('missing', 1, [{ id: 'pinfu', han: 1, yakuman: false }]));
    await flush();
    expect(created).toHaveLength(0);
    expect(signals).toEqual(['sequenceStarted', 'itemStarted', 'itemCompleted', 'itemStarted', 'itemCompleted', 'sequenceCompleted']);

    const disabled = fixture({ enabled: false });
    disabled.director.playWinSequence(scored('disabled', 1, [{ id: 'pinfu', han: 1, yakuman: false }]));
    await flush();
    expect(disabled.created).toHaveLength(0);
  });

  it('快速完成只停止当前赢家 sequence，并让后续 multi-ron 继续排队', async () => {
    const { director, created } = fixture();
    const completed: string[] = [];
    director.subscribeWinSequence((signal) => {
      if (signal.type === 'sequenceCompleted') completed.push(`${signal.sequence.id}:${signal.status}`);
    });
    director.playWinSequence(scored('winner-a-skip', 0, [{ id: 'riichi', han: 1, yakuman: false }]));
    director.playWinSequence(scored('winner-b-after-skip', 1));
    expect(director.skipCurrentWinSequence()).toBe(true);
    expect(created[0].playback.stop).toHaveBeenCalledOnce();
    await flush();
    expect(completed).toContain('winner-a-skip:stopped');
    expect(created.map((item) => item.url)).toEqual([
      '/assets/xiaozhang/action.ron.mp3', '/assets/xiaozhang/action.ron.mp3',
    ]);
    created[1].playback.finish(); await flush();
    expect(completed).toContain('winner-b-after-skip:completed');
  });

  it('荒牌流局依次播报 game.draw 与各 active seat 的权威听牌状态，并逐项解析角色 Pack', async () => {
    const { director, created, getAudioForKey } = fixture({
      packs: ['xiaozhang', 'mambo', 'robot'],
      assignments: ['xiaozhang', 'mambo', 'robot', null],
      playerIds: [0, 1, 2], playerCount: 3,
    });
    const event = new PresentationEventBus().publish({
      type: 'round_settled', settlementType: 'exhaustive-draw', activePlayerIds: [0, 1, 2], tenpaiPlayers: [0, 2], notenPlayers: [1],
    }) as Extract<RoundSettledPresentationEvent, { settlementType: 'exhaustive-draw' }>;
    director.playExhaustiveDrawSequence(event);
    // One playback exists at any point; later entries wait for `ended`.
    expect(created).toHaveLength(1);
    created[0].playback.finish(); await flush();
    expect(created).toHaveLength(2);
    created[1].playback.finish(); await flush();
    created[2].playback.finish(); await flush();
    expect(getAudioForKey.mock.calls).toEqual([
      ['xiaozhang', 'game.draw'], ['xiaozhang', 'yaku.tenpai'], ['mambo', 'yaku.noten'], ['robot', 'yaku.tenpai'],
    ]);
  });

  it('match-start and final-rank sequences share the serial channel and use every ranked player\'s Pack', async () => {
    const { director, created, getAudioForKey } = fixture({
      packs: ['xiaozhang', 'mambo', 'robot', 'master'],
      assignments: ['xiaozhang', 'mambo', 'robot', 'master'], playerIds: [0, 1, 2, 3], playerCount: 4,
    });
    const bus = new PresentationEventBus();
    const started = bus.publish({ type: 'match_started', matchId: 'match-voice', activePlayerIds: [0, 1, 2, 3] }) as MatchStartedPresentationEvent;
    const final = bus.publish({
      type: 'match_result_finalized', matchId: 'match-voice', activePlayerIds: [0, 1, 2, 3],
      finalResult: {
        players: [
          { player: 2, rawScore: 25000, rank: 3, rankTieBreakOrder: 2 }, { player: 1, rawScore: 28000, rank: 2, rankTieBreakOrder: 1 },
          { player: 3, rawScore: 18000, rank: 4, rankTieBreakOrder: 3 }, { player: 0, rawScore: 31000, rank: 1, rankTieBreakOrder: 0 },
        ], finalScores: [31000, 28000, 25000, 18000], leftoverRiichiStickPoints: 0, endedBy: 'manual',
      },
    }) as MatchResultPresentationEvent;
    director.playMatchStarted(started);
    director.playMatchStarted(started);
    director.playMatchResultSequence(final);
    expect(created).toHaveLength(1);
    for (let index = 0; index < 5; index += 1) { created[index].playback.finish(); await flush(); }
    expect(getAudioForKey.mock.calls).toEqual([
      ['xiaozhang', 'game.start'], ['xiaozhang', 'game.end'], ['mambo', 'result.second_place'], ['robot', 'result.third_place'], ['master', 'result.fourth_place'],
    ]);
  });
});
