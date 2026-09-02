import { useEffect, useMemo, useState } from 'react';
import { type KanType } from '../game/kanChecker';
import type { MatchState } from '../game/match/types';
import { getTileAlt } from '../game/tileAssets';
import type { GameState, PendingCallOption, PlayerId, Tile as TileModel, TileId } from '../game/types';
import type { PlayerProfile } from '../profile/playerProfile';
import { sortTiles, tileLabel } from '../game/tileUtils';
import { useGamePresentationEvents } from '../presentation/gamePresentationEvents';
import { buildTablePresentationState } from '../presentation/table/TablePresentationContract';
import { ActionPrompt, OperationButton, operationButtonClassName, type OperationKind } from './ActionPrompt';
import { GameScreen } from './game/GameScreen';
import { Tile } from './Tile';
import type { WinResultPresentationController } from '../audio/voice/WinResultPresentationController';
import type { SettlementPresentationCoordinator } from '../audio/voice/SettlementPresentationCoordinator';

interface BoardProps {
  gameState: GameState;
  matchState?: MatchState;
  onDiscard: (playerId: PlayerId, tileInstanceId: string) => void;
  onTsumo: (playerId: PlayerId) => void;
  onRon: (playerId: PlayerId) => void;
  onPassRon: (playerId: PlayerId) => void;
  onDeclareRiichi: (playerId: PlayerId, discardTileInstanceId: string) => void;
  onDeclareKyuushuKyuuhai: (playerId: PlayerId) => void;
  onPon: (playerId: PlayerId) => void;
  onChi: (playerId: PlayerId, optionIndex: number) => void;
  onKan: (playerId: PlayerId, kanType?: KanType, tileId?: TileId) => void;
  onChankanRon: (playerId: PlayerId) => void;
  onPassChankan: (playerId: PlayerId) => void;
  onPassCall: () => void;
  onSkipDrawActions: () => void;
  onReset: () => void;
  onOpenRulesGuide?: () => void;
  onOpenAudioSettings?: () => void;
  onReturnMenu?: () => void;
  doraGlowEnabled?: boolean;
  sameTileHoverEnabled?: boolean;
  showTenpaiWaitsEnabled?: boolean;
  tsumoGiriDisplayEnabled?: boolean;
  handAnimationsEnabled?: boolean;
  controlledPlayerId?: PlayerId;
  tableBottomPlayerId?: PlayerId;
  revealAllHands?: boolean;
  playerProfile?: PlayerProfile;
  winPresentationController?: WinResultPresentationController;
  settlementPresentationCoordinator?: SettlementPresentationCoordinator;
}

export function Board({
  gameState,
  matchState,
  onDiscard,
  onTsumo,
  onRon,
  onPassRon,
  onDeclareRiichi,
  onDeclareKyuushuKyuuhai,
  onPon,
  onChi,
  onKan,
  onChankanRon,
  onPassChankan,
  onPassCall,
  onSkipDrawActions,
  onReset,
  onOpenRulesGuide,
  onOpenAudioSettings,
  onReturnMenu,
  doraGlowEnabled = true,
  sameTileHoverEnabled = true,
  showTenpaiWaitsEnabled = true,
  tsumoGiriDisplayEnabled = true,
  handAnimationsEnabled = true,
  controlledPlayerId = 0,
  tableBottomPlayerId = controlledPlayerId,
  revealAllHands = false,
  playerProfile,
  winPresentationController,
  settlementPresentationCoordinator,
}: BoardProps) {
  useGamePresentationEvents(gameState);
  const [dismissedPromptKey, setDismissedPromptKey] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [hoveredTileType, setHoveredTileType] = useState<TileId | null>(null);
  const [riichiPreviewDiscardInstanceId, setRiichiPreviewDiscardInstanceId] = useState<string | null>(null);
  const promptKey = `${gameState.phase}-${gameState.currentPlayer}-${gameState.turn}-${controlledPlayerId}-${gameState.players[controlledPlayerId].drawnTile?.instanceId ?? 'none'}-${gameState.lastDiscard?.tile.instanceId ?? 'none'}`;

  useEffect(() => {
    setDismissedPromptKey(null);
  }, [promptKey]);

  useEffect(() => {
    setHoveredTileType(null);
    setRiichiPreviewDiscardInstanceId(null);
  }, [gameState]);

  useEffect(() => {
    setHoveredTileType(null);
    setRiichiPreviewDiscardInstanceId(null);
  }, [controlledPlayerId]);

  const tablePresentationState = useMemo(() => buildTablePresentationState(gameState, {
    localPlayerId: controlledPlayerId,
    bottomPlayerId: tableBottomPlayerId,
    revealOpponentHands: revealAllHands,
    drawPromptDismissed: dismissedPromptKey === promptKey,
  }), [
    controlledPlayerId,
    dismissedPromptKey,
    gameState,
    promptKey,
    revealAllHands,
    tableBottomPlayerId,
  ]);
  const { drawActions, legalActions, prompt, callOptions } = tablePresentationState;
  const canHumanPon = legalActions.canPon;
  const humanChiOptions = callOptions.chi;
  const humanMinkanOptions = callOptions.minkan;
  const canHumanRon = prompt.ron;
  const hasDrawPrompt = prompt.draw;
  const promptOpen = prompt.open;
  const localPlayer = gameState.players[controlledPlayerId];
  const allowedDiscardInstanceIds = tablePresentationState.localHand.playableTileInstanceIds;
  const kuikaeForbiddenTileIds = tablePresentationState.localHand.kuikaeForbiddenTileIds;
  const canDiscard = tablePresentationState.localHand.canDiscard;

  const skipDrawActions = () => {
    setRiichiPreviewDiscardInstanceId(null);
    setDismissedPromptKey(promptKey);
    onSkipDrawActions();
  };

  const clearHoveredTileType = () => setHoveredTileType(null);

  const handleDiscard = (playerId: PlayerId, tileInstanceId: string) => {
    setRiichiPreviewDiscardInstanceId(null);
    clearHoveredTileType();
    onDiscard(playerId, tileInstanceId);
    clearHoveredTileType();
  };

  const actionPrompt = (
    <>
      {hasDrawPrompt ? (
        <ActionPrompt title="可执行操作">
          {drawActions.canTsumo && localPlayer.drawnTile ? (
            <TileActionButton operation="win" label="自摸" tile={localPlayer.drawnTile} doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={setHoveredTileType} onClick={() => onTsumo(controlledPlayerId)} />
          ) : null}
          {drawActions.canRiichi ? (
            <div className="prompt-group operation-item operation-item--riichi">
              <span>{drawActions.canDoubleRiichi ? '双立直' : '立直'}</span>
              {drawActions.riichiDiscardCandidateGroups.map((candidate) => {
                const discardInstanceId = candidate.instanceIds[0];
                return (
                  <TileActionButton
                    key={candidate.key}
                    operation="riichi"
                    label={drawActions.canDoubleRiichi ? '双立直' : '立直'}
                    ariaLabel={`${drawActions.canDoubleRiichi ? '双立直' : '立直'}并打出${tileLabel(candidate.tile.id)}`}
                    showLabel={false}
                    tile={candidate.tile}
                    doraIndicators={gameState.doraIndicators}
                    doraGlowEnabled={doraGlowEnabled}
                    hoveredTileType={hoveredTileType}
                    sameTileHoverEnabled={sameTileHoverEnabled}
                    onHoveredTileTypeChange={setHoveredTileType}
                    onPreviewChange={(active) => setRiichiPreviewDiscardInstanceId(active ? discardInstanceId : null)}
                    onClick={() => {
                      setRiichiPreviewDiscardInstanceId(null);
                      if (discardInstanceId) onDeclareRiichi(controlledPlayerId, discardInstanceId);
                    }}
                  />
                );
              })}
            </div>
          ) : null}
          {drawActions.canKyuushuKyuuhai ? <OperationButton kind="abortive" onClick={() => onDeclareKyuushuKyuuhai(controlledPlayerId)}>九种九牌</OperationButton> : null}
          {drawActions.ankanCandidates.map((candidate) => (
            <CallOptionButton
              key={`ankan-${candidate.tileId}`}
              operation="kan"
              label="暗杠"
              tiles={tilesForAnkan(gameState, controlledPlayerId, candidate.tileId)}
              doraIndicators={gameState.doraIndicators}
              doraGlowEnabled={doraGlowEnabled}
              hoveredTileType={hoveredTileType}
              sameTileHoverEnabled={sameTileHoverEnabled}
              onHoveredTileTypeChange={setHoveredTileType}
              onClick={() => onKan(controlledPlayerId, 'ankan', candidate.tileId)}
            />
          ))}
          {drawActions.kakanCandidates.map((candidate) => (
            <CallOptionButton
              key={`kakan-${candidate.tileId}`}
              operation="kan"
              label="加杠"
              tiles={tilesForKakan(gameState, controlledPlayerId, candidate.tileId)}
              calledInstanceId={gameState.players[controlledPlayerId].hand.find((tile) => tile.id === candidate.tileId)?.instanceId}
              doraIndicators={gameState.doraIndicators}
              doraGlowEnabled={doraGlowEnabled}
              hoveredTileType={hoveredTileType}
              sameTileHoverEnabled={sameTileHoverEnabled}
              onHoveredTileTypeChange={setHoveredTileType}
              onClick={() => onKan(controlledPlayerId, 'kakan', candidate.tileId)}
            />
          ))}
          <OperationButton kind="pass" onClick={skipDrawActions}>跳过</OperationButton>
        </ActionPrompt>
      ) : null}

      {canHumanRon ? (
        <ActionPrompt title={`可以荣和 ${gameState.pendingRon ? tileLabel(gameState.pendingRon.tile.id) : ''}`}>
          {gameState.pendingRon ? (
            <TileActionButton operation="win" label="荣和" tile={gameState.pendingRon.tile} doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={setHoveredTileType} onClick={() => onRon(controlledPlayerId)} />
          ) : null}
          <OperationButton kind="pass" onClick={() => onPassRon(controlledPlayerId)}>跳过</OperationButton>
        </ActionPrompt>
      ) : null}

      {prompt.call ? (
        <ActionPrompt
          title={gameState.pendingCall ? (
            <span className="action-prompt-title-with-tile">
              <span>可以鸣牌</span>
              <Tile tile={gameState.pendingCall.tile} compact interactive={false} className="action-prompt-title-tile" doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={setHoveredTileType} />
            </span>
          ) : '可以鸣牌'}
          ariaLabel={gameState.pendingCall ? `可以鸣牌：${getTileAlt(gameState.pendingCall.tile)}` : '可以鸣牌'}
        >
          {humanMinkanOptions.map((option, index) => (
            <CallOptionButton
              key={`kan-${option.player}-${index}`}
              operation="kan"
              label="明杠"
              tiles={tilesForMinkan(gameState, option)}
              calledInstanceId={gameState.pendingCall?.tile.instanceId}
              doraIndicators={gameState.doraIndicators}
              doraGlowEnabled={doraGlowEnabled}
              hoveredTileType={hoveredTileType}
              sameTileHoverEnabled={sameTileHoverEnabled}
              onHoveredTileTypeChange={setHoveredTileType}
              onClick={() => onKan(controlledPlayerId, 'minkan')}
            />
          ))}
          {canHumanPon ? (
            <CallOptionButton
              operation="pon"
              label="碰"
              tiles={tilesForPon(gameState, controlledPlayerId)}
              calledInstanceId={gameState.pendingCall?.tile.instanceId}
              doraIndicators={gameState.doraIndicators}
              doraGlowEnabled={doraGlowEnabled}
              hoveredTileType={hoveredTileType}
              sameTileHoverEnabled={sameTileHoverEnabled}
              onHoveredTileTypeChange={setHoveredTileType}
              onClick={() => onPon(controlledPlayerId)}
            />
          ) : null}
          {humanChiOptions.map((option, index) => (
            <CallOptionButton
              key={option.sequence?.join('-') ?? index}
              operation="chi"
              label="吃"
              tiles={tilesForChi(gameState, option)}
              calledInstanceId={gameState.pendingCall?.tile.instanceId}
              doraIndicators={gameState.doraIndicators}
              doraGlowEnabled={doraGlowEnabled}
              hoveredTileType={hoveredTileType}
              sameTileHoverEnabled={sameTileHoverEnabled}
              onHoveredTileTypeChange={setHoveredTileType}
              onClick={() => onChi(controlledPlayerId, index)}
            />
          ))}
          <OperationButton kind="pass" onClick={onPassCall}>跳过</OperationButton>
        </ActionPrompt>
      ) : null}

      {prompt.chankan ? (
        <ActionPrompt title={`可以抢杠 ${gameState.pendingKakan ? tileLabel(gameState.pendingKakan.addedTile.id) : ''}`}>
          {gameState.pendingKakan ? (
            <TileActionButton operation="win" label="荣和" tile={gameState.pendingKakan.addedTile} doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={setHoveredTileType} onClick={() => onChankanRon(controlledPlayerId)} />
          ) : null}
          <OperationButton kind="pass" onClick={() => onPassChankan(controlledPlayerId)}>跳过</OperationButton>
        </ActionPrompt>
      ) : null}
    </>
  );

  return (
    <GameScreen
      gameState={gameState}
      matchState={matchState}
      analysisOpen={analysisOpen}
      actionPrompt={promptOpen ? actionPrompt : null}
      canDiscard={canDiscard}
      allowedDiscardInstanceIds={allowedDiscardInstanceIds}
      kuikaeForbiddenTileIds={kuikaeForbiddenTileIds}
      onOpenRulesGuide={onOpenRulesGuide ?? (() => undefined)}
      onOpenAudioSettings={onOpenAudioSettings ?? (() => undefined)}
      onToggleAnalysis={() => setAnalysisOpen((open) => !open)}
      onCloseAnalysis={() => setAnalysisOpen(false)}
      onReturnMenu={onReturnMenu ?? (() => undefined)}
      onDiscard={handleDiscard}
      onReset={onReset}
      doraGlowEnabled={doraGlowEnabled}
      hoveredTileType={hoveredTileType}
      sameTileHoverEnabled={sameTileHoverEnabled}
      onHoveredTileTypeChange={setHoveredTileType}
      showTenpaiWaitsEnabled={showTenpaiWaitsEnabled}
      tenpaiPreviewDiscardInstanceId={promptOpen ? riichiPreviewDiscardInstanceId : null}
      tenpaiPreviewRiichiKind={riichiPreviewDiscardInstanceId
        ? (drawActions.canDoubleRiichi ? 'double-riichi' : 'riichi')
        : null}
      tsumoGiriDisplayEnabled={tsumoGiriDisplayEnabled}
      handAnimationsEnabled={handAnimationsEnabled}
      localPlayerId={controlledPlayerId}
      tableBottomPlayerId={tableBottomPlayerId}
      revealAllHands={revealAllHands}
      playerProfile={playerProfile}
      winPresentationController={winPresentationController}
      settlementPresentationCoordinator={settlementPresentationCoordinator}
      tablePresentationState={tablePresentationState}
    />
  );
}

export function TileActionButton({
  operation,
  label,
  ariaLabel,
  showLabel = true,
  tile,
  doraIndicators,
  doraGlowEnabled,
  hoveredTileType,
  sameTileHoverEnabled,
  onHoveredTileTypeChange,
  onPreviewChange,
  onClick,
}: {
  operation?: Extract<OperationKind, 'win' | 'riichi'>;
  label: string;
  ariaLabel?: string;
  showLabel?: boolean;
  tile: TileModel;
  doraIndicators?: TileModel[];
  doraGlowEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
  onPreviewChange?: (active: boolean) => void;
  onClick: () => void;
}) {
  const handleActivate = () => {
    onPreviewChange?.(false);
    onHoveredTileTypeChange?.(null);
    onClick();
    onHoveredTileTypeChange?.(null);
  };

  return (
    <button
      type="button"
      className={operation ? operationButtonClassName(operation, 'prompt-tile-action') : 'prompt-tile-action'}
      data-operation={operation}
      onPointerEnter={() => onPreviewChange?.(true)}
      onPointerLeave={() => onPreviewChange?.(false)}
      onFocus={() => onPreviewChange?.(true)}
      onBlur={() => onPreviewChange?.(false)}
      onPointerDown={() => {
        onPreviewChange?.(false);
        onHoveredTileTypeChange?.(null);
      }}
      onClick={handleActivate}
      aria-label={ariaLabel ?? `${label} ${tileLabel(tile.id)}`}
    >
      {showLabel ? <span className="prompt-tile-action-label">{label}</span> : null}
      <span className="prompt-tile-action-tile">
        <Tile tile={tile} compact interactive={false} riichiCandidate={operation === 'riichi'} doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
      </span>
    </button>
  );
}

function CallOptionButton({
  operation,
  label,
  tiles,
  calledInstanceId,
  doraIndicators,
  doraGlowEnabled,
  hoveredTileType,
  sameTileHoverEnabled,
  onHoveredTileTypeChange,
  onClick,
}: {
  operation: Extract<OperationKind, 'kan' | 'pon' | 'chi'>;
  label: string;
  tiles: TileModel[];
  calledInstanceId?: string;
  doraIndicators?: TileModel[];
  doraGlowEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
  onClick: () => void;
}) {
  const ariaLabel = `${label} ${tiles.map((tile) => tileLabel(tile.id)).join('')}`;
  const handleActivate = () => {
    onHoveredTileTypeChange?.(null);
    onClick();
    onHoveredTileTypeChange?.(null);
  };

  return (
    <button
      type="button"
      className={operationButtonClassName(operation, 'call-option-button')}
      data-operation={operation}
      aria-label={ariaLabel}
      onPointerDown={() => onHoveredTileTypeChange?.(null)}
      onClick={handleActivate}
    >
      <span className="call-option-label">{label}</span>
      <span className="call-option-tiles">
        {tiles.map((tile) => (
          <span
            key={tile.instanceId}
            className={tile.instanceId === calledInstanceId ? 'call-option-tile call-option-tile--called' : 'call-option-tile'}
            data-called={tile.instanceId === calledInstanceId ? 'true' : 'false'}
          >
            <Tile tile={tile} compact interactive={false} doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
          </span>
        ))}
      </span>
    </button>
  );
}

function tilesForChi(state: GameState, option: PendingCallOption): TileModel[] {
  const called = state.pendingCall?.tile;
  if (!called || !option.sequence) return [];
  const hand = [...state.players[option.player].hand];
  return option.sequence.map((id) => {
    if (id === called.id) return called;
    const index = hand.findIndex((tile) => tile.id === id);
    const [tile] = index === -1 ? [] : hand.splice(index, 1);
    return tile ?? called;
  }).sort(sortTiles);
}

function tilesForPon(state: GameState, playerId: PlayerId): TileModel[] {
  const called = state.pendingCall?.tile;
  if (!called) return [];
  return [...state.players[playerId].hand.filter((tile) => tile.id === called.id).slice(0, 2), called].sort(sortTiles);
}

function tilesForMinkan(state: GameState, option: PendingCallOption): TileModel[] {
  const called = state.pendingCall?.tile;
  if (!called) return [];
  return [...state.players[option.player].hand.filter((tile) => tile.id === called.id).slice(0, 3), called].sort(sortTiles);
}

function tilesForAnkan(state: GameState, playerId: PlayerId, tileId: TileId): TileModel[] {
  return state.players[playerId].hand.filter((tile) => tile.id === tileId).slice(0, 4).sort(sortTiles);
}

function tilesForKakan(state: GameState, playerId: PlayerId, tileId: TileId): TileModel[] {
  const player = state.players[playerId];
  const ponTiles = player.calls.find((call) => call.type === 'pon' && call.tiles[0]?.id === tileId)?.tiles ?? [];
  const addedTile = player.hand.find((tile) => tile.id === tileId);
  return [...ponTiles, ...(addedTile ? [addedTile] : [])].sort(sortTiles);
}
