import { describe, expect, it, vi } from 'vitest';
import { PresentationEventBus } from '../../presentation/PresentationEventBus';
import { VoicePresentationConsumer } from './VoicePresentationConsumer';

describe('VoicePresentationConsumer', () => {
  it('实时动作事件保持互斥映射；win_declared 不抢占结算 sequence', () => {
    const bus = new PresentationEventBus(); const play = vi.fn(); const consumer = new VoicePresentationConsumer({ play }, bus);
    bus.publish({ type: 'tile_discarded', playerId: 0, tile: { id: 0, red: false }, riverIndex: 0, isRiichiDiscard: false });
    bus.publish({ type: 'riichi_declared', playerId: 0, riverIndex: 0, kind: 'riichi' });
    bus.publish({ type: 'riichi_declared', playerId: 1, riverIndex: 0, kind: 'double-riichi' });
    bus.publish({ type: 'meld_declared', playerId: 1, meldType: 'chi' });
    bus.publish({ type: 'meld_declared', playerId: 2, meldType: 'pon' });
    bus.publish({ type: 'meld_declared', playerId: 3, meldType: 'kan', kanType: 'minkan' });
    bus.publish({ type: 'meld_declared', playerId: 0, meldType: 'kan', kanType: 'ankan' });
    bus.publish({ type: 'meld_declared', playerId: 1, meldType: 'kan', kanType: 'kakan' });
    bus.publish({ type: 'win_declared', playerId: 1, winType: 'ron' });
    bus.publish({ type: 'win_declared', playerId: 0, winType: 'tsumo' });
    expect(play.mock.calls.map(([voiceEvent]) => voiceEvent.key)).toEqual(['tile.m1', 'action.riichi', 'action.double_riichi', 'action.chi', 'action.pon', 'action.kan', 'action.ankan', 'action.kakan']);
    expect(play.mock.calls.map(([voiceEvent]) => voiceEvent.actorId)).toEqual(['0', '0', '1', '1', '2', '3', '0', '1']);
    consumer.dispose();
  });

  it('win_scored 交给独立 sequence 通道，携带结构化结算语义', () => {
    const bus = new PresentationEventBus(); const play = vi.fn(); const playWinSequence = vi.fn();
    const consumer = new VoicePresentationConsumer({ play, playWinSequence }, bus);
    bus.publish({
      type: 'win_scored', winnerId: 2, winType: 'ron', yakuIds: ['yakuhai'],
      yaku: [{ id: 'yakuhai', sourceTile: 'white', han: 1, yakuman: false }], limitTier: 'mangan', yakumanMultiplier: 0, totalDora: 3,
    });
    expect(play).not.toHaveBeenCalled();
    expect(playWinSequence).toHaveBeenCalledWith(expect.objectContaining({
      type: 'win_scored', winnerId: 2, yaku: [{ id: 'yakuhai', sourceTile: 'white', han: 1, yakuman: false }], totalDora: 3,
    }));
    consumer.dispose();
  });

  it('荒牌流局进入独立的 tenpai/noten Sequence；中止流局仍映射为实时语音', () => {
    const bus = new PresentationEventBus(); const play = vi.fn(); const playExhaustiveDrawSequence = vi.fn(); const consumer = new VoicePresentationConsumer({ play, playExhaustiveDrawSequence }, bus);
    bus.publish({ type: 'round_settled', settlementType: 'exhaustive-draw', activePlayerIds: [0, 1, 2, 3], tenpaiPlayers: [0, 2], notenPlayers: [1, 3] });
    bus.publish({ type: 'round_settled', settlementType: 'abortive-draw', reason: 'suufon-renda', triggeringPlayerId: 3 });
    bus.publish({ type: 'round_settled', settlementType: 'abortive-draw', reason: 'suukan-sanra', triggeringPlayerId: 1 });
    bus.publish({ type: 'round_settled', settlementType: 'abortive-draw', reason: 'suucha-riichi', triggeringPlayerId: 2 });
    bus.publish({ type: 'round_settled', settlementType: 'abortive-draw', reason: 'kyuushu-kyuuhai', triggeringPlayerId: 0 });
    expect(play.mock.calls.map(([voiceEvent]) => voiceEvent.key)).toEqual([
      'game.four_winds_abortive_draw',
      'game.four_kans_abortive_draw',
      'game.four_riichi_abortive_draw',
      'game.nine_terminals_and_honors_abortive_draw',
    ]);
    expect(play.mock.calls.map(([voiceEvent]) => voiceEvent.actorId)).toEqual(['3', '1', '2', '0']);
    expect(playExhaustiveDrawSequence).toHaveBeenCalledWith(expect.objectContaining({
      activePlayerIds: [0, 1, 2, 3], tenpaiPlayers: [0, 2], notenPlayers: [1, 3],
    }));
    consumer.dispose();
  });

  it('match lifecycle events use their own serial sequence APIs instead of realtime play', () => {
    const bus = new PresentationEventBus(); const play = vi.fn(); const playMatchStarted = vi.fn(); const playMatchResultSequence = vi.fn();
    const consumer = new VoicePresentationConsumer({ play, playMatchStarted, playMatchResultSequence }, bus);
    bus.publish({ type: 'match_started', matchId: 'match-1', activePlayerIds: [0, 1] });
    bus.publish({
      type: 'match_result_finalized', matchId: 'match-1', activePlayerIds: [0, 1],
      finalResult: { players: [{ player: 1, rawScore: 30000, rank: 1, rankTieBreakOrder: 0 }, { player: 0, rawScore: 25000, rank: 2, rankTieBreakOrder: 1 }], finalScores: [25000, 30000, 0, 0], leftoverRiichiStickPoints: 0, endedBy: 'manual' },
    });
    expect(play).not.toHaveBeenCalled();
    expect(playMatchStarted).toHaveBeenCalledOnce();
    expect(playMatchResultSequence).toHaveBeenCalledOnce();
    consumer.dispose();
  });

  it('取消、无效动作没有 confirmed presentation event 时不会产生语音', () => {
    const bus = new PresentationEventBus(); const play = vi.fn(); const consumer = new VoicePresentationConsumer({ play }, bus);
    expect(play).not.toHaveBeenCalled();
    consumer.dispose();
  });
});
