import { useEffect, useRef } from 'react';
import type { GameState } from '../game/types';
import { PresentationEventBus, presentationEventBus } from './PresentationEventBus';

export class GamePresentationEventObserver {
  private riverLengths: number[];

  constructor(initialState: GameState, private readonly eventBus: PresentationEventBus = presentationEventBus) {
    this.riverLengths = initialState.players.map((player) => player.river.length);
  }

  observe(state: GameState): void {
    const nextRiverLengths = state.players.map((player) => player.river.length);

    state.players.forEach((player) => {
      const previousLength = this.riverLengths[player.id] ?? player.river.length;
      if (player.river.length <= previousLength) return;

      player.river.slice(previousLength).forEach((tile, offset) => {
        this.eventBus.publish({
          type: 'tile_discarded',
          playerId: player.id,
          tile: { id: tile.id, red: tile.red },
          riverIndex: previousLength + offset,
          isRiichiDiscard: tile.isRiichiDiscard === true,
        });
      });
    });

    this.riverLengths = nextRiverLengths;
  }
}

export function useGamePresentationEvents(gameState: GameState): void {
  const observerRef = useRef<GamePresentationEventObserver | null>(null);
  if (!observerRef.current) observerRef.current = new GamePresentationEventObserver(gameState);

  useEffect(() => {
    observerRef.current?.observe(gameState);
  }, [gameState]);
}
