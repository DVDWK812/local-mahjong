import { callToMeldDisplayModel } from './meldDisplayAdapter';
import { evaluateRiichiDiscard, type RiichiDiscardEvaluation } from './engine';
import { evaluateWin } from './scoreCalculator';
import { createScoringWinContext } from './score/scoringAdapter';
import type { GameState, PlayerId, RiichiState, Tile, TileId } from './types';
import { ALL_TILE_IDS, getTileRank, getTileSuit, tileLabel } from './tileUtils';
import { getFuritenState } from './furiten';
import { meetsMinimumHanRequirement } from './winChecker';

export type TenpaiWaitStatus = 'winnable' | 'no-yaku' | 'insufficient-han' | 'furiten' | 'permanent-furiten';

export interface TenpaiWaitDisplayTile {
  id: TileId;
  label: string;
  remaining: number;
  furiten: boolean;
  status: TenpaiWaitStatus;
}

export interface TenpaiDisplay {
  waits: TenpaiWaitDisplayTile[];
  totalRemaining: number;
  currentFuriten: boolean;
  currentFuritenLabel: '当前振听' | '永久振听' | null;
  previewDiscardLabel?: string;
}

export function getCurrentWaits(state: GameState, playerId: PlayerId, discardTileInstanceId?: string): TileId[] {
  const displayState = discardTileInstanceId
    ? simulateDiscardForDisplay(state, playerId, discardTileInstanceId)
    : state;
  if (!displayState || shouldHideTenpaiDisplay(displayState, playerId, !!discardTileInstanceId)) return [];
  return getWaitScores(displayState, playerId).map(({ id }) => id);
}

export function countVisibleRemainingTiles(state: GameState, tileId: TileId, playerId: PlayerId = 0): number {
  const visible = collectVisibleTiles(state, playerId);
  return Math.max(0, 4 - visible.filter((tile) => tile.id === tileId).length);
}

export function buildTenpaiDisplay(
  state: GameState,
  playerId: PlayerId = 0,
  discardTileInstanceId?: string,
  riichiPreviewKind?: RiichiState['kind'],
): TenpaiDisplay | null {
  const riichiEvaluation = discardTileInstanceId && riichiPreviewKind
    ? evaluateRiichiDiscard(state, playerId, discardTileInstanceId)
    : null;
  if (discardTileInstanceId && riichiPreviewKind && !riichiEvaluation) return null;
  const displayState = discardTileInstanceId
    ? simulateDiscardForDisplay(state, playerId, discardTileInstanceId, riichiPreviewKind, riichiEvaluation)
    : state;
  if (!displayState || shouldHideTenpaiDisplay(displayState, playerId, !!discardTileInstanceId)) return null;
  const waitScores = getWaitScores(displayState, playerId);
  if (waitScores.length === 0) return null;
  const furiten = getFuritenState(displayState, playerId);
  const previewTile = discardTileInstanceId
    ? state.players[playerId]?.hand.find((tile) => tile.instanceId === discardTileInstanceId)
    : undefined;
  const waits = waitScores.map(({ id, hasYaku, meetsMinimumHan }) => {
      const status = getWaitStatus(hasYaku, meetsMinimumHan, furiten, displayState.players[playerId].riichi);
      return {
      id,
      label: tileLabel(id),
      remaining: countVisibleRemainingTiles(displayState, id, playerId),
      furiten: status === 'furiten' || status === 'permanent-furiten',
      status,
      };
    });
  return {
    waits,
    totalRemaining: waits.reduce((total, wait) => total + wait.remaining, 0),
    currentFuriten: furiten.discardFuriten || furiten.temporaryFuriten || furiten.riichiPermanentFuriten,
    currentFuritenLabel: furiten.riichiPermanentFuriten || (displayState.players[playerId].riichi && furiten.discardFuriten)
      ? '永久振听'
      : furiten.discardFuriten || furiten.temporaryFuriten
        ? '当前振听'
        : null,
    previewDiscardLabel: previewTile ? tileLabel(previewTile.id) : undefined,
  };
}

function shouldHideTenpaiDisplay(state: GameState, playerId: PlayerId, isDiscardPreview = false): boolean {
  if (state.result || state.phase === 'round-ended' || state.phase === 'exhaustive-draw') return true;
  const player = state.players[playerId];
  if (!player) return true;
  if (!isDiscardPreview && state.currentPlayer === playerId && state.phase === 'discard' && player.drawnTile) return true;
  return player.hand.length % 3 !== 1;
}

function getWaitScores(state: GameState, playerId: PlayerId): Array<{ id: TileId; hasYaku: boolean; meetsMinimumHan: boolean }> {
  const player = state.players[playerId];
  if (!player) return [];
  return ALL_TILE_IDS.flatMap((id) => {
    const winningTile = testTile(id);
    const score = evaluateWin([...player.hand, winningTile], createScoringWinContext({
      state,
      playerId,
      winningTile,
      winType: 'ron',
      preWinHand: player.hand,
      winningTileSource: 'discard',
    }));
    if (!score.isWinning) return [];
    return [{
      id,
      hasYaku: score.yaku.some((yaku) => yaku.han > 0 || yaku.yakuman),
      meetsMinimumHan: meetsMinimumHanRequirement(
        score.yaku,
        state.matchRuleConfig?.minimumHan,
        state.matchRuleConfig?.doraCountsTowardMinimumHan ? score.dora + score.redDora : 0,
      ),
    }];
  });
}

function getWaitStatus(
  hasYaku: boolean,
  meetsMinimumHan: boolean,
  furiten: ReturnType<typeof getFuritenState>,
  isRiichi: boolean,
): TenpaiWaitStatus {
  if (!hasYaku) return 'no-yaku';
  if (!meetsMinimumHan) return 'insufficient-han';
  if (furiten.riichiPermanentFuriten || (isRiichi && furiten.discardFuriten)) return 'permanent-furiten';
  if (furiten.discardFuriten || furiten.temporaryFuriten) return 'furiten';
  return 'winnable';
}

function simulateDiscardForDisplay(
  state: GameState,
  playerId: PlayerId,
  tileInstanceId: string,
  riichiPreviewKind?: RiichiState['kind'],
  riichiEvaluation?: RiichiDiscardEvaluation | null,
): GameState | null {
  const player = state.players[playerId];
  const discarded = player?.hand.find((tile) => tile.instanceId === tileInstanceId);
  if (!player || !discarded) return null;
  return {
    ...state,
    players: state.players.map((item) => item.id === playerId
      ? {
          ...item,
          hand: riichiEvaluation?.handAfterDiscard
            ?? item.hand.filter((tile) => tile.instanceId !== tileInstanceId),
          river: [...item.river, discarded],
          drawnTile: null,
          ...(riichiPreviewKind ? {
            riichi: true,
            riichiState: {
              declaredAtTurn: state.turn,
              ippatsuAvailable: false,
              kind: riichiPreviewKind,
              riichiDiscardInstanceId: discarded.instanceId,
            },
          } : {}),
        }
      : item),
  };
}

function collectVisibleTiles(state: GameState, playerId: PlayerId): Tile[] {
  const seen = new Set<string>();
  const visible: Tile[] = [];
  const add = (tile: Tile | undefined) => {
    if (!tile || seen.has(tile.instanceId)) return;
    seen.add(tile.instanceId);
    visible.push(tile);
  };

  state.players[playerId]?.hand.forEach(add);
  state.players.forEach((player) => {
    player.river.forEach((tile) => {
      if (!isClaimedDiscard(tile)) add(tile);
    });
    player.calls.forEach((call) => {
      const display = callToMeldDisplayModel(call, player.id);
      display.tiles.forEach((tile) => {
        if (!tile.faceDown) add(tile.tile);
      });
    });
  });
  state.doraIndicators.forEach(add);
  return visible;
}

function isClaimedDiscard(tile: Tile): boolean {
  return tile.claimed === true || tile.claimedBy !== undefined;
}

function testTile(id: TileId): Tile {
  return {
    id,
    suit: getTileSuit(id),
    rank: getTileRank(id),
    red: false,
    instanceId: `tenpai-test-${id}`,
  };
}
