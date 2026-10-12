import { memo, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Texture } from 'three';
import { SceneCanvasHost, SceneContentReady } from './session/SceneCanvasHost';
export { CanvasUnavailable } from './session/SceneCanvasHost';
import { FixedTableCamera, TABLE_CAMERA } from './camera/FixedTableCamera';
import type { Table3DSeat } from './coordinates/seatTransforms';
import { Hand3D } from './hand/Hand3D';
import { TableLighting } from './lighting/TableLighting';
import { NorthTiles3D } from './meld/NorthTiles3D';
import { FlowerTiles3D } from './meld/FlowerTiles3D';
import { Meld3D } from './meld/Meld3D';
import { River3D } from './river/River3D';
import type { OccupiedTableSceneState } from './sceneState/tableSceneTypes';
import { TableMesh } from './table/TableMesh';
import { TableEnvironment } from './table/TableEnvironment';
import { DEFAULT_TABLE_VISUAL_THEME, type TableVisualTheme } from './table/tableVisualTheme';
import { HandAction3D } from './animation/HandAction3D';
import { DiscardSource3DStore } from './animation/DiscardSource3D';
import { useTableAnimation3D } from './animation/useTableAnimation3D';
import type { TableAnimation3DRenderState } from './animation/useTableAnimation3D';
import type { DiscardSourceSnapshotStore } from '../presentation/handAnimation/DiscardSourceSnapshot';
import type { LocalHandAnimation3DState } from './animation/tableAnimation3D';
import type { TileVisualSemanticContext } from '../presentation/table/tileVisualSemantics';
import { CentralConsoleHudAnchor3D } from './table/CentralConsoleHudAnchor3D';
import { TileTextureWarmup } from './tile/TileTextureWarmup';
import { resolveVisibleRiichiSeats, RiichiSticks3D } from './riichi/RiichiSticks3D';
import type { RiichiStick3DAppearance } from './riichi/riichiStickAppearance';
import './table3d.css';
import './hand/handSnapshot.css';
import {
  resolveWinningRiverTarget3D,
  type WinPresentation3DState,
} from './win/winPresentation3D';
import { DoraSweep3DProvider } from './dora/DoraSweep3DProvider';
import { resolveDoraSweep3DTrigger } from './dora/doraSweep3DTrigger';
import { AppearanceResources3D } from './appearance/AppearanceResources3D';
import { DEFAULT_APPEARANCE_SETTINGS, type AppearanceSettings } from '../presentation/appearance/appearanceSettings';
import { AvatarFrameTuningPanel } from './table/AvatarFrameTuningPanel';
import { resolveHandPackForPlayer, usePlayerSlotAppearances } from '../presentation/appearance/playerSlotAppearance';
import { RegionGroup } from './coordinates/RegionGroup';

type Table3DSceneProps = Readonly<{
  sceneState: OccupiedTableSceneState;
  animationsEnabled?: boolean;
  animationSessionKey?: string;
  animationTurn?: number;
  localDiscardSnapshots?: DiscardSourceSnapshotStore;
  onLocalHandAnimationChange?: (state: LocalHandAnimation3DState | null) => void;
  winPresentation3D?: WinPresentation3DState | null;
  tableVisualTheme?: TableVisualTheme;
  tileVisualContext?: TileVisualSemanticContext;
  riichiStickAppearance?: RiichiStick3DAppearance;
  appearanceSettings?: AppearanceSettings;
  centralHud?: ReactNode;
  onReady?: () => void;
  onUnavailable?: (error: Error) => void;
}>;

const SEAT_ORDER: readonly Table3DSeat[] = ['bottom', 'right', 'top', 'left'];

function isAvatarFrameTuningEnabled(): boolean {
  return import.meta.env.DEV
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('avatarFrameTuning') === '1';
}

const StableTableScene = memo(function StableTableScene({
  sceneState,
  hiddenHandKeys,
  handPresentation,
  hiddenRiverKeys,
  hiddenMeldTileKeys,
  hiddenNorthKeys,
  winPresentation3D,
  winHandPack,
  tableVisualTheme,
  tileVisualContext,
  feltTexture,
  centralHud,
  onTileLayerReady,
}: Readonly<{
  sceneState: OccupiedTableSceneState;
  hiddenHandKeys: TableAnimation3DRenderState['hiddenHandKeys'];
  handPresentation?: import('../presentation/handAnimation/HandPresentationSnapshot').HandPresentationFrame;
  hiddenRiverKeys: TableAnimation3DRenderState['hiddenRiverKeys'];
  hiddenMeldTileKeys: TableAnimation3DRenderState['hiddenMeldTileKeys'];
  hiddenNorthKeys?: ReadonlySet<string>;
  winPresentation3D?: WinPresentation3DState | null;
  winHandPack?: import('../hand/handPacks').HandPack;
  tableVisualTheme: TableVisualTheme;
  tileVisualContext?: TileVisualSemanticContext;
  feltTexture?: Texture;
  centralHud?: ReactNode;
  onTileLayerReady?: () => void;
}>) {
  const winningRiverTarget = resolveWinningRiverTarget3D(winPresentation3D ?? null);
  return (
    <>
      <TableEnvironment />
      <FixedTableCamera />
      <TableLighting />
      <TableMesh theme={tableVisualTheme} feltTexture={feltTexture} />
      {centralHud ? <CentralConsoleHudAnchor3D riichiLanes tuning={sceneState.scoreHudTuning}>{centralHud}</CentralConsoleHudAnchor3D> : null}
      <Suspense fallback={null}>
        <TileTextureWarmup />
        {SEAT_ORDER.flatMap((seat) => { const seatState = sceneState.seats[seat]; return seatState ? [ (
          <group key={seat}>
            {seat === 'bottom' ? null : (
              <RegionGroup tuning={seatState.regionTuning?.hand}><Hand3D
                seatState={seatState}
                winHandPack={winHandPack}
                handPresentation={handPresentation?.snapshot.playerId === seatState.playerId ? handPresentation : undefined}
                hiddenTileKeys={hiddenHandKeys}
                winPresentation={winPresentation3D?.action.playerId === seatState.playerId || winPresentation3D?.revealedPlayerIds?.includes(seatState.playerId)
                  ? winPresentation3D
                  : null}
                visualContext={tileVisualContext}
              /></RegionGroup>
            )}
            <RegionGroup tuning={seatState.regionTuning?.river}><River3D
              seatState={seatState}
              hiddenTileKeys={hiddenRiverKeys}
              winningRiverIndex={winningRiverTarget?.playerId === seatState.playerId
                ? winningRiverTarget.riverIndex
                : undefined}
              visualContext={tileVisualContext}
            /></RegionGroup>
            <RegionGroup tuning={seatState.regionTuning?.melds}><Meld3D
              seatState={seatState}
              hiddenTileKeys={hiddenMeldTileKeys}
              visualContext={tileVisualContext}
            /></RegionGroup>
            <RegionGroup tuning={seatState.regionTuning?.nuki}><NorthTiles3D seatState={seatState} hiddenKeys={hiddenNorthKeys} /></RegionGroup>
            {seatState.flowers && <FlowerTiles3D seatState={seatState} />}
          </group>
        ) ] : []; })}
        <SceneLayerReady onReady={onTileLayerReady} />
      </Suspense>
    </>
  );
});

function SceneLayerReady({ onReady }: Readonly<{ onReady?: () => void }>) {
  useEffect(() => { onReady?.(); }, [onReady]);
  return null;
}

export function Table3DScene({
  sceneState,
  animationsEnabled = false,
  animationSessionKey = 'table-3d',
  animationTurn = 0,
  localDiscardSnapshots,
  onLocalHandAnimationChange,
  winPresentation3D,
  tableVisualTheme = DEFAULT_TABLE_VISUAL_THEME,
  tileVisualContext,
  riichiStickAppearance,
  appearanceSettings = DEFAULT_APPEARANCE_SETTINGS,
  centralHud,
  onReady,
  onUnavailable,
}: Table3DSceneProps) {
  const [rendererReady, setRendererReady] = useState(false);
  const [tileLayerReady, setTileLayerReady] = useState(false);
  const [riichiLayerReady, setRiichiLayerReady] = useState(false);
  const playerSlotAppearances = usePlayerSlotAppearances();
  const winningRiverTarget = resolveWinningRiverTarget3D(winPresentation3D ?? null);
  const winningRevealSeat = winPresentation3D
    ? SEAT_ORDER.find((seat) => sceneState.seats[seat]?.playerId === winPresentation3D.action.playerId)
    : undefined;
  const winningRevealFaceUpCount = winningRevealSeat
    ? sceneState.seats[winningRevealSeat]?.hand.filter((tile) => tile.faceState === 'face-up').length
    : undefined;
  const sourceStoreRef = useRef<DiscardSource3DStore | null>(null);
  if (!sourceStoreRef.current) sourceStoreRef.current = new DiscardSource3DStore();
  const animation = useTableAnimation3D({
    sceneState,
    sourceStore: sourceStoreRef.current,
    enabled: animationsEnabled,
    sessionKey: animationSessionKey,
    animationTurn,
    localDiscardSnapshots,
    onLocalHandAnimationChange,
  });
  const sceneElementRef = useRef<HTMLElement>(null);
  const doraSweepPulseCountRef = useRef(0);
  const doraSweepTrigger = resolveDoraSweep3DTrigger(
    animation.active,
    sceneState,
    tileVisualContext,
  );
  const handleDoraSweepActiveCountChange = useCallback((activeCount: number) => {
    if (sceneElementRef.current) {
      sceneElementRef.current.dataset.doraSweepActiveCount = String(activeCount);
    }
  }, []);
  const handleDoraSweepStart = useCallback((result: Readonly<{
    startTime: number;
    targetCount: number;
  }>) => {
    if (!sceneElementRef.current) return;
    doraSweepPulseCountRef.current += 1;
    sceneElementRef.current.dataset.doraSweepPulseCount = String(doraSweepPulseCountRef.current);
    sceneElementRef.current.dataset.doraSweepLastStartMs = result.startTime.toFixed(1);
    sceneElementRef.current.dataset.doraSweepLastTargetCount = String(result.targetCount);
  }, []);
  const handleDoraSweepComplete = useCallback((result: Readonly<{
    durationMs: number;
    frameCount: number;
  }>) => {
    if (!sceneElementRef.current) return;
    sceneElementRef.current.dataset.doraSweepLastDurationMs = result.durationMs.toFixed(1);
    sceneElementRef.current.dataset.doraSweepLastFrameCount = String(result.frameCount);
  }, []);
  const visibleRiichiSeats = resolveVisibleRiichiSeats(
    sceneState.seats,
    animation.hiddenRiichiSeats,
  );
  const tableSceneReady = tileLayerReady && riichiLayerReady;
  const criticalPlayerIds = Object.values(sceneState.seats).map(seat => seat.playerId);
  const criticalRiichiPlayerIds = visibleRiichiSeats.flatMap((seat) => sceneState.seats[seat] ? [sceneState.seats[seat]!.playerId] : []);
  const handleRendererReady = useCallback(() => setRendererReady(true), []);
  const handleTileLayerReady = useCallback(() => setTileLayerReady(true), []);
  const handleRiichiLayerReady = useCallback(() => setRiichiLayerReady(true), []);
  const activeHandPack = resolveHandPackForPlayer(
    animation.active?.plan.action.playerId,
    playerSlotAppearances,
    appearanceSettings,
  );
  return (
    <section
      ref={sceneElementRef}
      className="table-3d-scene"
      data-testid="table-3d-scene"
      aria-label="3D 麻将桌技术样板"
      data-table-animation-event={animation.active?.plan.action.eventId}
      data-table-animation-kind={animation.active?.plan.action.type}
      data-table-animation-seat={animation.active?.plan.seat}
      data-table-animation-phase={animation.active?.phase}
      data-hand-presentation-phase={animation.active?.handPresentation?.phase ?? 'idle'}
      data-hand-discard-slot={animation.active?.handPresentation?.snapshot.discardVisualSlot}
      data-hand-tsumogiri={animation.active?.handPresentation?.snapshot.isTsumogiri}
      data-win-presentation-event={winPresentation3D?.action.eventId}
      data-win-presentation-player={winPresentation3D?.action.playerId}
      data-win-presentation-phase={winPresentation3D?.phase}
      data-win-reveal-seat={winningRevealSeat}
      data-win-reveal-face-up-count={winningRevealFaceUpCount}
      data-win-river-player={winningRiverTarget?.playerId}
      data-win-river-index={winningRiverTarget?.riverIndex}
      data-riichi-stick-seats={visibleRiichiSeats.join(',')}
      data-riichi-stick-count={visibleRiichiSeats.length}
      data-tile-hover-identity={tileVisualContext?.hoveredTileType ?? ''}
      data-dora-glow-enabled={tileVisualContext?.doraGlowEnabled === true ? 'true' : 'false'}
      data-visible-dora-tile-count={SEAT_ORDER.reduce((count, seat) => count
        + (sceneState.seats[seat]?.river.filter((tile) => tile.visible && tile.tile?.doraKind).length ?? 0)
        + (sceneState.seats[seat]?.melds.reduce((meldCount, meld) => meldCount
          + meld.tiles.filter((tile) => tile.faceState === 'face-up' && tile.tile?.doraKind).length, 0) ?? 0), 0)}
      data-dora-sweep-active-count="0"
      data-dora-sweep-pulse-count="0"
      data-dora-sweep-last-start-ms="0"
      data-dora-sweep-last-target-count="0"
      data-dora-sweep-last-duration-ms="0"
      data-dora-sweep-last-frame-count="0"
      data-renderer-ready={rendererReady ? 'true' : 'false'}
      data-table-scene-ready={tableSceneReady ? 'true' : 'false'}
    >
      <SceneCanvasHost
        sessionKey={animationSessionKey}
        camera={{
          position: TABLE_CAMERA.position,
          fov: TABLE_CAMERA.fov,
          near: TABLE_CAMERA.near,
          far: TABLE_CAMERA.far,
        }}
        onReady={onReady}
        onRendererReady={handleRendererReady}
        onUnavailable={onUnavailable}
      >
        <DoraSweep3DProvider
          trigger={doraSweepTrigger}
          sessionKey={animationSessionKey}
          onActiveCountChange={handleDoraSweepActiveCountChange}
          onPulseStart={handleDoraSweepStart}
          onPulseComplete={handleDoraSweepComplete}
        >
          <AppearanceResources3D
            settings={appearanceSettings}
            criticalPlayerIds={criticalPlayerIds}
            criticalRiichiPlayerIds={criticalRiichiPlayerIds}
          >
            {({ feltTexture, riichiStickAppearance: resolvedRiichiStickAppearance, criticalAssetsReady }) => (
              <>
                <StableTableScene
                  sceneState={sceneState}
                  hiddenHandKeys={animation.hiddenHandKeys}
                  handPresentation={animation.active?.handPresentation}
                  hiddenRiverKeys={animation.hiddenRiverKeys}
                  hiddenMeldTileKeys={animation.hiddenMeldTileKeys}
                  hiddenNorthKeys={animation.hiddenNorthKeys}
                  winPresentation3D={winPresentation3D}
                  winHandPack={resolveHandPackForPlayer(winPresentation3D?.action.playerId ?? 0, playerSlotAppearances, appearanceSettings)}
                  tableVisualTheme={tableVisualTheme}
                  tileVisualContext={tileVisualContext}
                  feltTexture={feltTexture}
                  centralHud={centralHud}
                  onTileLayerReady={handleTileLayerReady}
                />
                <Suspense fallback={null}>
                  {animation.active ? (
                    <HandAction3D active={animation.active} handPack={activeHandPack} riichiStickAppearance={{ ...riichiStickAppearance, ...resolvedRiichiStickAppearance }} />
                  ) : null}
                </Suspense>
                <Suspense fallback={null}>
                  <RiichiSticks3D
                    sceneState={sceneState}
                    hiddenSeats={animation.hiddenRiichiSeats}
                    appearance={{ ...riichiStickAppearance, ...resolvedRiichiStickAppearance }}
                  />
                  <SceneLayerReady onReady={handleRiichiLayerReady} />
                </Suspense>
                <SceneContentReady sceneReady={tableSceneReady} criticalAssetsReady={criticalAssetsReady} />
              </>
            )}
          </AppearanceResources3D>
        </DoraSweep3DProvider>
      </SceneCanvasHost>
      <div className="table-3d-badge" aria-hidden="true">3D 技术样板</div>
      {isAvatarFrameTuningEnabled() ? <AvatarFrameTuningPanel /> : null}
    </section>
  );
}
