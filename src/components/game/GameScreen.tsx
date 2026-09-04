import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getPresentationFeatures } from '../../config/presentationFeatures';
import type { MatchState } from '../../game/match/types';
import { buildTenpaiDisplay } from '../../game/tenpaiDisplay';
import type { GameState, PlayerId, RiichiState, TileId } from '../../game/types';
import type { PlayerProfile } from '../../profile/playerProfile';
import {
  DiscardSourceSnapshotStore,
  type DiscardSourceCapture,
  type DiscardSourceSnapshot,
} from '../../presentation/handAnimation/DiscardSourceSnapshot';
import { presentationPacingGate } from '../../presentation/pacing/PresentationPacingGate';
import {
  buildTablePresentationState,
  createTableInteractionActions,
  type TablePresentationState,
  withLocalHandSelection,
} from '../../presentation/table/TablePresentationContract';
import { ResultDialog } from '../ResultDialog';
import type { WinResultPresentationController } from '../../audio/voice/WinResultPresentationController';
import type { SettlementPresentationCoordinator } from '../../audio/voice/SettlementPresentationCoordinator';
import { TenpaiWaitPanel } from '../TenpaiWaitPanel';
import { AnalysisDrawer } from './AnalysisDrawer';
import { GameEventOverlay } from './GameEventOverlay';
import { GameTopBar } from './GameTopBar';
import { HandAnimationOverlay } from './HandAnimationOverlay';
import { LocalHandArea } from './LocalHandArea';
import { TileFaceDomAppearance } from '../../presentation/appearance/TileFaceDomAppearance';
import { TableRenderer } from '../../presentation3d/TableRenderer';
import type { TableRendererMode } from '../../presentation3d/rendererMode';
import type { LocalHandAnimation3DState } from '../../presentation3d/animation/tableAnimation3D';
import { WinPresentationOverlay } from './WinPresentationOverlay';
import type { WinPresentation3DState } from '../../presentation3d/win/winPresentation3D';
import { TABLE_PRESENTATION_TUNING } from '../../presentation3d/table/tablePresentationTuning';
import type { AppearanceSettings } from '../../presentation/appearance/appearanceSettings';
import { resolvePlayerSlotNickname, usePlayerSlotNicknames } from '../../presentation/appearance/playerSlotAvatars';

const ROUND_END_PRESENTATION_FAIL_OPEN_MS = 15_000;

interface GameScreenProps {
  gameState: GameState;
  matchState?: MatchState;
  analysisOpen: boolean;
  actionPrompt?: ReactNode;
  canDiscard: boolean;
  allowedDiscardInstanceIds?: readonly string[];
  kuikaeForbiddenTileIds?: readonly TileId[];
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
  tablePresentationState?: TablePresentationState;
  appearanceSettings?: AppearanceSettings;
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
  tablePresentationState,
  appearanceSettings,
}: GameScreenProps) {
  const slotNicknames = usePlayerSlotNicknames();
  const [handPreviewDiscardInstanceId, setHandPreviewDiscardInstanceId] = useState<string | null>(null);
  const [activeTableRenderer, setActiveTableRenderer] = useState<TableRendererMode>('2d');
  const [localHandAnimation, setLocalHandAnimation] = useState<LocalHandAnimation3DState | null>(null);
  const [localDiscardSnapshot, setLocalDiscardSnapshot] = useState<DiscardSourceSnapshot | null>(null);
  const [winPresentation3D, setWinPresentation3D] = useState<WinPresentation3DState | null>(null);
  const discardSourceSnapshotsRef = useRef<DiscardSourceSnapshotStore | null>(null);
  if (!discardSourceSnapshotsRef.current) discardSourceSnapshotsRef.current = new DiscardSourceSnapshotStore();
  const discardSourceSnapshots = discardSourceSnapshotsRef.current;
  const localPlayer = gameState.players[localPlayerId];
  const fixedBottomPlayer = gameState.players[tableBottomPlayerId];
  const baseTablePresentationState = useMemo(() => tablePresentationState
    ?? buildTablePresentationState(gameState, {
      localPlayerId,
      bottomPlayerId: tableBottomPlayerId,
      revealOpponentHands: revealAllHands,
      canDiscardOverride: canDiscard,
      allowedDiscardInstanceIdsOverride: allowedDiscardInstanceIds,
      kuikaeForbiddenTileIdsOverride: kuikaeForbiddenTileIds,
    }), [
    allowedDiscardInstanceIds,
    canDiscard,
    gameState,
    kuikaeForbiddenTileIds,
    localPlayerId,
    revealAllHands,
    tableBottomPlayerId,
    tablePresentationState,
  ]);
  const sharedTablePresentationState = useMemo(
    () => withLocalHandSelection(baseTablePresentationState, handPreviewDiscardInstanceId),
    [baseTablePresentationState, handPreviewDiscardInstanceId],
  );
  const tableInteractionActions = useMemo(() => createTableInteractionActions(
    localPlayerId,
    setHandPreviewDiscardInstanceId,
    onDiscard,
  ), [localPlayerId, onDiscard]);
  const handAnimationSessionKey = `${gameState.roundWind}-${gameState.dealer}-${gameState.honba}-${matchState?.handNumber ?? 'single'}`;
  const captureDiscardSource = useCallback((capture: DiscardSourceCapture) => {
    const snapshot: DiscardSourceSnapshot = {
      ...capture,
      sessionKey: handAnimationSessionKey,
      confirmedTurn: gameState.turn + 1,
    };
    const clearStoredSnapshot = discardSourceSnapshots.capture(snapshot);
    if (activeTableRenderer === '3d') setLocalDiscardSnapshot(snapshot);
    return () => {
      clearStoredSnapshot();
      setLocalDiscardSnapshot((current) => current?.tileInstanceId === snapshot.tileInstanceId ? null : current);
    };
  }, [activeTableRenderer, discardSourceSnapshots, gameState.turn, handAnimationSessionKey]);
  const handleLocalHandAnimationChange = useCallback((next: LocalHandAnimation3DState | null) => {
    setLocalHandAnimation(next);
    if (next?.kind === 'discard' && next.phase === 'proxy-ready') setLocalDiscardSnapshot(null);
  }, []);
  const handleWinPresentation3DChange = useCallback((next: WinPresentation3DState | null) => {
    setWinPresentation3D(activeTableRenderer === '3d' ? next : null);
  }, [activeTableRenderer]);
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
    setLocalDiscardSnapshot(null);
    setLocalHandAnimation(null);
    setWinPresentation3D(null);
  }, [discardSourceSnapshots, handAnimationSessionKey, realtimeHandAnimationsEnabled]);

  useEffect(() => {
    if (activeTableRenderer === '3d') return;
    setLocalDiscardSnapshot(null);
    setLocalHandAnimation(null);
    setWinPresentation3D(null);
  }, [activeTableRenderer]);

  useEffect(() => () => discardSourceSnapshots.clear(), [discardSourceSnapshots]);

  return (
    <main
      className="game-screen"
      data-testid="game-screen"
      data-round-end-presentation-pending={roundEndPresentationPending ? 'true' : 'false'}
    >
      <GameTopBar
        currentPlayerDisplayName={activeTableRenderer === '3d' ? resolvePlayerSlotNickname(gameState.currentPlayer, playerProfile?.nickname, slotNicknames, gameState.players[gameState.currentPlayer].name) : undefined}
        gameState={gameState}
        matchState={matchState}
        analysisOpen={analysisOpen}
        onOpenRulesGuide={onOpenRulesGuide ?? (() => undefined)}
        onOpenAudioSettings={onOpenAudioSettings ?? (() => undefined)}
        onToggleAnalysis={onToggleAnalysis}
        onReturnMenu={onReturnMenu}
      />
      <TableRenderer gameState={gameState} matchState={matchState} bottomPlayerId={tableBottomPlayerId} revealOpponentHands={revealAllHands} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} tsumoGiriDisplayEnabled={tsumoGiriDisplayEnabled} presentationState={sharedTablePresentationState} interactionActions={tableInteractionActions} animationsEnabled={realtimeHandAnimationsEnabled} animationSessionKey={handAnimationSessionKey} animationTurn={gameState.turn} localDiscardSnapshots={discardSourceSnapshots} onLocalHandAnimationChange={handleLocalHandAnimationChange} winPresentation3D={winPresentation3D} appearanceSettings={appearanceSettings} playerProfile={playerProfile} onActiveRendererChange={setActiveTableRenderer} />
      <TileFaceDomAppearance settings={activeTableRenderer === '3d' ? appearanceSettings : undefined}>
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
        presentation={sharedTablePresentationState.localHand}
        interactionActions={tableInteractionActions}
        onDiscardSourceCapture={realtimeHandAnimationsEnabled ? captureDiscardSource : undefined}
        doraIndicators={gameState.doraIndicators}
        doraGlowEnabled={doraGlowEnabled}
        doraBorderEnabled={activeTableRenderer !== '3d' || TABLE_PRESENTATION_TUNING.doraVisual.borderEnabled === 1}
        doraBreathingEnabled={activeTableRenderer !== '3d' || TABLE_PRESENTATION_TUNING.doraVisual.breathingEnabled === 1}
        hoveredTileType={hoveredTileType}
        sameTileHoverEnabled={sameTileHoverEnabled}
        onHoveredTileTypeChange={onHoveredTileTypeChange}
        tsumoGiriDisplayEnabled={tsumoGiriDisplayEnabled}
        screenSpaceOverlay={activeTableRenderer === '3d'}
        retainDiscardSourceSnapshot={activeTableRenderer === '3d'}
        discardSnapshot={activeTableRenderer === '3d' ? localDiscardSnapshot : null}
        localHandAnimation={activeTableRenderer === '3d' ? localHandAnimation : null}
      />
      </TileFaceDomAppearance>
      <HandAnimationOverlay
        bottomPlayerId={tableBottomPlayerId}
        discardSourceSnapshots={discardSourceSnapshots}
        enabled={realtimeHandAnimationsEnabled && activeTableRenderer === '2d'}
        sessionKey={handAnimationSessionKey}
        turn={gameState.turn}
      />
      <WinPresentationOverlay
        gameState={gameState}
        bottomPlayerId={tableBottomPlayerId}
        enabled={winPresentationEnabled}
        rendererMode={activeTableRenderer}
        on3DPresentationChange={handleWinPresentation3DChange}
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
