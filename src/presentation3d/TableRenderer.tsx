import {
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LegacyTable2D, type LegacyTable2DProps } from '../components/game/LegacyTable2D';
import { preloadHandPacks, type HandPackId } from '../hand/handPacks';
import {
  buildDoraIndicatorSlots,
  buildTablePresentationState,
  type TableInteractionActions,
  type TablePresentationState,
} from '../presentation/table/TablePresentationContract';
import { Table3DCentralHud, Table3DHud } from './Table3DHud';
import {
  resolveTableRenderer,
  shouldRender3DTable,
  type TableRendererMode,
} from './rendererMode';
import {
  classifyTableRendererError,
  inspectStandardFourPlayerState,
  resolveTableRendererDiagnostics,
  type TableRendererFallbackReason,
} from './rendererDiagnostics';
import type { DiscardSourceSnapshotStore } from '../presentation/handAnimation/DiscardSourceSnapshot';
import type { LocalHandAnimation3DState } from './animation/tableAnimation3D';
import type { TableVisualTheme } from './table/tableVisualTheme';
import type { RiichiStick3DAppearance } from './riichi/riichiStickAppearance';
import { DEFAULT_APPEARANCE_SETTINGS, type AppearanceSettings } from '../presentation/appearance/appearanceSettings';
import { resolveEffectiveHandPackIds, usePlayerSlotAppearances } from '../presentation/appearance/playerSlotAppearance';
import type { PlayerProfile } from '../profile/playerProfile';
import { buildTableSceneState } from './sceneState/buildTableSceneState';
import type { TileVisualSemanticContext } from '../presentation/table/tileVisualSemantics';
import {
  resolveWinnerRevealPlayerId3D,
  type WinPresentation3DState,
} from './win/winPresentation3D';
import { isInitialPresentationReady } from './initialSceneReady';
import { SceneErrorBoundary, SceneLoading } from './session/SceneErrorBoundary';

import { FormalTable3D } from './FormalTable3D';

type MahjongTableProps = LegacyTable2DProps;

type TableRendererProps = MahjongTableProps & Readonly<{
  renderer?: TableRendererMode;
  presentationState?: TablePresentationState;
  interactionActions?: TableInteractionActions;
  animationsEnabled?: boolean;
  animationSessionKey?: string;
  animationTurn?: number;
  localDiscardSnapshots?: DiscardSourceSnapshotStore;
  onLocalHandAnimationChange?: (state: LocalHandAnimation3DState | null) => void;
  winPresentation3D?: WinPresentation3DState | null;
  tableVisualTheme?: TableVisualTheme;
  riichiStickAppearance?: RiichiStick3DAppearance;
  appearanceSettings?: AppearanceSettings;
  playerProfile?: PlayerProfile;
  onActiveRendererChange?: (renderer: TableRendererMode) => void;
  localPresentationReady?: boolean;
  onInputResourcesReady?: () => void;
}>;

/** Session changes cancel the old scene, preload callbacks and error boundary together. */
export function TableRenderer(props: TableRendererProps) {
  return <TableRendererSession key={props.animationSessionKey ?? 'table-3d'} {...props} />;
}

function TableRendererSession({
  renderer,
  presentationState,
  interactionActions,
  animationsEnabled = false,
  animationSessionKey = 'table-3d',
  animationTurn = 0,
  localDiscardSnapshots,
  onLocalHandAnimationChange,
  winPresentation3D = null,
  tableVisualTheme,
  riichiStickAppearance,
  appearanceSettings,
  playerProfile,
  onActiveRendererChange,
  localPresentationReady = true,
  onInputResourcesReady,
  ...tableProps
}: TableRendererProps) {
  const resolveCurrentMode = () => renderer ?? resolveTableRenderer(typeof window === 'undefined' ? '' : window.location.search);
  const [mode, setMode] = useState<TableRendererMode>(resolveCurrentMode);
  const [runtimeFailure, setRuntimeFailure] = useState<Exclude<TableRendererFallbackReason, 'none'> | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [criticalHandPacksReady, setCriticalHandPacksReady] = useState(false);
  const handPackReadyGeneration = useRef(0);
  const playerSlotAppearances = usePlayerSlotAppearances();
  const standardFourPlayer = useMemo(
    () => inspectStandardFourPlayerState(tableProps.gameState),
    [tableProps.gameState.players],
  );
  const sharedPresentationState = useMemo(() => presentationState
    ?? (standardFourPlayer.supported ? buildTablePresentationState(tableProps.gameState, {
      localPlayerId: tableProps.bottomPlayerId,
      bottomPlayerId: tableProps.bottomPlayerId,
      seatMapping: tableProps.seatMapping,
      revealOpponentHands: tableProps.revealOpponentHands,
      revealedPlayerId: tableProps.revealedPlayerId,
      canDiscardOverride: false,
    }) : null), [
      presentationState,
      standardFourPlayer.supported,
      tableProps.bottomPlayerId,
      tableProps.gameState,
      tableProps.revealOpponentHands,
      tableProps.revealedPlayerId,
      tableProps.seatMapping,
    ]);
  const doraIndicatorSlots = sharedPresentationState?.doraIndicatorSlots
    ?? buildDoraIndicatorSlots(tableProps.gameState.doraIndicators);
  const bottomPlayerId = tableProps.bottomPlayerId ?? 0;
  const winnerRevealPlayerId = resolveWinnerRevealPlayerId3D(winPresentation3D, bottomPlayerId);
  const sceneState = useMemo(() => {
    if (!sharedPresentationState) return null;
    if (winnerRevealPlayerId === undefined && !winPresentation3D?.revealedPlayerIds?.length) return sharedPresentationState.scene;
    return buildTableSceneState(tableProps.gameState, {
      bottomPlayerId,
      seatMapping: tableProps.seatMapping,
      revealOpponentHands: tableProps.revealOpponentHands,
      revealedPlayerId: winnerRevealPlayerId,
      revealedPlayerIds: winPresentation3D?.revealedPlayerIds,
    });
  }, [
    sharedPresentationState,
    bottomPlayerId,
    tableProps.gameState,
    tableProps.revealOpponentHands,
    tableProps.seatMapping,
    winnerRevealPlayerId,
    winPresentation3D?.revealedPlayerIds,
  ]);
  const effectiveHandPackIds = useMemo(() => {
    if (!sceneState) return [] as HandPackId[];
    const settings = appearanceSettings ?? DEFAULT_APPEARANCE_SETTINGS;
    return resolveEffectiveHandPackIds(
      Object.values(sceneState.seats).map((seat) => seat.playerId),
      playerSlotAppearances,
      settings,
    );
  }, [appearanceSettings, playerSlotAppearances, sceneState]);
  const effectiveHandPackKey = effectiveHandPackIds.join(',');
  useEffect(() => {
    if (mode !== '3d' || effectiveHandPackIds.length === 0) return undefined;
    const generation = ++handPackReadyGeneration.current;
    void preloadHandPacks(effectiveHandPackIds).then(() => {
      if (generation === handPackReadyGeneration.current) setCriticalHandPacksReady(true);
    });
    return () => { handPackReadyGeneration.current += 1; };
  }, [effectiveHandPackKey, mode]);
  const attempted3dMount = mode === '3d' && standardFourPlayer.supported && runtimeFailure === null;
  const diagnostics = resolveTableRendererDiagnostics(
    mode,
    standardFourPlayer.supported,
    attempted3dMount,
    sceneReady,
    runtimeFailure,
  );

  useEffect(() => {
    setMode(resolveCurrentMode());
    setRuntimeFailure(null);
    setSceneReady(false);
    setCriticalHandPacksReady(false);
  }, [renderer]);

  useEffect(() => {
    onActiveRendererChange?.(diagnostics.active);
  }, [diagnostics.active, onActiveRendererChange]);

  useEffect(() => {
    if (renderer) return undefined;
    const syncMode = () => {
      setMode(resolveTableRenderer(window.location.search));
      setRuntimeFailure(null);
      setSceneReady(false);
      setCriticalHandPacksReady(false);
    };
    window.addEventListener('popstate', syncMode);
    return () => window.removeEventListener('popstate', syncMode);
  }, [renderer]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.warn(`[TableRenderer] requested=${diagnostics.requested}`);
    console.warn(
      `[TableRenderer] standardFourPlayer=${diagnostics.standardFourPlayer}`,
      {
        playerCount: standardFourPlayer.playerCount,
        playerIds: standardFourPlayer.playerIds,
        missingPlayerIds: standardFourPlayer.missingPlayerIds,
        duplicatePlayerIds: standardFourPlayer.duplicatePlayerIds,
      },
    );
    console.warn(`[TableRenderer] attempting3dMount=${diagnostics.attempted3dMount}`);
    console.warn(`[TableRenderer] active=${diagnostics.active}`);
    if (diagnostics.fallbackReason !== 'none') {
      console.warn(`[TableRenderer] fallback=${diagnostics.fallbackReason}`);
    }
  }, [
    diagnostics.active,
    diagnostics.attempted3dMount,
    diagnostics.fallbackReason,
    diagnostics.requested,
    diagnostics.standardFourPlayer,
    standardFourPlayer.duplicatePlayerIds,
    standardFourPlayer.missingPlayerIds,
    standardFourPlayer.playerCount,
    standardFourPlayer.playerIds,
  ]);

  const fail = useCallback((
    fallbackReason: Exclude<TableRendererFallbackReason, 'none'>,
    error: unknown,
    info?: ErrorInfo,
  ) => {
    if (import.meta.env.DEV) {
      console.error(`[TableRenderer] fallback=${fallbackReason}`, error, info?.componentStack ?? '');
    }
    setSceneReady(false);
    setRuntimeFailure(fallbackReason);
  }, []);
  const handleSceneError = useCallback((error: Error, info: ErrorInfo) => {
    fail(classifyTableRendererError(error), error, info);
  }, [fail]);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const handleSceneUnavailable = useCallback((error: Error) => {
    fail('webgl-init-failure', error);
  }, [fail]);
  const centralHud = useMemo(() => (
    <Table3DCentralHud
      gameState={tableProps.gameState}
      matchState={tableProps.matchState}
      bottomPlayerId={tableProps.bottomPlayerId}
      seatMapping={tableProps.seatMapping}
      activeSeats={tableProps.activeSeats}
      centerRoundLabel={tableProps.centerRoundLabel}
      centerRemainingLabel={tableProps.centerRemainingLabel}
      centerCornerLabels={tableProps.centerCornerLabels}
    />
  ), [
    tableProps.activeSeats,
    tableProps.bottomPlayerId,
    tableProps.centerCornerLabels,
    tableProps.centerRemainingLabel,
    tableProps.centerRoundLabel,
    tableProps.gameState,
    tableProps.matchState,
    tableProps.seatMapping,
  ]);
  const tileVisualContext = useMemo<TileVisualSemanticContext>(() => ({
    hoveredTileType: tableProps.hoveredTileType,
    sameTileHoverEnabled: tableProps.sameTileHoverEnabled,
    doraGlowEnabled: tableProps.doraGlowEnabled,
  }), [
    tableProps.doraGlowEnabled,
    tableProps.hoveredTileType,
    tableProps.sameTileHoverEnabled,
  ]);

  const render3D = shouldRender3DTable(mode, runtimeFailure !== null) && standardFourPlayer.supported;
  const initialPresentationReady = isInitialPresentationReady(sceneReady && criticalHandPacksReady, localPresentationReady);
  useEffect(() => {
    if (initialPresentationReady || !render3D) onInputResourcesReady?.();
  }, [initialPresentationReady, render3D, onInputResourcesReady]);
  if (!render3D || !sharedPresentationState || !sceneState) {
    return <LegacyTable2D {...tableProps} doraIndicatorSlots={doraIndicatorSlots} />;
  }

  const content: ReactNode = (
      <SceneErrorBoundary
        fallback={<LegacyTable2D {...tableProps} doraIndicatorSlots={doraIndicatorSlots} />}
        onError={handleSceneError}
      >
        <FormalTable3D
              sceneState={sceneState}
              animationsEnabled={animationsEnabled}
              animationSessionKey={animationSessionKey}
              animationTurn={animationTurn}
              localDiscardSnapshots={localDiscardSnapshots}
              onLocalHandAnimationChange={onLocalHandAnimationChange}
              winPresentation3D={winPresentation3D}
              tableVisualTheme={tableVisualTheme}
              riichiStickAppearance={riichiStickAppearance}
              appearanceSettings={appearanceSettings}
              tileVisualContext={tileVisualContext}
              centralHud={centralHud}
              onReady={handleSceneReady}
              onUnavailable={handleSceneUnavailable}
          hud={<Table3DHud {...tableProps} doraIndicatorSlots={doraIndicatorSlots} playerProfile={playerProfile} />}
        />
      </SceneErrorBoundary>
    );

  return (
    <div
      className="table-renderer-diagnostics"
      data-table-renderer-requested={diagnostics.requested}
      data-table-renderer-active={diagnostics.active}
      data-table-renderer-standard-four-player={diagnostics.standardFourPlayer ? 'true' : 'false'}
      data-table-renderer-attempted-3d-mount={diagnostics.attempted3dMount ? 'true' : 'false'}
      data-table-renderer-fallback-reason={diagnostics.fallbackReason}
      data-table-renderer-player-count={standardFourPlayer.playerCount}
      data-table-renderer-player-ids={standardFourPlayer.playerIds.join(',')}
      data-table-interaction-contract={interactionActions ? 'shared' : 'none'}
      data-initial-scene-ready={sceneReady ? 'true' : 'false'}
      data-local-presentation-ready={localPresentationReady ? 'true' : 'false'}
      data-critical-hand-packs-ready={criticalHandPacksReady ? 'true' : 'false'}
      data-effective-hand-packs={effectiveHandPackKey}
      data-presentation-revealed={initialPresentationReady ? 'true' : 'false'}
      aria-busy={initialPresentationReady ? 'false' : 'true'}
    >
      {content}
      {initialPresentationReady ? null : <SceneLoading />}
    </div>
  );
}

export function supports3DGameState(gameState: MahjongTableProps['gameState']): boolean {
  return inspectStandardFourPlayerState(gameState).supported;
}
