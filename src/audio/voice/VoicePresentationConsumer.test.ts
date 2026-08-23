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
    expect(play.mock.calls.map(([voiceEvent]) => voiceEvent.key)).toEqual(['action.riichi', 'action.double_riichi', 'action.chi', 'action.pon', 'action.kan', 'action.ankan', 'action.kakan']);
    expect(play.mock.calls.map(([voiceEvent]) => voiceEvent.actorId)).toEqual(['0', '1', '1', '2', '3', '0', '1']);
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

  it('已结算流局映射为对应游戏语音；荒牌流局不指定 actor', () => {
    const bus = new PresentationEventBus(); const play = vi.fn(); const consumer = new VoicePresentationConsumer({ play }, bus);
    bus.publish({ type: 'round_settled', settlementType: 'exhaustive-draw' });
    bus.publish({ type: 'round_settled', settlementType: 'abortive-draw', reason: 'suufon-renda', triggeringPlayerId: 3 });
    bus.publish({ type: 'round_settled', settlementType: 'abortive-draw', reason: 'suukan-sanra', triggeringPlayerId: 1 });
    bus.publish({ type: 'round_settled', settlementType: 'abortive-draw', reason: 'suucha-riichi', triggeringPlayerId: 2 });
    bus.publish({ type: 'round_settled', settlementType: 'abortive-draw', reason: 'kyuushu-kyuuhai', triggeringPlayerId: 0 });
    expect(play.mock.calls.map(([voiceEvent]) => voiceEvent.key)).toEqual([
      'game.draw',
      'game.four_winds_abortive_draw',
      'game.four_kans_abortive_draw',
      'game.four_riichi_abortive_draw',
      'game.nine_terminals_and_honors_abortive_draw',
    ]);
    expect(play.mock.calls.map(([voiceEvent]) => voiceEvent.actorId)).toEqual([undefined, '3', '1', '2', '0']);
    consumer.dispose();
  });

  it('取消、无效动作没有 confirmed presentation event 时不会产生语音', () => {
    const bus = new PresentationEventBus(); const play = vi.fn(); const consumer = new VoicePresentationConsumer({ play }, bus);
    expect(play).not.toHaveBeenCalled();
    consumer.dispose();
  });
});
