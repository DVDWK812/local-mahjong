import type { ReactNode } from 'react';
import type { MatchState } from '../../game/match/types';
import type { GameState, PlayerId } from '../../game/types';
import { ResultDialog } from '../ResultDialog';
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
  onToggleAnalysis: () => void;
  onCloseAnalysis: () => void;
  onReturnMenu: () => void;
  onDiscard: (playerId: PlayerId, tileInstanceId: string) => void;
  onReset: () => void;
}

export function GameScreen({
  gameState,
  matchState,
  analysisOpen,
  actionPrompt,
  canDiscard,
  allowedDiscardInstanceIds,
  onToggleAnalysis,
  onCloseAnalysis,
  onReturnMenu,
  onDiscard,
  onReset,
}: GameScreenProps) {
  const localPlayer = gameState.players[0];

  return (
    <main className="game-screen" data-testid="game-screen">
      <GameTopBar
        gameState={gameState}
        matchState={matchState}
        analysisOpen={analysisOpen}
        onToggleAnalysis={onToggleAnalysis}
        onReturnMenu={onReturnMenu}
      />
      <MahjongTable gameState={gameState} matchState={matchState} />
      <LocalHandArea
        player={localPlayer}
        isCurrent={gameState.currentPlayer === 0}
        canDiscard={canDiscard}
        allowedDiscardInstanceIds={allowedDiscardInstanceIds}
        onDiscard={onDiscard}
      />
      {actionPrompt ? <div className="game-prompt-layer">{actionPrompt}</div> : null}
      <AnalysisDrawer open={analysisOpen} gameState={gameState} onClose={onCloseAnalysis} />
      <ResultDialog gameState={gameState} onReset={onReset} />
    </main>
  );
}
