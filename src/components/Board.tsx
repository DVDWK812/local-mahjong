import { useEffect, useMemo, useState } from 'react';
import { canPon } from '../game/callChecker';
import { canChi } from '../game/chiChecker';
import { getDrawActionState } from '../game/interaction';
import { canChankan, canMinkan, type KanType } from '../game/kanChecker';
import type { MatchState } from '../game/match/types';
import type { GameState, PlayerId, TileId } from '../game/types';
import { tileLabel } from '../game/tileUtils';
import { ActionPrompt } from './ActionPrompt';
import { GameScreen } from './game/GameScreen';

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
  onReturnMenu?: () => void;
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
  onReturnMenu,
}: BoardProps) {
  const [dismissedPromptKey, setDismissedPromptKey] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const promptKey = `${gameState.phase}-${gameState.currentPlayer}-${gameState.turn}-${gameState.players[0].drawnTile?.instanceId ?? 'none'}-${gameState.lastDiscard?.tile.instanceId ?? 'none'}`;

  useEffect(() => {
    setDismissedPromptKey(null);
  }, [promptKey]);

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

  const actionPrompt = (
    <>
      {hasDrawPrompt ? (
        <ActionPrompt title="可执行操作">
          {drawActions.canTsumo ? <button type="button" onClick={() => onTsumo(0)}>自摸</button> : null}
          {drawActions.canRiichi ? (
            <div className="prompt-group">
              <span>{drawActions.canDoubleRiichi ? '双立直' : '立直'}</span>
              {drawActions.riichiDiscardCandidates.map((tile) => (
                <button key={tile.instanceId} type="button" onClick={() => onDeclareRiichi(0, tile.instanceId)}>
                  打 {tileLabel(tile.id)}
                </button>
              ))}
            </div>
          ) : null}
          {drawActions.canKyuushuKyuuhai ? <button type="button" onClick={() => onDeclareKyuushuKyuuhai(0)}>九种九牌</button> : null}
          {drawActions.ankanCandidates.map((candidate) => (
            <button key={`ankan-${candidate.tileId}`} type="button" onClick={() => onKan(0, 'ankan', candidate.tileId)}>
              暗杠 {tileLabel(candidate.tileId)}
            </button>
          ))}
          {drawActions.kakanCandidates.map((candidate) => (
            <button key={`kakan-${candidate.tileId}`} type="button" onClick={() => onKan(0, 'kakan', candidate.tileId)}>
              加杠 {tileLabel(candidate.tileId)}
            </button>
          ))}
          <button type="button" onClick={skipDrawActions}>跳过</button>
        </ActionPrompt>
      ) : null}

      {canHumanRon ? (
        <ActionPrompt title={`可以荣和 ${gameState.pendingRon ? tileLabel(gameState.pendingRon.tile.id) : ''}`}>
          <button type="button" onClick={() => onRon(0)}>荣和</button>
          <button type="button" onClick={() => onPassRon(0)}>跳过</button>
        </ActionPrompt>
      ) : null}

      {gameState.phase === 'call-window' && (canHumanPon || canHumanChi || canHumanMinkan) ? (
        <ActionPrompt title={`可以鸣牌 ${gameState.pendingCall ? tileLabel(gameState.pendingCall.tile.id) : ''}`}>
          {humanMinkanOptions.map((option, index) => (
            <button key={`kan-${option.player}-${index}`} type="button" onClick={() => onKan(0, 'minkan')}>
              大明杠
            </button>
          ))}
          {canHumanPon ? <button type="button" onClick={() => onPon(0)}>碰</button> : null}
          {humanChiOptions.map((option, index) => (
            <button key={option.sequence?.join('-') ?? index} type="button" onClick={() => onChi(0, index)}>
              吃 {option.sequence?.map((id) => tileLabel(id)).join('-')}
            </button>
          ))}
          <button type="button" onClick={onPassCall}>跳过</button>
        </ActionPrompt>
      ) : null}

      {gameState.phase === 'chankan-window' && canHumanChankan ? (
        <ActionPrompt title={`可以抢杠 ${gameState.pendingKakan ? tileLabel(gameState.pendingKakan.addedTile.id) : ''}`}>
          <button type="button" onClick={() => onChankanRon(0)}>荣和</button>
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
      onToggleAnalysis={() => setAnalysisOpen((open) => !open)}
      onCloseAnalysis={() => setAnalysisOpen(false)}
      onReturnMenu={onReturnMenu ?? (() => undefined)}
      onDiscard={onDiscard}
      onReset={onReset}
    />
  );
}
