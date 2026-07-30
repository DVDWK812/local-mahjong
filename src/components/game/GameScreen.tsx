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
}

export function GameScreen({
  gameState,
  matchState,
  analysisOpen,
  actionPrompt,
  canDiscard,
  allowedDiscardInstanceIds,
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
}: GameScreenProps) {
  const [previewDiscardInstanceId, setPreviewDiscardInstanceId] = useState<string | null>(null);
  const localPlayer = gameState.players[0];
  const tenpaiDisplay = showTenpaiWaitsEnabled
    ? buildTenpaiDisplay(gameState, 0, previewDiscardInstanceId ?? undefined)
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
      <MahjongTable gameState={gameState} matchState={matchState} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} tsumoGiriDisplayEnabled={tsumoGiriDisplayEnabled} />
      <LocalHandArea
        player={localPlayer}
        isCurrent={gameState.currentPlayer === 0}
        canDiscard={canDiscard}
        allowedDiscardInstanceIds={allowedDiscardInstanceIds}
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
