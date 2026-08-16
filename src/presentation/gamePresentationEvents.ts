import { useEffect, useLayoutEffect, useRef } from 'react';
import { getPresentationFeatures, type PresentationFeatureFlagsSource } from '../config/presentationFeatures';
import type { GameState } from '../game/types';
import { PresentationEventBus, presentationEventBus } from './PresentationEventBus';

const usePresentationCommitEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export class GamePresentationEventObserver {
  private riverLengths: number[];
  private drawnTileInstanceIds: Array<string | null>;

  constructor(
    initialState: GameState,
    private readonly eventBus: PresentationEventBus = presentationEventBus,
    private readonly featureFlagsSource: PresentationFeatureFlagsSource = getPresentationFeatures,
  ) {
    this.riverLengths = initialState.players.map((player) => player.river.length);
    this.drawnTileInstanceIds = initialState.players.map((player) => player.drawnTile?.instanceId ?? null);
  }

  observe(state: GameState): void {
    const nextRiverLengths = state.players.map((player) => player.river.length);
    const nextDrawnTileInstanceIds = state.players.map((player) => player.drawnTile?.instanceId ?? null);
    const presentationEventsEnabled = this.featureFlagsSource().presentationEvents;

    state.players.forEach((player) => {
      const previousInstanceId = this.drawnTileInstanceIds[player.id] ?? null;
      const nextInstanceId = nextDrawnTileInstanceIds[player.id];
      if (
        !presentationEventsEnabled
        || state.lastDrawSource === 'initial-hand'
        || !nextInstanceId
        || nextInstanceId === previousInstanceId
      ) return;
      this.eventBus.publish({ type: 'tile_drawn', playerId: player.id });
    });

    state.players.forEach((player) => {
      const previousLength = this.riverLengths[player.id] ?? player.river.length;
      if (player.river.length <= previousLength || !presentationEventsEnabled) return;

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
    this.drawnTileInstanceIds = nextDrawnTileInstanceIds;
  }
}

export function useGamePresentationEvents(gameState: GameState): void {
  const observerRef = useRef<GamePresentationEventObserver | null>(null);
  if (!observerRef.current) observerRef.current = new GamePresentationEventObserver(gameState);

  usePresentationCommitEffect(() => {
    observerRef.current?.observe(gameState);
  }, [gameState]);
}
