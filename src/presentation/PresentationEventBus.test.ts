import { describe, expect, it, vi } from 'vitest';
import { defaultPresentationFeatures } from '../config/presentationFeatures';
import { createInitialGameState, discardTile, drawTile } from '../game/engine';
import {
  confirmBuild,
  createSeventeenStepsGame,
  discardCandidate,
  selectFixedTile,
  toSeventeenStepsGameState,
} from '../game/seventeenSteps';
import type { PresentationEvent } from './PresentationEventBus';
import { PresentationEventBus } from './PresentationEventBus';
import { GamePresentationEventObserver } from './gamePresentationEvents';

describe('PresentationEventBus', () => {
  it('按顺序发布唯一事件，并支持取消订阅', () => {
    const bus = new PresentationEventBus();
    const received: PresentationEvent[] = [];
    const unsubscribe = bus.subscribe((event) => received.push(event));
    const input = {
      type: 'tile_discarded' as const,
      playerId: 0 as const,
      tile: { id: 0 as const, red: false },
      riverIndex: 0,
      isRiichiDiscard: false,
    };

    const first = bus.publish(input);
    unsubscribe();
    const second = bus.publish({ ...input, riverIndex: 1 });

    expect(received).toEqual([first]);
    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
    expect(first.eventId).not.toBe(second.eventId);
  });

  it('隔离 listener 异常并继续通知其他 listener', () => {
    const onListenerError = vi.fn();
    const bus = new PresentationEventBus(onListenerError);
    const received = vi.fn();
    bus.subscribe(() => { throw new Error('presentation failed'); });
    bus.subscribe(received);

    const event = bus.publish({
      type: 'tile_discarded',
      playerId: 0,
      tile: { id: 0, red: false },
      riverIndex: 0,
      isRiichiDiscard: false,
    });

    expect(onListenerError).toHaveBeenCalledWith(expect.any(Error), event);
    expect(received).toHaveBeenCalledWith(event);
  });
});

describe('tile_discarded presentation event', () => {
  it('默认启用 presentationEvents 与 handAnimations', () => {
    expect(defaultPresentationFeatures).toEqual({ presentationEvents: true, handAnimations: true });
  });

  it('四人模式合法弃牌只发布一次，并只包含最小公开牌信息', () => {
    const before = createInitialGameState();
    const discarded = before.players[0].hand[0];
    const bus = new PresentationEventBus();
    const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(before, bus);

    const after = discardTile(before, 0, discarded.instanceId);
    observer.observe(after);
    observer.observe(after);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'tile_discarded',
      playerId: 0,
      tile: { id: discarded.id, red: discarded.red },
      riverIndex: 0,
      isRiichiDiscard: false,
    });
    const publishedEvent = events[0];
    expect(publishedEvent.type).toBe('tile_discarded');
    if (publishedEvent.type !== 'tile_discarded') throw new Error('Expected a tile_discarded event');
    expect(Object.keys(publishedEvent.tile).sort()).toEqual(['id', 'red']);
    expect(after.players[0].river).toHaveLength(before.players[0].river.length + 1);
  });

  it('presentationEvents 关闭时不发布，但弃牌状态正常推进', () => {
    const before = createInitialGameState();
    const discarded = before.players[0].hand[0];
    const bus = new PresentationEventBus();
    const received = vi.fn();
    bus.subscribe(received);
    const observer = new GamePresentationEventObserver(before, bus, () => ({ presentationEvents: false, handAnimations: true }));

    const after = discardTile(before, 0, discarded.instanceId);
    observer.observe(after);

    expect(received).not.toHaveBeenCalled();
    expect(after.players[0].hand).toHaveLength(before.players[0].hand.length - 1);
    expect(after.players[0].river[0]?.instanceId).toBe(discarded.instanceId);
    expect(after.currentPlayer).toBe(1);
    expect(after.turn).toBe(before.turn + 1);
  });

  it('开关 presentationEvents 不改变确定性 GameState', () => {
    const before = createInitialGameState();
    const discarded = before.players[0].hand[0];
    const enabledAfter = discardTile(before, 0, discarded.instanceId);
    const disabledAfter = discardTile(before, 0, discarded.instanceId);

    new GamePresentationEventObserver(before, new PresentationEventBus(), () => ({ presentationEvents: true, handAnimations: true })).observe(enabledAfter);
    new GamePresentationEventObserver(before, new PresentationEventBus(), () => ({ presentationEvents: false, handAnimations: true })).observe(disabledAfter);

    expect(disabledAfter).toEqual(enabledAfter);
  });

  it('关闭期间推进水位，重新开启后不补发历史事件且 sequence 从实际发布开始', () => {
    let presentationEvents = false;
    const before = createInitialGameState();
    const bus = new PresentationEventBus();
    const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(before, bus, () => ({ presentationEvents, handAnimations: true }));
    const disabledAfter = discardTile(before, 0, before.players[0].hand[0].instanceId);

    observer.observe(disabledAfter);
    presentationEvents = true;
    observer.observe(disabledAfter);
    observer.observe(disabledAfter);
    expect(events).toHaveLength(0);

    const nextRound = createInitialGameState();
    observer.observe(nextRound);
    const enabledAfter = discardTile(nextRound, 0, nextRound.players[0].hand[0].instanceId);
    observer.observe(enabledAfter);
    observer.observe(enabledAfter);

    expect(events).toHaveLength(1);
    expect(events[0].sequence).toBe(1);
  });

  it('非法弃牌不改变 GameState，也不发布事件', () => {
    const before = createInitialGameState();
    const bus = new PresentationEventBus();
    const received = vi.fn();
    bus.subscribe(received);
    const observer = new GamePresentationEventObserver(before, bus);

    const after = discardTile(before, 1, before.players[1].hand[0].instanceId);
    observer.observe(after);

    expect(after).toBe(before);
    expect(received).not.toHaveBeenCalled();
  });

  it('没有 listener 时弃牌规则结果保持正常', () => {
    const before = createInitialGameState();
    const observer = new GamePresentationEventObserver(before, new PresentationEventBus());
    const discarded = before.players[0].hand[0];

    const after = discardTile(before, 0, discarded.instanceId);
    observer.observe(after);

    expect(after).not.toBe(before);
    expect(after.players[0].hand).toHaveLength(before.players[0].hand.length - 1);
    expect(after.players[0].river[after.players[0].river.length - 1]?.instanceId).toBe(discarded.instanceId);
  });

  it('表现 listener 不能修改弃牌规则结果', () => {
    const before = createInitialGameState();
    const discarded = before.players[0].hand[0];
    const expected = discardTile(before, 0, discarded.instanceId);
    const actual = discardTile(before, 0, discarded.instanceId);
    const onListenerError = vi.fn();
    const bus = new PresentationEventBus(onListenerError);
    bus.subscribe((event) => {
      if (event.type === 'tile_discarded') (event.tile as { id: number }).id = 33;
    });

    new GamePresentationEventObserver(before, bus).observe(actual);

    expect(onListenerError).toHaveBeenCalledOnce();
    expect(actual).toEqual(expected);
  });

  it('17步模式复用同一观察入口且不改变原有状态推进', () => {
    let state = createSeventeenStepsGame();
    state.players[0].sourceTiles.slice(0, 13).forEach((tile) => {
      state = selectFixedTile(state, 0, tile.instanceId);
    });
    state = confirmBuild(state, 0);
    const candidate = state.players[0].discardCandidates[0];
    const bus = new PresentationEventBus();
    const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(toSeventeenStepsGameState(state), bus);

    const after = discardCandidate(state, 0, candidate.instanceId);
    observer.observe(toSeventeenStepsGameState(after));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'tile_discarded',
      playerId: 0,
      tile: { id: candidate.id, red: candidate.red },
      riverIndex: 0,
      isRiichiDiscard: true,
    });
    expect(after.players[0].discardCount).toBe(1);
  });
});

describe('tile_drawn presentation event', () => {
  function stateBeforeConfirmedDraw() {
    const initial = createInitialGameState();
    return {
      ...initial,
      phase: 'draw' as const,
      currentPlayer: 1 as const,
      players: initial.players.map((player) => player.id === 1 ? { ...player, drawnTile: null } : player),
    };
  }

  it('confirmed draw 只发布一次且不包含隐藏牌身份', () => {
    const before = stateBeforeConfirmedDraw();
    const after = drawTile(before, { settleTsumo: false });
    const bus = new PresentationEventBus();
    const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(before, bus);

    observer.observe(after);
    observer.observe(after);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'tile_drawn', playerId: 1 });
    expect(Object.keys(events[0]).sort()).toEqual(['eventId', 'playerId', 'sequence', 'type']);
    expect(JSON.stringify(events[0])).not.toContain(after.players[1].drawnTile?.instanceId);
    expect(JSON.stringify(events[0])).not.toContain(`\"id\":${after.players[1].drawnTile?.id}`);
  });

  it('没有 confirmed draw 时不发布，关闭期间也不会补发', () => {
    let presentationEvents = false;
    const before = stateBeforeConfirmedDraw();
    const after = drawTile(before, { settleTsumo: false });
    const bus = new PresentationEventBus();
    const received = vi.fn();
    bus.subscribe(received);
    const observer = new GamePresentationEventObserver(before, bus, () => ({ presentationEvents, handAnimations: true }));

    observer.observe(before);
    observer.observe(after);
    presentationEvents = true;
    observer.observe(after);

    expect(received).not.toHaveBeenCalled();
    expect(after.players[1].drawnTile).not.toBeNull();
  });
});
