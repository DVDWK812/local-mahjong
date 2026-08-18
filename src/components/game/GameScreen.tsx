import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MatchState } from '../../game/match/types';
import { buildTenpaiDisplay } from '../../game/tenpaiDisplay';
import type { GameState, PlayerId, RiichiState, TileId } from '../../game/types';
import type { PlayerProfile } from '../../profile/playerProfile';
import { DiscardSourceSnapshotStore } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import { ResultDialog } from '../ResultDialog';
import { TenpaiWaitPanel } from '../TenpaiWaitPanel';
import { AnalysisDrawer } from './AnalysisDrawer';
import { GameTopBar } from './GameTopBar';
import { HandAnimationOverlay } from './HandAnimationOverlay';
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
  onOpenAudioSettings?: () => void;
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
  tenpaiPreviewDiscardInstanceId?: string | null;
  tenpaiPreviewRiichiKind?: RiichiState['kind'] | null;
  tsumoGiriDisplayEnabled?: boolean;
  handAnimationsEnabled?: boolean;
  localPlayerId?: PlayerId;
  tableBottomPlayerId?: PlayerId;
  revealAllHands?: boolean;
  playerProfile?: PlayerProfile;
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
  onOpenAudioSettings,
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
  tenpaiPreviewDiscardInstanceId = null,
  tenpaiPreviewRiichiKind = null,
  tsumoGiriDisplayEnabled = true,
  handAnimationsEnabled = true,
  localPlayerId = 0,
  tableBottomPlayerId = localPlayerId,
  revealAllHands = false,
  playerProfile,
}: GameScreenProps) {
  const [handPreviewDiscardInstanceId, setHandPreviewDiscardInstanceId] = useState<string | null>(null);
  const discardSourceSnapshotsRef = useRef<DiscardSourceSnapshotStore | null>(null);
  if (!discardSourceSnapshotsRef.current) discardSourceSnapshotsRef.current = new DiscardSourceSnapshotStore();
  const discardSourceSnapshots = discardSourceSnapshotsRef.current;
  const localPlayer = gameState.players[localPlayerId];
  const fixedBottomPlayer = gameState.players[tableBottomPlayerId];
  const handAnimationSessionKey = `${gameState.roundWind}-${gameState.dealer}-${gameState.honba}-${matchState?.handNumber ?? 'single'}`;
  const realtimeHandAnimationsEnabled = handAnimationsEnabled && gameState.phase !== 'round-ended' && gameState.phase !== 'exhaustive-draw';
  const tenpaiDisplay = showTenpaiWaitsEnabled
    || tenpaiPreviewDiscardInstanceId
    ? buildTenpaiDisplay(
        gameState,
        localPlayerId,
        tenpaiPreviewDiscardInstanceId ?? handPreviewDiscardInstanceId ?? undefined,
        tenpaiPreviewDiscardInstanceId ? tenpaiPreviewRiichiKind ?? undefined : undefined,
      )
    : null;

  useEffect(() => {
    setHandPreviewDiscardInstanceId(null);
  }, [gameState]);

  useEffect(() => {
    discardSourceSnapshots.clear();
  }, [discardSourceSnapshots, handAnimationSessionKey, realtimeHandAnimationsEnabled]);

  useEffect(() => () => discardSourceSnapshots.clear(), [discardSourceSnapshots]);

  return (
    <main className="game-screen" data-testid="game-screen">
      <GameTopBar
        gameState={gameState}
        matchState={matchState}
        analysisOpen={analysisOpen}
        onOpenRulesGuide={onOpenRulesGuide ?? (() => undefined)}
        onOpenAudioSettings={onOpenAudioSettings ?? (() => undefined)}
        onToggleAnalysis={onToggleAnalysis}
        onReturnMenu={onReturnMenu}
      />
      <MahjongTable gameState={gameState} matchState={matchState} bottomPlayerId={tableBottomPlayerId} revealOpponentHands={revealAllHands} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} tsumoGiriDisplayEnabled={tsumoGiriDisplayEnabled} />
      <LocalHandArea
        player={localPlayer}
        identityPlayer={fixedBottomPlayer}
        playerProfile={playerProfile}
        meldPlayer={fixedBottomPlayer}
        isCurrent={gameState.currentPlayer === localPlayerId}
        canDiscard={canDiscard}
        allowedDiscardInstanceIds={allowedDiscardInstanceIds}
        kuikaeForbiddenTileIds={kuikaeForbiddenTileIds}
        onDiscard={onDiscard}
        onDiscardSourceCapture={realtimeHandAnimationsEnabled ? (capture) => discardSourceSnapshots.capture({
          ...capture,
          sessionKey: handAnimationSessionKey,
          confirmedTurn: gameState.turn + 1,
        }) : undefined}
        doraIndicators={gameState.doraIndicators}
        doraGlowEnabled={doraGlowEnabled}
        hoveredTileType={hoveredTileType}
        sameTileHoverEnabled={sameTileHoverEnabled}
        onHoveredTileTypeChange={onHoveredTileTypeChange}
        tsumoGiriDisplayEnabled={tsumoGiriDisplayEnabled}
        onDiscardPreviewChange={setHandPreviewDiscardInstanceId}
      />
      <HandAnimationOverlay
        bottomPlayerId={tableBottomPlayerId}
        discardSourceSnapshots={discardSourceSnapshots}
        enabled={realtimeHandAnimationsEnabled}
        sessionKey={handAnimationSessionKey}
        turn={gameState.turn}
      />
      {actionPrompt ? (
        <div className="game-prompt-layer">
          {actionPrompt}
        </div>
      ) : null}
      {tenpaiDisplay ? <div className="game-tenpai-layer"><TenpaiWaitPanel display={tenpaiDisplay} /></div> : null}
      <AnalysisDrawer open={analysisOpen} gameState={gameState} onClose={onCloseAnalysis} />
      <ResultDialog gameState={gameState} onReset={onReset} doraGlowEnabled={doraGlowEnabled} />
    </main>
  );
}
