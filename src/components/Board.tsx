import { useEffect, useMemo, useState } from 'react';
import { canPon } from '../game/callChecker';
import { canChi } from '../game/chiChecker';
import { getDrawActionState } from '../game/interaction';
import { canChankan, canMinkan, type KanType } from '../game/kanChecker';
import type { MatchState } from '../game/match/types';
import { getTileAlt } from '../game/tileAssets';
import type { GameState, PendingCallOption, PlayerId, Tile as TileModel, TileId } from '../game/types';
import { sortTiles, tileLabel } from '../game/tileUtils';
import { ActionPrompt } from './ActionPrompt';
import { GameScreen } from './game/GameScreen';
import { Tile } from './Tile';

interface BoardProps {
  gameState: GameState;
  matchState?: MatchState;
  onDiscard: (playerId: PlayerId, tileInstanceId: string) => void;
  onTsumo: (playerId: PlayerId) => void;
  onRon: (playerId: PlayerId) => void;
  onPassRon: (playerId: PlayerId) => void;
  onDeclareRiichi: (playerId: PlayerId, discardTileInstanceId?: string) => void;
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
  onReturnMenu?: () => void;
  doraGlowEnabled?: boolean;
  sameTileHoverEnabled?: boolean;
  showTenpaiWaitsEnabled?: boolean;
  tsumoGiriDisplayEnabled?: boolean;
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
  onReturnMenu,
  doraGlowEnabled = true,
  sameTileHoverEnabled = true,
  showTenpaiWaitsEnabled = true,
  tsumoGiriDisplayEnabled = true,
}: BoardProps) {
  const [dismissedPromptKey, setDismissedPromptKey] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [hoveredTileType, setHoveredTileType] = useState<TileId | null>(null);
  const promptKey = `${gameState.phase}-${gameState.currentPlayer}-${gameState.turn}-${gameState.players[0].drawnTile?.instanceId ?? 'none'}-${gameState.lastDiscard?.tile.instanceId ?? 'none'}`;

  useEffect(() => {
    setDismissedPromptKey(null);
  }, [promptKey]);

  useEffect(() => {
    setHoveredTileType(null);
  }, [gameState]);

  const drawActions = useMemo(() => getDrawActionState(gameState, 0), [gameState]);
  const canHumanPon = canPon(gameState, 0);
  const canHumanChi = canChi(gameState, 0);
  const canHumanMinkan = canMinkan(gameState, 0);
  const humanChiOptions = gameState.pendingCall?.options.filter((option) => option.type === 'chi' && option.player === 0) ?? [];
  const humanMinkanOptions = gameState.pendingCall?.options.filter((option) => option.type === 'kan' && option.kanType === 'minkan' && option.player === 0) ?? [];
  const canHumanChankan = canChankan(gameState, 0);
  const canHumanRon = gameState.phase === 'ron-window' && !!gameState.pendingRon?.eligibleRonPlayers.includes(0) && !gameState.pendingRon.passedPlayers.includes(0);
  const hasDrawPrompt = gameState.phase === 'discard'
    && gameState.currentPlayer === 0
    && dismissedPromptKey !== promptKey
    && (drawActions.canTsumo || drawActions.canRiichi || drawActions.canKyuushuKyuuhai || drawActions.ankanCandidates.length > 0 || drawActions.kakanCandidates.length > 0);
  const promptOpen = hasDrawPrompt
    || canHumanRon
    || (gameState.phase === 'call-window' && (canHumanPon || canHumanChi || canHumanMinkan))
    || (gameState.phase === 'chankan-window' && canHumanChankan);
  const localPlayer = gameState.players[0];
  const riichiDrawnTile = localPlayer.riichi ? localPlayer.drawnTile?.instanceId : undefined;
  const canDiscard = gameState.phase === 'discard' && gameState.currentPlayer === 0 && !promptOpen;

  const skipDrawActions = () => {
    setDismissedPromptKey(promptKey);
    onSkipDrawActions();
  };

  const clearHoveredTileType = () => setHoveredTileType(null);

  const handleDiscard = (playerId: PlayerId, tileInstanceId: string) => {
    clearHoveredTileType();
    onDiscard(playerId, tileInstanceId);
    clearHoveredTileType();
  };

  const actionPrompt = (
    <>
      {hasDrawPrompt ? (
        <ActionPrompt title="可执行操作">
          {drawActions.canTsumo && localPlayer.drawnTile ? (
            <TileActionButton label="自摸" tile={localPlayer.drawnTile} doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={setHoveredTileType} onClick={() => onTsumo(0)} />
          ) : null}
          {drawActions.canRiichi ? (
            <div className="prompt-group">
              <span>{drawActions.canDoubleRiichi ? '双立直' : '立直'}</span>
              {drawActions.riichiDiscardCandidates.map((tile) => (
                <TileActionButton
                  key={tile.instanceId}
                  label={drawActions.canDoubleRiichi ? '双立直' : '立直'}
                  ariaLabel={`${drawActions.canDoubleRiichi ? '双立直' : '立直'}并打出${tileLabel(tile.id)}`}
                  showLabel={false}
                  tile={tile}
                  doraIndicators={gameState.doraIndicators}
                  doraGlowEnabled={doraGlowEnabled}
                  hoveredTileType={hoveredTileType}
                  sameTileHoverEnabled={sameTileHoverEnabled}
                  onHoveredTileTypeChange={setHoveredTileType}
                  onClick={() => onDeclareRiichi(0, tile.instanceId)}
                />
              ))}
            </div>
          ) : null}
          {drawActions.canKyuushuKyuuhai ? <button type="button" onClick={() => onDeclareKyuushuKyuuhai(0)}>九种九牌</button> : null}
          {drawActions.ankanCandidates.map((candidate) => (
            <CallOptionButton
              key={`ankan-${candidate.tileId}`}
              label="暗杠"
              tiles={tilesForAnkan(gameState, 0, candidate.tileId)}
              doraIndicators={gameState.doraIndicators}
              doraGlowEnabled={doraGlowEnabled}
              hoveredTileType={hoveredTileType}
              sameTileHoverEnabled={sameTileHoverEnabled}
              onHoveredTileTypeChange={setHoveredTileType}
              onClick={() => onKan(0, 'ankan', candidate.tileId)}
            />
          ))}
          {drawActions.kakanCandidates.map((candidate) => (
            <CallOptionButton
              key={`kakan-${candidate.tileId}`}
              label="加杠"
              tiles={tilesForKakan(gameState, 0, candidate.tileId)}
              calledInstanceId={gameState.players[0].hand.find((tile) => tile.id === candidate.tileId)?.instanceId}
              doraIndicators={gameState.doraIndicators}
              doraGlowEnabled={doraGlowEnabled}
              hoveredTileType={hoveredTileType}
              sameTileHoverEnabled={sameTileHoverEnabled}
              onHoveredTileTypeChange={setHoveredTileType}
              onClick={() => onKan(0, 'kakan', candidate.tileId)}
            />
          ))}
          <button type="button" onClick={skipDrawActions}>跳过</button>
        </ActionPrompt>
      ) : null}

      {canHumanRon ? (
        <ActionPrompt title={`可以荣和 ${gameState.pendingRon ? tileLabel(gameState.pendingRon.tile.id) : ''}`}>
          {gameState.pendingRon ? (
            <TileActionButton label="荣和" tile={gameState.pendingRon.tile} doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={setHoveredTileType} onClick={() => onRon(0)} />
          ) : null}
          <button type="button" onClick={() => onPassRon(0)}>跳过</button>
        </ActionPrompt>
      ) : null}

      {gameState.phase === 'call-window' && (canHumanPon || canHumanChi || canHumanMinkan) ? (
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
              label="大明杠"
              tiles={tilesForMinkan(gameState, option)}
              calledInstanceId={gameState.pendingCall?.tile.instanceId}
              doraIndicators={gameState.doraIndicators}
              doraGlowEnabled={doraGlowEnabled}
              hoveredTileType={hoveredTileType}
              sameTileHoverEnabled={sameTileHoverEnabled}
              onHoveredTileTypeChange={setHoveredTileType}
              onClick={() => onKan(0, 'minkan')}
            />
          ))}
          {canHumanPon ? (
            <CallOptionButton
              label="碰"
              tiles={tilesForPon(gameState, 0)}
              calledInstanceId={gameState.pendingCall?.tile.instanceId}
              doraIndicators={gameState.doraIndicators}
              doraGlowEnabled={doraGlowEnabled}
              hoveredTileType={hoveredTileType}
              sameTileHoverEnabled={sameTileHoverEnabled}
              onHoveredTileTypeChange={setHoveredTileType}
              onClick={() => onPon(0)}
            />
          ) : null}
          {humanChiOptions.map((option, index) => (
            <CallOptionButton
              key={option.sequence?.join('-') ?? index}
              label="吃"
              tiles={tilesForChi(gameState, option)}
              calledInstanceId={gameState.pendingCall?.tile.instanceId}
              doraIndicators={gameState.doraIndicators}
              doraGlowEnabled={doraGlowEnabled}
              hoveredTileType={hoveredTileType}
              sameTileHoverEnabled={sameTileHoverEnabled}
              onHoveredTileTypeChange={setHoveredTileType}
              onClick={() => onChi(0, index)}
            />
          ))}
          <button type="button" onClick={onPassCall}>跳过</button>
        </ActionPrompt>
      ) : null}

      {gameState.phase === 'chankan-window' && canHumanChankan ? (
        <ActionPrompt title={`可以抢杠 ${gameState.pendingKakan ? tileLabel(gameState.pendingKakan.addedTile.id) : ''}`}>
          {gameState.pendingKakan ? (
            <TileActionButton label="荣和" tile={gameState.pendingKakan.addedTile} doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={setHoveredTileType} onClick={() => onChankanRon(0)} />
          ) : null}
          <button type="button" onClick={() => onPassChankan(0)}>跳过</button>
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
      allowedDiscardInstanceIds={riichiDrawnTile ? [riichiDrawnTile] : undefined}
      onOpenRulesGuide={onOpenRulesGuide ?? (() => undefined)}
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
      tsumoGiriDisplayEnabled={tsumoGiriDisplayEnabled}
    />
  );
}

function TileActionButton({
  label,
  ariaLabel,
  showLabel = true,
  tile,
  doraIndicators,
  doraGlowEnabled,
  hoveredTileType,
  sameTileHoverEnabled,
  onHoveredTileTypeChange,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  showLabel?: boolean;
  tile: TileModel;
  doraIndicators?: TileModel[];
  doraGlowEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
  onClick: () => void;
}) {
  const handleActivate = () => {
    onHoveredTileTypeChange?.(null);
    onClick();
    onHoveredTileTypeChange?.(null);
  };

  return (
    <button
      type="button"
      className="prompt-tile-action"
      onPointerDown={() => onHoveredTileTypeChange?.(null)}
      onClick={handleActivate}
      aria-label={ariaLabel ?? `${label} ${tileLabel(tile.id)}`}
    >
      {showLabel ? <span className="prompt-tile-action-label">{label}</span> : null}
      <span className="prompt-tile-action-tile">
        <Tile tile={tile} compact interactive={false} doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
      </span>
    </button>
  );
}

function CallOptionButton({
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
      className="call-option-button"
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
