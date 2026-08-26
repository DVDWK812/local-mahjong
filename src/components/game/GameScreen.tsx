import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getPresentationFeatures } from '../../config/presentationFeatures';
import type { MatchState } from '../../game/match/types';
import { buildTenpaiDisplay } from '../../game/tenpaiDisplay';
import type { GameState, PlayerId, RiichiState, TileId } from '../../game/types';
import type { PlayerProfile } from '../../profile/playerProfile';
import { DiscardSourceSnapshotStore } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import { presentationPacingGate } from '../../presentation/pacing/PresentationPacingGate';
import { ResultDialog } from '../ResultDialog';
import type { WinResultPresentationController } from '../../audio/voice/WinResultPresentationController';
import type { SettlementPresentationCoordinator } from '../../audio/voice/SettlementPresentationCoordinator';
import { TenpaiWaitPanel } from '../TenpaiWaitPanel';
import { AnalysisDrawer } from './AnalysisDrawer';
import { GameEventOverlay } from './GameEventOverlay';
import { GameTopBar } from './GameTopBar';
import { HandAnimationOverlay } from './HandAnimationOverlay';
import { LocalHandArea } from './LocalHandArea';
import { MahjongTable } from './MahjongTable';
import { WinPresentationOverlay } from './WinPresentationOverlay';

const ROUND_END_PRESENTATION_FAIL_OPEN_MS = 4500;

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
  winPresentationController?: WinResultPresentationController;
  settlementPresentationCoordinator?: SettlementPresentationCoordinator;
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
  winPresentationController,
  settlementPresentationCoordinator,
}: GameScreenProps) {
  const [handPreviewDiscardInstanceId, setHandPreviewDiscardInstanceId] = useState<string | null>(null);
  const discardSourceSnapshotsRef = useRef<DiscardSourceSnapshotStore | null>(null);
  if (!discardSourceSnapshotsRef.current) discardSourceSnapshotsRef.current = new DiscardSourceSnapshotStore();
  const discardSourceSnapshots = discardSourceSnapshotsRef.current;
  const localPlayer = gameState.players[localPlayerId];
  const fixedBottomPlayer = gameState.players[tableBottomPlayerId];
  const handAnimationSessionKey = `${gameState.roundWind}-${gameState.dealer}-${gameState.honba}-${matchState?.handNumber ?? 'single'}`;
  const winPresentationKey = buildWinPresentationKey(gameState, handAnimationSessionKey);
  const roundEndPresentationKey = buildRoundEndPresentationKey(gameState, handAnimationSessionKey);
  const presentationFeatures = getPresentationFeatures();
  const winPresentationEnabled = handAnimationsEnabled
    && presentationFeatures.presentationEvents
    && presentationFeatures.handAnimations;
  const eventOverlayEnabled = handAnimationsEnabled && presentationFeatures.presentationEvents;
  const [completedRoundEndPresentationKey, setCompletedRoundEndPresentationKey] = useState<string | null>(null);
  const roundEndActivityRef = useRef<{ key: string | null; version: number }>({ key: null, version: presentationPacingGate.version });
  if (roundEndActivityRef.current.key !== roundEndPresentationKey) {
    roundEndActivityRef.current = { key: roundEndPresentationKey, version: presentationPacingGate.version };
  }
  const roundEndPresentationPending = shouldBlockRoundEndResultPresentation(
    roundEndPresentationKey,
    eventOverlayEnabled,
    completedRoundEndPresentationKey,
  );
  const realtimeHandAnimationsEnabled = handAnimationsEnabled && (
    winPresentationKey !== null
    || (gameState.phase !== 'round-ended' && gameState.phase !== 'exhaustive-draw')
  );
  const tenpaiDisplay = showTenpaiWaitsEnabled
    || tenpaiPreviewDiscardInstanceId
    ? buildTenpaiDisplay(
        gameState,
        localPlayerId,
        tenpaiPreviewDiscardInstanceId ?? handPreviewDiscardInstanceId ?? undefined,
        tenpaiPreviewDiscardInstanceId ? tenpaiPreviewRiichiKind ?? undefined : undefined,
      )
    : null;
  const settleRoundEndPresentation = useCallback(() => {
    if (roundEndPresentationKey) setCompletedRoundEndPresentationKey(roundEndPresentationKey);
  }, [roundEndPresentationKey]);

  useEffect(() => {
    if (!gameState.result) {
      winPresentationController?.reset();
      settlementPresentationCoordinator?.reset();
      return;
    }
    if (roundEndPresentationPending) return;
    settlementPresentationCoordinator?.begin({
      id: `${gameState.turn}:${gameState.result.type}:${gameState.result.pointDeltas.join(',')}:${gameState.result.type === 'ron' || gameState.result.type === 'tsumo' ? gameState.result.winners.map((winner) => winner.winner).join(',') : ''}`,
      result: gameState.result,
      playerIds: gameState.players.map((player) => player.id),
      scoreAfter: gameState.players.map((player) => player.score),
    });
  }, [gameState.result, gameState.turn, gameState.players, settlementPresentationCoordinator, winPresentationController, roundEndPresentationPending]);

  useEffect(() => {
    if (!roundEndPresentationPending || !roundEndPresentationKey) return;
    let cancelled = false;
    const winnerCount = gameState.result?.type === 'ron' || gameState.result?.type === 'tsumo'
      ? gameState.result.winners.length
      : 1;
    const failOpenMs = Math.max(ROUND_END_PRESENTATION_FAIL_OPEN_MS, 2500 + winnerCount * 1600);
    void presentationPacingGate.waitUntilActivityClearAfter(roundEndActivityRef.current.version, { timeoutMs: failOpenMs }).then((status) => {
      if (!cancelled && status === 'timed-out') setCompletedRoundEndPresentationKey(roundEndPresentationKey);
    });
    return () => { cancelled = true; };
  }, [gameState.result, roundEndPresentationKey, roundEndPresentationPending]);

  useEffect(() => {
    if (!roundEndPresentationKey) setCompletedRoundEndPresentationKey(null);
  }, [roundEndPresentationKey]);

  useEffect(() => {
    setHandPreviewDiscardInstanceId(null);
  }, [gameState]);

  useEffect(() => {
    discardSourceSnapshots.clear();
  }, [discardSourceSnapshots, handAnimationSessionKey, realtimeHandAnimationsEnabled]);

  useEffect(() => () => discardSourceSnapshots.clear(), [discardSourceSnapshots]);

  return (
    <main
      className="game-screen"
      data-testid="game-screen"
      data-round-end-presentation-pending={roundEndPresentationPending ? 'true' : 'false'}
    >
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
      <WinPresentationOverlay
        gameState={gameState}
        bottomPlayerId={tableBottomPlayerId}
        enabled={winPresentationEnabled}
        onRoundEndSettled={settleRoundEndPresentation}
      />
      <GameEventOverlay bottomPlayerId={tableBottomPlayerId} enabled={eventOverlayEnabled} onRoundEndSettled={settleRoundEndPresentation} />
      {actionPrompt ? (
        <div className="game-prompt-layer">
          {actionPrompt}
        </div>
      ) : null}
      {tenpaiDisplay ? <div className="game-tenpai-layer"><TenpaiWaitPanel display={tenpaiDisplay} /></div> : null}
      <AnalysisDrawer open={analysisOpen} gameState={gameState} onClose={onCloseAnalysis} />
      {roundEndPresentationPending ? null : (
        <ResultDialog gameState={gameState} onReset={onReset} doraGlowEnabled={doraGlowEnabled} winPresentationController={winPresentationController} settlementPresentationCoordinator={settlementPresentationCoordinator} />
      )}
    </main>
  );
}

export function buildWinPresentationKey(gameState: GameState, sessionKey: string): string | null {
  const result = gameState.result;
  if (result?.type !== 'ron' && result?.type !== 'tsumo') return null;
  return `${sessionKey}:${gameState.turn}:${result.type}:${result.winners.map((winner) => winner.winner).join(',')}`;
}

export function buildRoundEndPresentationKey(gameState: GameState, sessionKey: string): string | null {
  const result = gameState.result;
  if (!result) return null;
  if (result.type === 'abortive-draw') {
    return `${sessionKey}:${gameState.turn}:abortive-draw:${result.reason}:${result.declaredBy ?? result.triggeringPlayer ?? 'none'}`;
  }
  if (result.type === 'exhaustive-draw') {
    return `${sessionKey}:${gameState.turn}:exhaustive-draw:${result.tenpaiPlayers.join(',')}`;
  }
  return buildWinPresentationKey(gameState, sessionKey);
}

export function shouldBlockRoundEndResultPresentation(roundEndKey: string | null, enabled: boolean, completedKey: string | null): boolean {
  return roundEndKey !== null && enabled && completedKey !== roundEndKey;
}

export function shouldBlockWinResultPresentation(winKey: string | null, enabled: boolean, completedKey: string | null): boolean {
  return shouldBlockRoundEndResultPresentation(winKey, enabled, completedKey);
}
