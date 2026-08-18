import { describe, expect, it, vi } from 'vitest';
import { defaultPresentationFeatures } from '../config/presentationFeatures';
import { executePon, passCall } from '../game/callChecker';
import { executeChi } from '../game/chiChecker';
import { createInitialGameState, declareRiichi, discardTile, drawTile, getRiichiDiscardCandidates } from '../game/engine';
import { executeKan } from '../game/kanChecker';
import {
  confirmBuild,
  createSeventeenStepsGame,
  discardCandidate,
  selectFixedTile,
  toSeventeenStepsGameState,
} from '../game/seventeenSteps';
import { createTile } from '../game/tileUtils';
import type { GameState, TileId } from '../game/types';
import type { PresentationEvent } from './PresentationEventBus';
import { PresentationEventBus } from './PresentationEventBus';
import { GamePresentationEventObserver } from './gamePresentationEvents';

function readyForRiichi(state: GameState): GameState {
  const ids: TileId[] = [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31];
  const hand = ids.map((id, index) => createTile(id, index % 4));
  return {
    ...state,
    currentPlayer: 0,
    phase: 'discard',
    players: state.players.map((player) => player.id === 0
      ? { ...player, hand, drawnTile: hand[hand.length - 1], calls: [], riichi: false, riichiState: null }
      : player),
  };
}

function setPresentationHand(state: GameState, playerId: 0 | 1 | 2 | 3, ids: TileId[]): GameState {
  const hand = ids.map((id, index) => createTile(id, index % 4));
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId
      ? { ...player, hand, drawnTile: null, calls: [], riichi: false, riichiState: null }
      : player),
  };
}

function chiCallWindow(): GameState {
  let state = createInitialGameState();
  state = setPresentationHand(state, 0, [1, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22, 27, 31, 33]);
  state = setPresentationHand(state, 1, [0, 2, 4, 6, 8, 10, 12, 14, 18, 20, 22, 27, 31]);
  state = { ...state, currentPlayer: 0, phase: 'discard' };
  return discardTile(state, 0, state.players[0].hand[0].instanceId);
}

function ponCallWindow(): GameState {
  let state = createInitialGameState();
  state = setPresentationHand(state, 0, [27, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
  state = setPresentationHand(state, 1, [27, 27, 1, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22]);
  state = { ...state, currentPlayer: 0, phase: 'discard' };
  return discardTile(state, 0, state.players[0].hand[0].instanceId);
}

function minkanCallWindow(): GameState {
  let state = createInitialGameState();
  state = setPresentationHand(state, 0, [12, 12, 12, 13, 14, 0, 2, 5, 7, 9, 18, 22, 31]);
  state = setPresentationHand(state, 3, [12, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 33]);
  state = { ...state, currentPlayer: 3, phase: 'discard' };
  return discardTile(state, 3, state.players[3].hand[0].instanceId);
}

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

describe('riichi_declared presentation event', () => {
  it('规则确认后严格发布一次 discard + 一次最小 riichi 事件，重复 observe 不补发', () => {
    const before = readyForRiichi(createInitialGameState());
    const candidate = getRiichiDiscardCandidates(before, 0)[0];
    const after = declareRiichi(before, 0, candidate.instanceId);
    const bus = new PresentationEventBus();
    const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(before, bus);

    observer.observe(after);
    observer.observe(after);

    expect(after).not.toBe(before);
    expect(events.map((event) => event.type)).toEqual(['tile_discarded', 'riichi_declared']);
    const discard = events[0];
    const riichi = events[1];
    expect(discard).toMatchObject({ type: 'tile_discarded', playerId: 0, isRiichiDiscard: true });
    expect(riichi).toMatchObject({ type: 'riichi_declared', playerId: 0, riverIndex: 0 });
    expect(Object.keys(riichi).sort()).toEqual(['eventId', 'playerId', 'riverIndex', 'sequence', 'type']);
    if (discard.type !== 'tile_discarded' || riichi.type !== 'riichi_declared') throw new Error('Unexpected event order');
    expect(riichi.riverIndex).toBe(discard.riverIndex);
  });

  it('非法立直不改变 GameState 且发布 0 个事件', () => {
    const before = readyForRiichi(createInitialGameState());
    const bus = new PresentationEventBus();
    const received = vi.fn();
    bus.subscribe(received);
    const observer = new GamePresentationEventObserver(before, bus);

    const after = declareRiichi(before, 1, before.players[1].hand[0].instanceId);
    observer.observe(after);

    expect(after).toBe(before);
    expect(received).not.toHaveBeenCalled();
  });
});

describe('meld_declared presentation event', () => {
  it('valid chi 只发布一次最小 confirmed meld event', () => {
    const before = chiCallWindow();
    const after = executeChi(before, 1, 0);
    const bus = new PresentationEventBus();
    const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(before, bus);

    observer.observe(after);
    observer.observe(after);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'meld_declared', playerId: 1, meldType: 'chi' });
    expect(Object.keys(events[0]).sort()).toEqual(['eventId', 'meldType', 'playerId', 'sequence', 'type']);
  });

  it('valid pon 只发布一次且不重播上一张 discard', () => {
    const before = ponCallWindow();
    const after = executePon(before, 1);
    const bus = new PresentationEventBus();
    const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(before, bus);

    observer.observe(after);
    observer.observe(after);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'meld_declared', playerId: 1, meldType: 'pon' });
    expect(events.some((event) => event.type === 'tile_discarded')).toBe(false);
  });

  it('valid minkan 先发布一次 kan event，再发布岭上 draw event', () => {
    const before = minkanCallWindow();
    const after = executeKan(before, 0, 'minkan');
    const bus = new PresentationEventBus();
    const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const observer = new GamePresentationEventObserver(before, bus);

    observer.observe(after);
    observer.observe(after);

    expect(events.filter((event) => event.type === 'meld_declared')).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'meld_declared', playerId: 0, meldType: 'kan' });
    expect(events[1]).toMatchObject({ type: 'tile_drawn', playerId: 0 });
    expect(events.some((event) => event.type === 'tile_discarded')).toBe(false);
  });

  it('ankan 与 pon-to-kakan replacement 均统一映射为 kan', () => {
    let ankanBefore = createInitialGameState();
    ankanBefore = setPresentationHand(ankanBefore, 0, [0, 0, 0, 0, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    ankanBefore = { ...ankanBefore, currentPlayer: 0, phase: 'discard' };
    const ankanAfter = executeKan(ankanBefore, 0, 'ankan', 0);
    const bus = new PresentationEventBus();
    const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    new GamePresentationEventObserver(ankanBefore, bus).observe(ankanAfter);

    const ponCall = {
      type: 'pon' as const,
      tiles: [createTile(27, 0), createTile(27, 1), createTile(27, 2)],
      from: 1 as const,
      opened: true,
    };
    const kakanBefore = {
      ...createInitialGameState(),
      players: createInitialGameState().players.map((player) => player.id === 0 ? { ...player, calls: [ponCall] } : player),
    };
    const kakanAfter = {
      ...kakanBefore,
      players: kakanBefore.players.map((player) => player.id === 0
        ? { ...player, calls: [{ ...ponCall, type: 'kan' as const, kanType: 'kakan' as const, tiles: [...ponCall.tiles, createTile(27, 3)] }] }
        : player),
    };
    new GamePresentationEventObserver(kakanBefore, bus).observe(kakanAfter);

    expect(events.filter((event) => event.type === 'meld_declared')).toEqual([
      expect.objectContaining({ playerId: 0, meldType: 'kan' }),
      expect.objectContaining({ playerId: 0, meldType: 'kan' }),
    ]);
  });

  it('invalid/cancel call 产生 0 个 meld event', () => {
    const before = chiCallWindow();
    const bus = new PresentationEventBus();
    const events: PresentationEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const invalidObserver = new GamePresentationEventObserver(before, bus);
    invalidObserver.observe(executePon(before, 2));

    const cancelObserver = new GamePresentationEventObserver(before, bus);
    cancelObserver.observe(passCall(before));

    expect(events.filter((event) => event.type === 'meld_declared')).toHaveLength(0);
  });
});
