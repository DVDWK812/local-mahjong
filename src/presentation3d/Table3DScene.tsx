import { Canvas, useThree } from '@react-three/fiber';
import { memo, Suspense, useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
  type Texture,
  WebGLRenderer,
} from 'three';
import { FixedTableCamera, TABLE_CAMERA } from './camera/FixedTableCamera';
import type { Table3DSeat } from './coordinates/seatTransforms';
import { Hand3D } from './hand/Hand3D';
import { TableLighting } from './lighting/TableLighting';
import { Meld3D } from './meld/Meld3D';
import { River3D } from './river/River3D';
import type { TableSceneState } from './sceneState/tableSceneTypes';
import { TableMesh } from './table/TableMesh';
import { DEFAULT_TABLE_VISUAL_THEME, type TableVisualTheme } from './table/tableVisualTheme';
import { tagTableRendererError } from './rendererDiagnostics';
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

type Table3DSceneProps = Readonly<{
  sceneState: TableSceneState;
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
  hiddenRiichiSeats,
  winPresentation3D,
  tableVisualTheme,
  tileVisualContext,
  riichiStickAppearance,
  feltTexture,
  riichiVisibilityKey,
  centralHud,
}: Readonly<{
  sceneState: TableSceneState;
  hiddenHandKeys: TableAnimation3DRenderState['hiddenHandKeys'];
  handPresentation?: import('../presentation/handAnimation/HandPresentationSnapshot').HandPresentationFrame;
  hiddenRiverKeys: TableAnimation3DRenderState['hiddenRiverKeys'];
  hiddenMeldTileKeys: TableAnimation3DRenderState['hiddenMeldTileKeys'];
  hiddenRiichiSeats: TableAnimation3DRenderState['hiddenRiichiSeats'];
  winPresentation3D?: WinPresentation3DState | null;
  tableVisualTheme: TableVisualTheme;
  tileVisualContext?: TileVisualSemanticContext;
  riichiStickAppearance?: RiichiStick3DAppearance;
  feltTexture?: Texture;
  riichiVisibilityKey: string;
  centralHud?: ReactNode;
}>) {
  void riichiVisibilityKey;
  const winningRiverTarget = resolveWinningRiverTarget3D(winPresentation3D ?? null);
  return (
    <>
      <color attach="background" args={['#071712']} />
      <fog attach="fog" args={['#071712', 42, 58]} />
      <FixedTableCamera />
      <TableLighting />
      <TableMesh theme={tableVisualTheme} feltTexture={feltTexture} />
      {centralHud ? <CentralConsoleHudAnchor3D>{centralHud}</CentralConsoleHudAnchor3D> : null}
      <Suspense fallback={null}>
        <TileTextureWarmup />
        {SEAT_ORDER.map((seat) => (
          <group key={seat}>
            {seat === 'bottom' ? null : (
              <Hand3D
                seatState={sceneState.seats[seat]}
                handPresentation={handPresentation?.snapshot.playerId === sceneState.seats[seat].playerId ? handPresentation : undefined}
                hiddenTileKeys={hiddenHandKeys}
                winPresentation={winPresentation3D?.action.playerId === sceneState.seats[seat].playerId
                  ? winPresentation3D
                  : null}
                visualContext={tileVisualContext}
              />
            )}
            <River3D
              seatState={sceneState.seats[seat]}
              hiddenTileKeys={hiddenRiverKeys}
              winningRiverIndex={winningRiverTarget?.playerId === sceneState.seats[seat].playerId
                ? winningRiverTarget.riverIndex
                : undefined}
              visualContext={tileVisualContext}
            />
            <Meld3D
              seatState={sceneState.seats[seat]}
              hiddenTileKeys={hiddenMeldTileKeys}
              visualContext={tileVisualContext}
            />
          </group>
        ))}
      </Suspense>
      <Suspense fallback={null}>
        <RiichiSticks3D
          sceneState={sceneState}
          hiddenSeats={hiddenRiichiSeats}
          appearance={riichiStickAppearance}
        />
      </Suspense>
      <mesh position={[0, -0.88, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[42, 34]} />
        <meshStandardMaterial color="#06100d" roughness={1} />
      </mesh>
    </>
  );
});

/** Safely hand control back to the legacy renderer instead of leaving a lost WebGL canvas black. */
function WebglContextLossRecovery({ onUnavailable }: Readonly<{ onUnavailable?: (error: Error) => void }>) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const onContextLost = (event: Event) => {
      event.preventDefault();
      onUnavailable?.(tagTableRendererError(new Error('WebGL context lost while rendering appearance assets.'), 'webgl-init-failure'));
    };
    gl.domElement.addEventListener('webglcontextlost', onContextLost);
    return () => gl.domElement.removeEventListener('webglcontextlost', onContextLost);
  }, [gl, onUnavailable]);
  return null;
}

export function CanvasUnavailable() {
  return <div className="table-3d-unavailable">当前设备无法启动 3D 牌桌，正在恢复经典牌桌。</div>;
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
  const winningRiverTarget = resolveWinningRiverTarget3D(winPresentation3D ?? null);
  const winningRevealSeat = winPresentation3D
    ? SEAT_ORDER.find((seat) => sceneState.seats[seat].playerId === winPresentation3D.action.playerId)
    : undefined;
  const winningRevealFaceUpCount = winningRevealSeat
    ? sceneState.seats[winningRevealSeat].hand.filter((tile) => tile.faceState === 'face-up').length
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
        + sceneState.seats[seat].river.filter((tile) => tile.visible && tile.tile?.doraKind).length
        + sceneState.seats[seat].melds.reduce((meldCount, meld) => meldCount
          + meld.tiles.filter((tile) => tile.faceState === 'face-up' && tile.tile?.doraKind).length, 0), 0)}
      data-dora-sweep-active-count="0"
      data-dora-sweep-pulse-count="0"
      data-dora-sweep-last-start-ms="0"
      data-dora-sweep-last-target-count="0"
      data-dora-sweep-last-duration-ms="0"
      data-dora-sweep-last-frame-count="0"
    >
      <Canvas
        shadows="basic"
        frameloop="demand"
        dpr={[1, 1.75]}
        camera={{
          position: TABLE_CAMERA.position,
          fov: TABLE_CAMERA.fov,
          near: TABLE_CAMERA.near,
          far: TABLE_CAMERA.far,
        }}
        gl={(defaultProps) => {
          try {
            return new WebGLRenderer({
              ...defaultProps,
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
            });
          } catch (cause) {
            const error = tagTableRendererError(cause, 'webgl-init-failure');
            if (import.meta.env.DEV) {
              console.error('[TableRenderer] WebGL renderer initialization failed.', error);
            }
            onUnavailable?.(error);
            throw error;
          }
        }}
        fallback={<CanvasUnavailable />}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = PCFShadowMap;
          onReady?.();
        }}
      >
        <WebglContextLossRecovery onUnavailable={onUnavailable} />
        <DoraSweep3DProvider
          trigger={doraSweepTrigger}
          sessionKey={animationSessionKey}
          onActiveCountChange={handleDoraSweepActiveCountChange}
          onPulseStart={handleDoraSweepStart}
          onPulseComplete={handleDoraSweepComplete}
        >
          <AppearanceResources3D settings={appearanceSettings}>
            {({ feltTexture, riichiStickAppearance: resolvedRiichiStickAppearance }) => (
              <>
                <StableTableScene
                  sceneState={sceneState}
                  hiddenHandKeys={animation.hiddenHandKeys}
                  handPresentation={animation.active?.handPresentation}
                  hiddenRiverKeys={animation.hiddenRiverKeys}
                  hiddenMeldTileKeys={animation.hiddenMeldTileKeys}
                  hiddenRiichiSeats={animation.hiddenRiichiSeats}
                  winPresentation3D={winPresentation3D}
                  tableVisualTheme={tableVisualTheme}
                  tileVisualContext={tileVisualContext}
                  riichiStickAppearance={{ ...riichiStickAppearance, ...resolvedRiichiStickAppearance }}
                  feltTexture={feltTexture}
                  riichiVisibilityKey={visibleRiichiSeats.join(',')}
                  centralHud={centralHud}
                />
                <Suspense fallback={null}>
                  {animation.active ? (
                    <HandAction3D active={animation.active} riichiStickAppearance={{ ...riichiStickAppearance, ...resolvedRiichiStickAppearance }} />
                  ) : null}
                </Suspense>
              </>
            )}
          </AppearanceResources3D>
        </DoraSweep3DProvider>
      </Canvas>
      <div className="table-3d-badge" aria-hidden="true">3D 技术样板</div>
      {isAvatarFrameTuningEnabled() ? <AvatarFrameTuningPanel /> : null}
    </section>
  );
}
