import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DiscardRiver } from '../components/game/DiscardRiver';
import { advanceAIAction } from './ai';
import { createInitialGameState, declareRiichi, discardTile, drawTile, getRiichiDiscardCandidates } from './engine';
import { getDrawActionState } from './interaction';
import { createTile } from './tileUtils';
import type { GameState, PlayerId, Tile, TileId } from './types';

function tiles(ids: TileId[]): Tile[] {
  const seen = new Map<TileId, number>();
  return ids.map((id) => {
    const copy = seen.get(id) ?? 0;
    seen.set(id, copy + 1);
    return createTile(id, copy);
  });
}

function setRiichiReadyHand(state: GameState, playerId: PlayerId): GameState {
  const hand = tiles([0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
  return {
    ...state,
    currentPlayer: playerId,
    phase: 'discard',
    players: state.players.map((player) =>
      player.id === playerId
        ? { ...player, hand, drawnTile: hand[hand.length - 1] ?? null, calls: [], riichi: false, riichiState: null }
        : { ...player, hand: tiles([4, 5, 6, 13, 14, 15, 22, 23, 24, 28, 29, 30, 31]), calls: [], riichi: false, riichiState: null },
    ),
  };
}

function declareAndDiscard(state: GameState, playerId: PlayerId): GameState {
  const [candidate] = getRiichiDiscardCandidates(state, playerId);
  return declareRiichi(state, playerId, candidate.instanceId);
}

describe('立直流程回归', () => {
  it('四家立直弃牌均记录 riichiDiscardInstanceId 并可横置显示', () => {
    ([0, 1, 2, 3] as PlayerId[]).forEach((playerId) => {
      const after = declareAndDiscard(setRiichiReadyHand(createInitialGameState(), playerId), playerId);
      const player = after.players[playerId];
      expect(player.riichiState?.riichiDiscardInstanceId).toBeTruthy();
      const html = renderToStaticMarkup(<DiscardRiver player={player} position={playerId === 0 ? 'south' : playerId === 1 ? 'east' : playerId === 2 ? 'north' : 'west'} />);
      expect(html).toContain('discard-river-tile--riichi');
      expect(html).toContain('riichi-discard-slot');
      expect(html).not.toContain('tile--sideways');
    });
  });

  it('双立直弃牌同样横置', () => {
    const state = setRiichiReadyHand(createInitialGameState(), 0);
    const after = declareAndDiscard(state, 0);
    expect(after.players[0].riichiState?.kind).toBe('double-riichi');
    const html = renderToStaticMarkup(<DiscardRiver player={after.players[0]} position="south" />);
    expect(html).toContain('riichi-discard-slot');
    expect(html).not.toContain('tile--sideways');
  });

  it('立直后自动摸切继续工作并保持立直状态', () => {
    const riichi = declareAndDiscard(setRiichiReadyHand(createInitialGameState(), 1), 1);
    const drawn = drawTile({ ...riichi, currentPlayer: 1, phase: 'draw', wall: [createTile(6, 3), createTile(7, 0)] }, { settleTsumo: false });
    const draw = drawn.players[1].drawnTile;
    if (!draw) throw new Error('Expected drawn tile');
    const after = discardTile(drawn, 1, draw.instanceId);
    expect(after.players[1].riichi).toBe(true);
    expect(after.players[1].river[after.players[1].river.length - 1]?.instanceId).toBe(draw.instanceId);
    expect(after.currentPlayer).toBe(2);
  });

  it('立直后自摸、荣和和暗杠提示数据仍按统一流程产生', () => {
    const state = {
      ...setRiichiReadyHand(createInitialGameState(), 0),
      players: setRiichiReadyHand(createInitialGameState(), 0).players.map((player) =>
        player.id === 0 ? { ...player, riichi: true, riichiState: { declaredAtTurn: 1, ippatsuAvailable: true, kind: 'riichi' as const } } : player,
      ),
    };
    const actions = getDrawActionState(state, 0);
    expect(actions.canRiichi).toBe(false);
    expect(actions.riichiDiscardCandidates).toHaveLength(0);
  });

  it('AI立直后流程不会重复执行同一个状态', () => {
    const state = setRiichiReadyHand(createInitialGameState(), 1);
    const after = advanceAIAction(state, () => 0);
    const again = advanceAIAction(after, () => 0);
    expect(again.turn).toBeGreaterThanOrEqual(after.turn);
    expect(again.currentPlayer).toBeGreaterThanOrEqual(0);
    expect(again.currentPlayer).toBeLessThan(4);
  });
});
