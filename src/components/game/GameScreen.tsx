import { useEffect, useState, type ReactNode } from 'react';
import type { MatchState } from '../../game/match/types';
import { buildTenpaiDisplay } from '../../game/tenpaiDisplay';
import type { GameState, PlayerId, TileId } from '../../game/types';
import { ResultDialog } from '../ResultDialog';
import { TenpaiWaitPanel } from '../TenpaiWaitPanel';
import { AnalysisDrawer } from './AnalysisDrawer';
import { GameTopBar } from './GameTopBar';
import { LocalHandArea } from './LocalHandArea';
import { MahjongTable } from './MahjongTable';

interface GameScreenProps {
  gameState: GameState;
  matchState?: MatchState;
  analysisOpen: boolean;
  actionPrompt?: ReactNode;
  canDiscard: boolean;
  allowedDiscardInstanceIds?: string[];
  kuikaeForbiddenTileIds?: TileId[];
  onOpenRulesGuide?: () => void;
  onToggleAnalysis: () => void;
  onCloseAnalysis: () => void;
  onReturnMenu: () => void;
  onDiscard: (playerId: PlayerId, tileInstanceId: string) => void;
  onReset: () => void;
  doraGlowEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
  showTenpaiWaitsEnabled?: boolean;
  tsumoGiriDisplayEnabled?: boolean;
  localPlayerId?: PlayerId;
  revealAllHands?: boolean;
}

export function GameScreen({
  gameState,
  matchState,
  analysisOpen,
  actionPrompt,
  canDiscard,
  allowedDiscardInstanceIds,
  kuikaeForbiddenTileIds = [],
  onOpenRulesGuide,
  onToggleAnalysis,
  onCloseAnalysis,
  onReturnMenu,
  onDiscard,
  onReset,
  doraGlowEnabled = true,
  hoveredTileType = null,
  sameTileHoverEnabled = true,
  onHoveredTileTypeChange,
  showTenpaiWaitsEnabled = true,
  tsumoGiriDisplayEnabled = true,
  localPlayerId = 0,
  revealAllHands = false,
}: GameScreenProps) {
  const [previewDiscardInstanceId, setPreviewDiscardInstanceId] = useState<string | null>(null);
  const localPlayer = gameState.players[localPlayerId];
  const tenpaiDisplay = showTenpaiWaitsEnabled
    ? buildTenpaiDisplay(gameState, localPlayerId, previewDiscardInstanceId ?? undefined)
    : null;

  useEffect(() => {
    setPreviewDiscardInstanceId(null);
  }, [gameState]);

  return (
    <main className="game-screen" data-testid="game-screen">
      <GameTopBar
        gameState={gameState}
        matchState={matchState}
        analysisOpen={analysisOpen}
        onOpenRulesGuide={onOpenRulesGuide ?? (() => undefined)}
        onToggleAnalysis={onToggleAnalysis}
        onReturnMenu={onReturnMenu}
      />
      <MahjongTable gameState={gameState} matchState={matchState} bottomPlayerId={localPlayerId} revealOpponentHands={revealAllHands} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} tsumoGiriDisplayEnabled={tsumoGiriDisplayEnabled} />
      <LocalHandArea
        player={localPlayer}
        isCurrent={gameState.currentPlayer === localPlayerId}
        canDiscard={canDiscard}
        allowedDiscardInstanceIds={allowedDiscardInstanceIds}
        kuikaeForbiddenTileIds={kuikaeForbiddenTileIds}
        onDiscard={onDiscard}
        doraIndicators={gameState.doraIndicators}
        doraGlowEnabled={doraGlowEnabled}
        hoveredTileType={hoveredTileType}
        sameTileHoverEnabled={sameTileHoverEnabled}
        onHoveredTileTypeChange={onHoveredTileTypeChange}
        tsumoGiriDisplayEnabled={tsumoGiriDisplayEnabled}
        onDiscardPreviewChange={setPreviewDiscardInstanceId}
      />
      {actionPrompt ? <div className="game-prompt-layer">{actionPrompt}</div> : null}
      {tenpaiDisplay ? <div className="game-tenpai-layer"><TenpaiWaitPanel display={tenpaiDisplay} /></div> : null}
      <AnalysisDrawer open={analysisOpen} gameState={gameState} onClose={onCloseAnalysis} />
      <ResultDialog gameState={gameState} onReset={onReset} doraGlowEnabled={doraGlowEnabled} />
    </main>
  );
}
