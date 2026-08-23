import { useEffect, useLayoutEffect, useRef } from 'react';
import { getPresentationFeatures, type PresentationFeatureFlagsSource } from '../config/presentationFeatures';
import type { AbortiveDrawResult, ExhaustiveDrawResult, GameState, WinResultEntry, WinRoundResult } from '../game/types';
import type { YakuId } from '../game/score/yaku/types';
import { PresentationEventBus, type PresentationEventInput, presentationEventBus } from './PresentationEventBus';

const usePresentationCommitEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export class GamePresentationEventObserver {
  private riverLengths: number[];
  private drawnTileInstanceIds: Array<string | null>;
  private riichiDeclared: boolean[];
  private meldSignatures: string[][];
  private winSignatures: string[];
  private roundSettlementSignature: string | null;

  constructor(
    initialState: GameState,
    private readonly eventBus: PresentationEventBus = presentationEventBus,
    private readonly featureFlagsSource: PresentationFeatureFlagsSource = getPresentationFeatures,
  ) {
    this.riverLengths = initialState.players.map((player) => player.river.length);
    this.drawnTileInstanceIds = initialState.players.map((player) => player.drawnTile?.instanceId ?? null);
    this.riichiDeclared = initialState.players.map((player) => player.riichi);
    this.meldSignatures = initialState.players.map((player) => player.calls.map(meldSignature));
    this.winSignatures = winSignatures(initialState);
    this.roundSettlementSignature = roundSettlementSignature(initialState);
  }

  observe(state: GameState): void {
    const nextRiverLengths = state.players.map((player) => player.river.length);
    const nextDrawnTileInstanceIds = state.players.map((player) => player.drawnTile?.instanceId ?? null);
    const nextRiichiDeclared = state.players.map((player) => player.riichi);
    const nextMeldSignatures = state.players.map((player) => player.calls.map(meldSignature));
    const nextWinSignatures = winSignatures(state);
    const nextRoundSettlementSignature = roundSettlementSignature(state);
    const presentationEventsEnabled = this.featureFlagsSource().presentationEvents;

    state.players.forEach((player) => {
      const previous = this.meldSignatures[player.id] ?? [];
      player.calls.forEach((call, index) => {
        const appended = index >= previous.length;
        const upgradedToKan = call.type === 'kan' && previous[index] !== undefined && !previous[index].startsWith('kan:');
        if (!presentationEventsEnabled || (!appended && !upgradedToKan)) return;
        this.eventBus.publish(call.type === 'kan'
          ? { type: 'meld_declared', playerId: player.id, meldType: call.type, kanType: call.kanType }
          : { type: 'meld_declared', playerId: player.id, meldType: call.type });
      });
    });

    const result = state.result;
    if (presentationEventsEnabled && isWinResult(result)) {
      result.winners.forEach((winner, index) => {
        const signature = `${result.type}:${winner.winner}:${index}`;
        if (!this.winSignatures.includes(signature)) {
          this.eventBus.publish({ type: 'win_declared', playerId: winner.winner, winType: result.type });
          this.eventBus.publish(winScoredEvent(winner, result.type));
        }
      });
    }

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
      this.eventBus.publish({
        type: 'riichi_declared',
        playerId: player.id,
        riverIndex,
        kind: player.riichiState?.kind === 'double-riichi' ? 'double-riichi' : 'riichi',
      });
    });

    const roundSettled = roundSettledEvent(state);
    if (presentationEventsEnabled && roundSettled && nextRoundSettlementSignature !== this.roundSettlementSignature) {
      this.eventBus.publish(roundSettled);
    }

    this.riverLengths = nextRiverLengths;
    this.drawnTileInstanceIds = nextDrawnTileInstanceIds;
    this.riichiDeclared = nextRiichiDeclared;
    this.meldSignatures = nextMeldSignatures;
    this.winSignatures = nextWinSignatures;
    this.roundSettlementSignature = nextRoundSettlementSignature;
  }
}

function meldSignature(call: GameState['players'][number]['calls'][number]): string {
  return call.type === 'kan' ? `kan:${call.kanType ?? 'unknown'}` : call.type;
}

function winSignatures(state: GameState): string[] {
  const result = state.result;
  return isWinResult(result)
    ? result.winners.map((winner, index) => `${result.type}:${winner.winner}:${index}`)
    : [];
}

function isWinResult(result: GameState['result']): result is WinRoundResult {
  return result?.type === 'ron' || result?.type === 'tsumo';
}

function winScoredEvent(winner: WinResultEntry, winType: WinRoundResult['type']): Extract<PresentationEventInput, { type: 'win_scored' }> {
  const yaku = winner.yaku.flatMap((item) => item.id ? [{
    id: item.id,
    sourceTile: item.sourceTile,
    han: item.han,
    yakuman: item.yakuman === true,
  }] : []);
  const yakuIds: YakuId[] = winner.yakuIds ?? yaku.map((item) => item.id);
  return {
    type: 'win_scored',
    winnerId: winner.winner,
    winType,
    yakuIds,
    yaku,
    limitTier: winner.limitTier ?? 'none',
    yakumanMultiplier: winner.yakumanMultiplier ?? 0,
    totalDora: winner.totalDora ?? ((winner.dora ?? 0) + (winner.uraDora ?? 0) + (winner.redDora ?? 0)),
  };
}

type RoundSettledPresentationEventInput = Extract<PresentationEventInput, { type: 'round_settled' }>;

function roundSettledEvent(state: GameState): RoundSettledPresentationEventInput | undefined {
  const result = state.result;
  if (isExhaustiveDrawResult(result)) return { type: 'round_settled', settlementType: 'exhaustive-draw' };
  if (!isVoiceAbortiveDrawResult(result)) return undefined;
  return {
    type: 'round_settled',
    settlementType: 'abortive-draw',
    reason: result.reason,
    triggeringPlayerId: result.triggeringPlayer ?? result.declaredBy,
  };
}

function roundSettlementSignature(state: GameState): string | null {
  const event = roundSettledEvent(state);
  if (!event) return null;
  if (event.settlementType === 'exhaustive-draw') return 'exhaustive-draw';
  return `abortive-draw:${event.reason}:${event.triggeringPlayerId ?? 'none'}`;
}

function isExhaustiveDrawResult(result: GameState['result']): result is ExhaustiveDrawResult {
  return result?.type === 'exhaustive-draw';
}

function isVoiceAbortiveDrawResult(result: GameState['result']): result is AbortiveDrawResult & {
  readonly reason: 'suufon-renda' | 'suukan-sanra' | 'suucha-riichi' | 'kyuushu-kyuuhai';
} {
  return result?.type === 'abortive-draw'
    && (result.reason === 'suufon-renda'
      || result.reason === 'suukan-sanra'
      || result.reason === 'suucha-riichi'
      || result.reason === 'kyuushu-kyuuhai');
}

export function useGamePresentationEvents(gameState: GameState): void {
  const observerRef = useRef<GamePresentationEventObserver | null>(null);
  if (!observerRef.current) observerRef.current = new GamePresentationEventObserver(gameState);

  usePresentationCommitEffect(() => {
    observerRef.current?.observe(gameState);
  }, [gameState]);
}
