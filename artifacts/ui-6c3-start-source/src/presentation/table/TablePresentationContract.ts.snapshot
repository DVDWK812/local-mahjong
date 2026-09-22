import { canPon } from '../../game/callChecker';
import { canChi } from '../../game/chiChecker';
import { getDrawActionState, type DrawActionState } from '../../game/interaction';
import { canChankan, canMinkan } from '../../game/kanChecker';
import { isKuikaeEnabled, kuikaeForbiddenForPlayer, legalDiscardTiles } from '../../game/kuikae';
import type { GameState, PendingCallOption, PlayerId, Tile, TileId } from '../../game/types';
import { buildTableSceneState } from '../../presentation3d/sceneState/buildTableSceneState';
import type {
  TableSceneSeatMapping,
  TableSceneState,
} from '../../presentation3d/sceneState/tableSceneTypes';

export const DORA_INDICATOR_SLOT_COUNT = 5;

export type DoraIndicatorSlot =
  | Readonly<{ index: number; state: 'revealed'; tile: Tile }>
  | Readonly<{ index: number; state: 'hidden' }>;

export type LocalHandPresentationTile = Readonly<{
  tile: Tile;
  drawn: boolean;
  playable: boolean;
  selected: boolean;
  riichiCandidate: boolean;
}>;

export type LocalHandPresentation = Readonly<{
  playerId: PlayerId;
  tiles: readonly LocalHandPresentationTile[];
  canDiscard: boolean;
  playableTileInstanceIds: readonly string[];
  selectedTileInstanceId: string | null;
  drawnTileInstanceId: string | null;
  riichiCandidateInstanceIds: readonly string[];
  kuikaeForbiddenTileIds: readonly TileId[];
}>;

export type TableLegalActions = Readonly<{
  canTsumo: boolean;
  canRiichi: boolean;
  canKan: boolean;
  canPon: boolean;
  canChi: boolean;
  canRon: boolean;
  canSkip: boolean;
}>;

export type TablePromptState = Readonly<{
  draw: boolean;
  ron: boolean;
  call: boolean;
  chankan: boolean;
  open: boolean;
}>;

export type TablePresentationState = Readonly<{
  scene: TableSceneState;
  localHand: LocalHandPresentation;
  legalActions: TableLegalActions;
  prompt: TablePromptState;
  drawActions: DrawActionState;
  callOptions: Readonly<{
    chi: readonly PendingCallOption[];
    minkan: readonly PendingCallOption[];
  }>;
  doraIndicatorSlots: readonly DoraIndicatorSlot[];
}>;

export type TableInteractionActions = Readonly<{
  selectTile: (tileInstanceId: string | null) => void;
  discard: (tileInstanceId: string) => void;
}>;

export type BuildTablePresentationOptions = Readonly<{
  localPlayerId?: PlayerId;
  bottomPlayerId?: PlayerId;
  seatMapping?: TableSceneSeatMapping;
  revealOpponentHands?: boolean;
  revealedPlayerId?: PlayerId;
  drawPromptDismissed?: boolean;
  selectedTileInstanceId?: string | null;
  canDiscardOverride?: boolean;
  allowedDiscardInstanceIdsOverride?: readonly string[];
  kuikaeForbiddenTileIdsOverride?: readonly TileId[];
}>;

export function buildDoraIndicatorSlots(
  indicators: readonly Tile[],
): readonly DoraIndicatorSlot[] {
  return Array.from({ length: DORA_INDICATOR_SLOT_COUNT }, (_, index) => {
    const tile = indicators[index];
    return tile
      ? { index, state: 'revealed' as const, tile }
      : { index, state: 'hidden' as const };
  });
}

export function buildTablePresentationState(
  gameState: GameState,
  options: BuildTablePresentationOptions = {},
): TablePresentationState {
  const localPlayerId = options.localPlayerId ?? 0;
  const localPlayer = gameState.players[localPlayerId];
  if (!localPlayer) throw new Error(`Missing player ${localPlayerId} for table presentation`);

  const drawActions = getDrawActionState(gameState, localPlayerId);
  const canHumanPon = canPon(gameState, localPlayerId);
  const canHumanChi = canChi(gameState, localPlayerId);
  const canHumanMinkan = canMinkan(gameState, localPlayerId);
  const canHumanChankan = canChankan(gameState, localPlayerId);
  const canHumanRon = gameState.phase === 'ron-window'
    && !!gameState.pendingRon?.eligibleRonPlayers.includes(localPlayerId)
    && !gameState.pendingRon.passedPlayers.includes(localPlayerId);
  const chiOptions = gameState.pendingCall?.options.filter(
    (option) => option.type === 'chi' && option.player === localPlayerId,
  ) ?? [];
  const minkanOptions = gameState.pendingCall?.options.filter(
    (option) => option.type === 'kan'
      && option.kanType === 'minkan'
      && option.player === localPlayerId,
  ) ?? [];
  const drawPrompt = gameState.phase === 'discard'
    && gameState.currentPlayer === localPlayerId
    && options.drawPromptDismissed !== true
    && hasDrawAction(drawActions);
  const callPrompt = gameState.phase === 'call-window'
    && (canHumanPon || canHumanChi || canHumanMinkan);
  const chankanPrompt = gameState.phase === 'chankan-window' && canHumanChankan;
  const prompt: TablePromptState = {
    draw: drawPrompt,
    ron: canHumanRon,
    call: callPrompt,
    chankan: chankanPrompt,
    open: drawPrompt || canHumanRon || callPrompt || chankanPrompt,
  };

  const kuikaeForbiddenTileIds = options.kuikaeForbiddenTileIdsOverride
    ?? (isKuikaeEnabled(gameState) ? kuikaeForbiddenForPlayer(gameState, localPlayerId) : []);
  const ruleAllowedDiscardIds = options.allowedDiscardInstanceIdsOverride
    ?? (kuikaeForbiddenTileIds.length > 0
      ? legalDiscardTiles(gameState, localPlayerId).map((tile) => tile.instanceId)
      : undefined);
  const riichiDrawnTile = localPlayer.riichi ? localPlayer.drawnTile?.instanceId : undefined;
  const allowedDiscardInstanceIds = riichiDrawnTile
    ? ruleAllowedDiscardIds?.includes(riichiDrawnTile) === false ? [] : [riichiDrawnTile]
    : ruleAllowedDiscardIds;
  const canDiscard = options.canDiscardOverride
    ?? (gameState.phase === 'discard'
      && gameState.currentPlayer === localPlayerId
      && !prompt.open);
  const playableTileInstanceIds = canDiscard
    ? localPlayer.hand
      .filter((tile) => !allowedDiscardInstanceIds
        || allowedDiscardInstanceIds.includes(tile.instanceId))
      .map((tile) => tile.instanceId)
    : [];
  const playableIds = new Set(playableTileInstanceIds);
  const selectedTileInstanceId = options.selectedTileInstanceId ?? null;
  const riichiCandidateInstanceIds = drawActions.riichiDiscardCandidateGroups
    .flatMap((candidate) => candidate.instanceIds);
  const riichiCandidateIds = new Set(riichiCandidateInstanceIds);
  const drawnTileInstanceId = localPlayer.drawnTile?.instanceId ?? null;
  const baseTiles = drawnTileInstanceId
    ? localPlayer.hand.filter((tile) => tile.instanceId !== drawnTileInstanceId)
    : localPlayer.hand;
  const drawnTile = drawnTileInstanceId
    ? localPlayer.hand.find((tile) => tile.instanceId === drawnTileInstanceId)
    : undefined;
  const orderedTiles = [...baseTiles, ...(drawnTile ? [drawnTile] : [])];

  return {
    scene: buildTableSceneState(gameState, {
      bottomPlayerId: options.bottomPlayerId ?? localPlayerId,
      seatMapping: options.seatMapping,
      revealOpponentHands: options.revealOpponentHands,
      revealedPlayerId: options.revealedPlayerId,
    }),
    localHand: {
      playerId: localPlayerId,
      tiles: orderedTiles.map((tile) => ({
        tile,
        drawn: tile.instanceId === drawnTileInstanceId,
        playable: playableIds.has(tile.instanceId),
        selected: tile.instanceId === selectedTileInstanceId,
        riichiCandidate: riichiCandidateIds.has(tile.instanceId),
      })),
      canDiscard,
      playableTileInstanceIds,
      selectedTileInstanceId,
      drawnTileInstanceId,
      riichiCandidateInstanceIds,
      kuikaeForbiddenTileIds,
    },
    legalActions: {
      canTsumo: drawActions.canTsumo,
      canRiichi: drawActions.canRiichi,
      canKan: canHumanMinkan
        || drawActions.ankanCandidates.length > 0
        || drawActions.kakanCandidates.length > 0,
      canPon: canHumanPon,
      canChi: canHumanChi,
      canRon: canHumanRon || canHumanChankan,
      canSkip: prompt.open,
    },
    prompt,
    drawActions,
    callOptions: { chi: chiOptions, minkan: minkanOptions },
    doraIndicatorSlots: buildDoraIndicatorSlots(gameState.doraIndicators),
  };
}

export function createTableInteractionActions(
  playerId: PlayerId,
  onSelectTile: (tileInstanceId: string | null) => void,
  onDiscard: (playerId: PlayerId, tileInstanceId: string) => void,
): TableInteractionActions {
  return {
    selectTile: onSelectTile,
    discard: (tileInstanceId) => onDiscard(playerId, tileInstanceId),
  };
}

export function withLocalHandSelection(
  presentation: TablePresentationState,
  selectedTileInstanceId: string | null,
): TablePresentationState {
  const selectedId = presentation.localHand.tiles.some(
    (entry) => entry.tile.instanceId === selectedTileInstanceId,
  ) ? selectedTileInstanceId : null;
  if (presentation.localHand.selectedTileInstanceId === selectedId) return presentation;
  return {
    ...presentation,
    localHand: {
      ...presentation.localHand,
      selectedTileInstanceId: selectedId,
      tiles: presentation.localHand.tiles.map((entry) => ({
        ...entry,
        selected: entry.tile.instanceId === selectedId,
      })),
    },
  };
}

function hasDrawAction(drawActions: DrawActionState): boolean {
  return drawActions.canTsumo
    || drawActions.canRiichi
    || drawActions.canKyuushuKyuuhai
    || drawActions.ankanCandidates.length > 0
    || drawActions.kakanCandidates.length > 0;
}
