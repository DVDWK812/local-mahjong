import { useEffect, useLayoutEffect, useRef } from 'react';
import { getPresentationFeatures, type PresentationFeatureFlagsSource } from '../config/presentationFeatures';
import type { GameState } from '../game/types';
import { PresentationEventBus, presentationEventBus } from './PresentationEventBus';

const usePresentationCommitEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export class GamePresentationEventObserver {
  private riverLengths: number[];
  private drawnTileInstanceIds: Array<string | null>;
  private riichiDeclared: boolean[];
  private meldSignatures: string[][];

  constructor(
    initialState: GameState,
    private readonly eventBus: PresentationEventBus = presentationEventBus,
    private readonly featureFlagsSource: PresentationFeatureFlagsSource = getPresentationFeatures,
  ) {
    this.riverLengths = initialState.players.map((player) => player.river.length);
    this.drawnTileInstanceIds = initialState.players.map((player) => player.drawnTile?.instanceId ?? null);
    this.riichiDeclared = initialState.players.map((player) => player.riichi);
    this.meldSignatures = initialState.players.map((player) => player.calls.map(meldSignature));
  }

  observe(state: GameState): void {
    const nextRiverLengths = state.players.map((player) => player.river.length);
    const nextDrawnTileInstanceIds = state.players.map((player) => player.drawnTile?.instanceId ?? null);
    const nextRiichiDeclared = state.players.map((player) => player.riichi);
    const nextMeldSignatures = state.players.map((player) => player.calls.map(meldSignature));
    const presentationEventsEnabled = this.featureFlagsSource().presentationEvents;

    state.players.forEach((player) => {
      const previous = this.meldSignatures[player.id] ?? [];
      player.calls.forEach((call, index) => {
        const appended = index >= previous.length;
        const upgradedToKan = call.type === 'kan' && previous[index] !== undefined && !previous[index].startsWith('kan:');
        if (!presentationEventsEnabled || (!appended && !upgradedToKan)) return;
        this.eventBus.publish({ type: 'meld_declared', playerId: player.id, meldType: call.type });
      });
    });

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

    state.players.forEach((player) => {
      const wasDeclared = this.riichiDeclared[player.id] ?? player.riichi;
      if (!presentationEventsEnabled || wasDeclared || !player.riichi) return;

      const discardInstanceId = player.riichiState?.riichiDiscardInstanceId;
      const riverIndex = discardInstanceId
        ? player.river.findIndex((tile) => tile.instanceId === discardInstanceId)
        : player.river.reduce((found, tile, index) => tile.isRiichiDiscard === true ? index : found, -1);
      if (riverIndex < 0) return;
      this.eventBus.publish({ type: 'riichi_declared', playerId: player.id, riverIndex });
    });

    this.riverLengths = nextRiverLengths;
    this.drawnTileInstanceIds = nextDrawnTileInstanceIds;
    this.riichiDeclared = nextRiichiDeclared;
    this.meldSignatures = nextMeldSignatures;
  }
}

function meldSignature(call: GameState['players'][number]['calls'][number]): string {
  return call.type === 'kan' ? `kan:${call.kanType ?? 'unknown'}` : call.type;
}

export function useGamePresentationEvents(gameState: GameState): void {
  const observerRef = useRef<GamePresentationEventObserver | null>(null);
  if (!observerRef.current) observerRef.current = new GamePresentationEventObserver(gameState);

  usePresentationCommitEffect(() => {
    observerRef.current?.observe(gameState);
  }, [gameState]);
}
