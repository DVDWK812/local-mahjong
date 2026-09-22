import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import { createTile } from '../game/tileUtils';
import type { GameState, Tile, TileId } from '../game/types';
import { PresentationPacingGate } from '../presentation/pacing/PresentationPacingGate';
import { runPacedAutomaticAction } from '../presentation/pacing/automaticActionPacing';
import { advanceAutomaticGameState } from './automaticGameProgression';

describe('automatic game progression pacing boundary', () => {
  it('AI discard presentation pending 时不提交本家 next draw，完成后才摸牌', async () => {
    const gate = new PresentationPacingGate();
    const before = localDrawState();
    let current = before;
    gate.begin({ eventId: 'ai-discard', sequence: 201 });

    const progression = runPacedAutomaticAction(() => {
      current = advanceAutomaticGameState(current);
    }, { gate });
    await Promise.resolve();

    expect(current).toBe(before);
    expect(current.players[0].drawnTile).toBeNull();

    gate.complete('ai-discard');
    await progression;

    expect(current).not.toBe(before);
    expect(current.players[0].drawnTile?.instanceId).toBe('next-local-draw');
  });

  it('AI draw presentation pending 时不提交 AI discard，完成后才弃牌', async () => {
    const gate = new PresentationPacingGate();
    const beforeDraw = aiDrawState();
    const afterDraw = advanceAutomaticGameState(beforeDraw);
    const riichiPlayer = {
      ...afterDraw.players[1],
      riichi: true,
      hand: [...afterDraw.players[1].hand],
      river: [...afterDraw.players[1].river],
    };
    let current: GameState = {
      ...afterDraw,
      players: afterDraw.players.map((player) => player.id === 1 ? riichiPlayer : player),
    };
    const riverLength = current.players[1].river.length;
    gate.begin({ eventId: 'ai-draw', sequence: 202 });

    const progression = runPacedAutomaticAction(() => {
      current = advanceAutomaticGameState(current);
    }, { gate });
    await Promise.resolve();

    expect(current.players[1].river).toHaveLength(riverLength);

    gate.complete('ai-draw');
    await progression;

    expect(current.players[1].river).toHaveLength(riverLength + 1);
  });

  it('pacing bypass 只改变 wall-clock timing，不改变最终 GameState', async () => {
    const initial = localDrawState();
    const direct = advanceAutomaticGameState(initial);
    let paced = initial;

    await runPacedAutomaticAction(() => {
      paced = advanceAutomaticGameState(paced);
    }, { gate: new PresentationPacingGate() });

    expect(paced).toEqual(direct);
  });
});

function localDrawState(): GameState {
  const state = createInitialGameState();
  const existingDrawnTileId = state.players[0].drawnTile?.instanceId;
  return {
    ...state,
    currentPlayer: 0,
    phase: 'draw',
    players: state.players.map((player) => player.id === 0 ? {
      ...player,
      hand: player.hand.filter((tile) => tile.instanceId !== existingDrawnTileId),
      drawnTile: null,
    } : player),
    wall: [tile(6, 900, 'next-local-draw'), tile(7, 901, 'wall-rest')],
  };
}

function aiDrawState(): GameState {
  const state = createInitialGameState();
  const hand = Array.from({ length: 13 }, (_, index) => tile(index as TileId, 1000 + index, `ai-hand-${index}`));
  return {
    ...state,
    currentPlayer: 1,
    phase: 'draw',
    players: state.players.map((player) => player.id === 1 ? { ...player, hand, drawnTile: null, river: [] } : player),
    wall: [tile(20, 1100, 'ai-drawn'), tile(21, 1101, 'wall-rest')],
  };
}

function tile(id: TileId, copyIndex: number, instanceId: string): Tile {
  return { ...createTile(id, copyIndex), instanceId };
}
