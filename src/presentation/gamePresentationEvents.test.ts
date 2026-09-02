import { describe, expect, it } from 'vitest';
import { buildAbortiveDrawResult } from '../game/abortiveDraw';
import { createInitialGameState } from '../game/engine';
import { createTile } from '../game/tileUtils';
import { settleExhaustiveDraw } from '../game/exhaustiveDraw';
import { ronResult, tsumoResult } from '../game/match/testUtils';
import type { PresentationEvent } from './PresentationEventBus';
import { PresentationEventBus } from './PresentationEventBus';
import { GamePresentationEventObserver } from './gamePresentationEvents';
import { voiceEventFromPresentation } from '../audio/voice/voiceEvents';

describe('confirmed win presentation events', () => {
  it('规则结算出的 ron / tsumo 各发布一次，并且重复 observe 不重播', () => {
    const initial = createInitialGameState();
    const bus = new PresentationEventBus(); const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(initial, bus);
    const ron = { ...initial, phase: 'round-ended' as const, result: ronResult(1, 0, [-8000, 8000, 0, 0]) };
    observer.observe(ron); observer.observe(ron);
    const reset = { ...initial, result: null };
    observer.observe(reset);
    const tsumo = { ...initial, phase: 'round-ended' as const, result: tsumoResult(0, [12000, -4000, -4000, -4000]) };
    observer.observe(tsumo); observer.observe(tsumo);
    expect(events.filter((event) => event.type === 'win_declared')).toEqual([
      expect.objectContaining({ playerId: 1, winType: 'ron' }),
      expect.objectContaining({ playerId: 0, winType: 'tsumo' }),
    ]);
  });

  it('同一 confirmed transition 始终先发布 Discard/Draw，再发布 WinDeclared', () => {
    const initial = createInitialGameState();
    const ronBus = new PresentationEventBus(); const ronEvents: PresentationEvent[] = [];
    ronBus.subscribe((event) => ronEvents.push(event));
    const ronObserver = new GamePresentationEventObserver(initial, ronBus);
    const discard = createTile(4, 9001);
    const ronState = {
      ...initial,
      phase: 'round-ended' as const,
      lastDiscard: { player: 0 as const, tile: discard },
      players: initial.players.map((player) => player.id === 0 ? { ...player, river: [...player.river, discard] } : player),
      result: ronResult(1, 0, [-8000, 8000, 0, 0]),
    };
    ronObserver.observe(ronState);
    const ronDiscard = ronEvents.find((event) => event.type === 'tile_discarded');
    const ronWin = ronEvents.find((event) => event.type === 'win_declared');
    expect(ronEvents.findIndex((event) => event.type === 'tile_discarded')).toBeLessThan(ronEvents.findIndex((event) => event.type === 'win_declared'));
    expect(ronWin).toEqual(expect.objectContaining({ sourceEventId: ronDiscard?.eventId }));

    const tsumoBus = new PresentationEventBus(); const tsumoEvents: PresentationEvent[] = [];
    tsumoBus.subscribe((event) => tsumoEvents.push(event));
    const tsumoObserver = new GamePresentationEventObserver(initial, tsumoBus);
    const drawn = createTile(8, 9002);
    tsumoObserver.observe({
      ...initial,
      phase: 'round-ended',
      lastDrawSource: 'live-wall',
      players: initial.players.map((player) => player.id === 0 ? { ...player, hand: [...player.hand, drawn], drawnTile: drawn } : player),
      result: tsumoResult(0, [12000, -4000, -4000, -4000]),
    });
    expect(tsumoEvents.findIndex((event) => event.type === 'tile_drawn')).toBeLessThan(tsumoEvents.findIndex((event) => event.type === 'win_declared'));
  });

  it('非法或未确认的和牌不会产生 WinDeclared', () => {
    const initial = createInitialGameState();
    const bus = new PresentationEventBus(); const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(initial, bus);
    observer.observe({ ...initial, phase: 'ron-window', result: null });
    observer.observe({ ...initial, phase: 'discard', result: null });
    expect(events.filter((event) => event.type === 'win_declared')).toHaveLength(0);
  });

  it('每名赢家发布独立的 win_scored 语义事件，且不会直接映射为语音', () => {
    const initial = createInitialGameState();
    const bus = new PresentationEventBus(); const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(initial, bus);
    const result = {
      type: 'ron' as const,
      winners: [
        { winner: 1 as const, from: 0 as const, winType: 'ron' as const, winTile: initial.players[0].hand[0], yaku: [{ id: 'riichi' as const, name: '显示名不参与语义', han: 1 }], yakuIds: ['riichi' as const], limitTier: 'mangan' as const, yakumanMultiplier: 0, totalDora: 2, han: 5, fu: 30, points: 8000, pointDeltas: [-8000, 8000, 0, 0] },
        { winner: 2 as const, from: 0 as const, winType: 'ron' as const, winTile: initial.players[0].hand[0], yaku: [{ id: 'yakuhai' as const, sourceTile: 'white' as const, name: '任意展示名', han: 1 }], yakuIds: ['yakuhai' as const], limitTier: 'yakuman' as const, yakumanMultiplier: 2, totalDora: 0, han: 0, fu: 0, points: 64000, pointDeltas: [-64000, 0, 64000, 0] },
      ],
      pointDeltas: [-72000, 8000, 64000, 0],
    };
    const ronDiscard = createTile(14, 9901);
    const settled = {
      ...initial,
      phase: 'round-ended' as const,
      lastDiscard: { player: 0 as const, tile: ronDiscard },
      players: initial.players.map((player) => player.id === 0
        ? { ...player, river: [...player.river, ronDiscard] }
        : player),
      result,
    };
    observer.observe(settled); observer.observe(settled);

    const scored = events.filter((event) => event.type === 'win_scored');
    const declared = events.filter((event) => event.type === 'win_declared');
    expect(declared.map((event) => event.type === 'win_declared' ? event.playerId : -1)).toEqual([1, 2]);
    const discardEventId = events.find((event) => event.type === 'tile_discarded')?.eventId;
    expect(discardEventId).toBeDefined();
    expect(declared.every((event) => event.type === 'win_declared' && event.sourceEventId === discardEventId)).toBe(true);
    expect(scored).toHaveLength(2);
    expect(scored).toEqual([
      expect.objectContaining({ winnerId: 1, yakuIds: ['riichi'], limitTier: 'mangan', totalDora: 2 }),
      expect.objectContaining({ winnerId: 2, yaku: [expect.objectContaining({ id: 'yakuhai', sourceTile: 'white', han: 1, yakuman: false })], limitTier: 'yakuman', yakumanMultiplier: 2 }),
    ]);
    scored.forEach((event) => expect(voiceEventFromPresentation(event)).toBeUndefined());
  });

  it('已结算的荒牌流局与四种目标中止流局各发布一次，重复 observe 不重播', () => {
    const initial = createInitialGameState();
    const bus = new PresentationEventBus(); const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(initial, bus);
    const settlements = [
      settleExhaustiveDraw(initial),
      { ...initial, phase: 'round-ended' as const, result: buildAbortiveDrawResult('suufon-renda', { triggeringPlayer: 3 }) },
      { ...initial, phase: 'round-ended' as const, result: buildAbortiveDrawResult('suukan-sanra', { triggeringPlayer: 1 }) },
      { ...initial, phase: 'round-ended' as const, result: buildAbortiveDrawResult('suucha-riichi', { triggeringPlayer: 2 }) },
      { ...initial, phase: 'round-ended' as const, result: buildAbortiveDrawResult('kyuushu-kyuuhai', { declaredBy: 0 }) },
    ];

    settlements.forEach((state) => {
      observer.observe(state);
      observer.observe(state);
      observer.observe({ ...initial, result: null });
    });

    expect(events.filter((event) => event.type === 'round_settled')).toEqual([
      expect.objectContaining({ settlementType: 'exhaustive-draw' }),
      expect.objectContaining({ settlementType: 'abortive-draw', reason: 'suufon-renda', triggeringPlayerId: 3 }),
      expect.objectContaining({ settlementType: 'abortive-draw', reason: 'suukan-sanra', triggeringPlayerId: 1 }),
      expect.objectContaining({ settlementType: 'abortive-draw', reason: 'suucha-riichi', triggeringPlayerId: 2 }),
      expect.objectContaining({ settlementType: 'abortive-draw', reason: 'kyuushu-kyuuhai', triggeringPlayerId: 0 }),
    ]);
    expect(events.filter((event) => event.type === 'round_end_announced')).toHaveLength(5);
  });

  it('三家和不冒充语音目录事件，但仍发布一次 authoritative 视觉局终事件', () => {
    const initial = createInitialGameState();
    const bus = new PresentationEventBus(); const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(initial, bus);
    observer.observe({ ...initial, phase: 'round-ended', result: buildAbortiveDrawResult('sanchahou', { triggeringPlayer: 1 }) });
    expect(events.filter((event) => event.type === 'round_settled')).toEqual([]);
    expect(events.filter((event) => event.type === 'round_end_announced')).toEqual([
      expect.objectContaining({ settlementType: 'abortive-draw', reason: 'sanchahou' }),
    ]);
  });
});
