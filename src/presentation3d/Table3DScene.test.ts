import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function sourcePath(relativePath: string): string {
  return decodeURIComponent(new URL(relativePath, import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
}

describe('UI-5A scene boundaries', () => {
  it('uses a fixed, R3F-interactive, demand-rendered canvas', () => {
    const source = readFileSync(sourcePath('./Table3DScene.tsx'), 'utf8');

    expect(source).toContain('frameloop="demand"');
    expect(source).toContain('dpr={[1, 1.75]}');
    expect(source).not.toContain('OrbitControls');
    expect(source).not.toContain('Raycaster');
    expect(source).not.toContain('buildTableSceneState');
    expect(source).toContain('sceneState: TableSceneState');
    expect(source).toContain("args={['#071712', 42, 58]}");
    expect(source).toContain('rotation={[-Math.PI / 2, 0, 0]} receiveShadow');
  });

  it('keeps the Canvas fallback node pure and reports readiness only from onCreated', () => {
    const source = readFileSync(sourcePath('./Table3DScene.tsx'), 'utf8');
    const fallbackStart = source.indexOf('export function CanvasUnavailable()');
    const sceneStart = source.indexOf('export function Table3DScene(');
    const fallbackSource = source.slice(fallbackStart, sceneStart);

    expect(source).toContain('fallback={<CanvasUnavailable />}');
    expect(fallbackSource).not.toContain('onUnavailable');
    expect(fallbackSource).not.toContain('useEffect');
    expect(fallbackSource).not.toContain('tagTableRendererError');
    expect(source).toContain('onReady?.();');
    expect(source).toContain("tagTableRendererError(cause, 'webgl-init-failure')");
    expect(source).toContain("addEventListener('webglcontextlost', onContextLost)");
    expect(source).toContain('WebglContextLossRecovery onUnavailable={onUnavailable}');
  });

  it('keeps custom avatar identity in the PlayerProfile path through the 3D HUD', () => {
    const gameScreenSource = readFileSync(sourcePath('../components/game/GameScreen.tsx'), 'utf8');
    const rendererSource = readFileSync(sourcePath('./TableRenderer.tsx'), 'utf8');
    const hudSource = readFileSync(sourcePath('./Table3DHud.tsx'), 'utf8');

    expect(gameScreenSource).toContain('playerProfile={playerProfile}');
    expect(rendererSource).toContain('playerProfile={playerProfile}');
    expect(hudSource).toContain('<PlayerAvatar avatarId={avatarId} className="table-3d-player-avatar" />');
  });

  it('uses shared visual-anatomy geometry and materials instead of per-tile bodies', () => {
    const source = readFileSync(sourcePath('./tile/Tile3D.tsx'), 'utf8');

    expect(source).toContain('geometry={sharedTileBodyGeometry}');
    expect(source).toContain('material={bodyMaterial}');
    expect(source).not.toContain('sharedTileIvoryBodyGeometry');
    expect(source).not.toContain('sharedTileBackBodyGeometry');
    expect(source).toContain('material={faceBaseMaterial}');
    expect(source).toContain('material={faceGlyphMaterial}');
    expect(source).toContain('material={backSurfaceMaterial}');
  });

  it('renders the authoritative static table through bounded scene components', () => {
    const source = readFileSync(sourcePath('./Table3DScene.tsx'), 'utf8');
    const riverSource = readFileSync(sourcePath('./river/River3D.tsx'), 'utf8');

    expect(source).not.toContain('<Wall3D');
    expect(source).not.toContain('<Dora3D');
    expect(source).toContain('<Hand3D');
    expect(source).toContain('seatState={sceneState.seats[seat]}');
    expect(source).toContain('<River3D');
    expect(source).toContain('winningRiverIndex={winningRiverTarget?.playerId === sceneState.seats[seat].playerId');
    expect(riverSource).toContain('const winning = tile.riverIndex === winningRiverIndex;');
    expect(riverSource).not.toContain('const winning = tile.layoutIndex === winningRiverIndex;');
    expect(source).toContain('<AppearanceResources3D settings={appearanceSettings}>');
    expect(source).toContain('riichiStickAppearance={{ ...riichiStickAppearance, ...resolvedRiichiStickAppearance }}');
    expect(source).toContain('const StableTableScene = memo(function StableTableScene(');
    expect(source).toContain('<CentralConsoleHudAnchor3D>{centralHud}</CentralConsoleHudAnchor3D>');
    expect(source).toContain('hiddenTileKeys={hiddenMeldTileKeys}');
    expect(source).toContain('appearance={riichiStickAppearance}');
    expect(source).toContain('<TileTextureWarmup />');
    expect(source.indexOf('</StableTableScene>')).toBe(-1);
    expect(source.match(/<Suspense fallback=\{null\}>/g)).toHaveLength(3);
    expect(source.indexOf('<TableMesh theme={tableVisualTheme} feltTexture={feltTexture} />')).toBeLessThan(source.indexOf('<Suspense fallback={null}>'));
    expect(source).not.toContain('<TileGallery />');
  });

  it('keeps the realtime hand-animation consumer isolated to the active renderer', () => {
    const gameScreenSource = readFileSync(sourcePath('../components/game/GameScreen.tsx'), 'utf8');
    const sceneSource = readFileSync(sourcePath('./Table3DScene.tsx'), 'utf8');

    expect(gameScreenSource).toContain('onActiveRendererChange={setActiveTableRenderer}');
    expect(gameScreenSource).toContain('animationsEnabled={realtimeHandAnimationsEnabled}');
    expect(gameScreenSource).toContain('enabled={realtimeHandAnimationsEnabled && activeTableRenderer === \'2d\'}');
    expect(sceneSource.indexOf('const animation = useTableAnimation3D({'))
      .toBeGreaterThan(sceneSource.indexOf('export function Table3DScene('));
    expect(sceneSource.indexOf('const animation = useTableAnimation3D({'))
      .toBeLessThan(sceneSource.indexOf('<Canvas'));
  });

  it('keeps gameplay wall and world Dora rendering hidden while preserving debug Dora3D', () => {
    const sceneSource = readFileSync(sourcePath('./Table3DScene.tsx'), 'utf8');
    const doraSource = readFileSync(sourcePath('./dora/Dora3D.tsx'), 'utf8');

    expect(sceneSource).not.toContain("from './wall/Wall3D'");
    expect(sceneSource).not.toContain("from './dora/Dora3D'");
    expect(doraSource).toContain('slots.map');
    expect(doraSource).toContain('resolveDora3DSlot(slot)');
    expect(doraSource).not.toContain('sceneState.wall');
    expect(doraSource).not.toContain('sceneState.deadWall');
  });

  it('keeps the frozen table footprint without a physical central console housing', () => {
    const tableSource = readFileSync(sourcePath('./table/TableMesh.tsx'), 'utf8');
    expect(tableSource).toContain('width: 38');
    expect(tableSource).toContain('depth: 35');
    expect(tableSource).not.toContain("from './CentralConsole3D'");
    expect(tableSource).not.toContain('<CentralConsole3D');
  });

  it('preserves the existing planar DOM score HUD independently of the table mesh', () => {
    const anchorSource = readFileSync(sourcePath('./table/CentralConsoleHudAnchor3D.tsx'), 'utf8');
    const rendererSource = readFileSync(sourcePath('./TableRenderer.tsx'), 'utf8');

    expect(anchorSource).toContain('<Html');
    expect(anchorSource).toContain('transform');
    expect(anchorSource).toContain("pointerEvents: 'none'");
    expect(rendererSource).toContain('const centralHud = useMemo(() => (');
    expect(rendererSource).toContain('centralHud={centralHud}');
  });

  it('removes the bottom Hand3D target while preserving opponent hands and every Meld3D lane', () => {
    const sceneSource = readFileSync(sourcePath('./Table3DScene.tsx'), 'utf8');
    const handSource = readFileSync(sourcePath('./hand/Hand3D.tsx'), 'utf8');
    const tileSource = readFileSync(sourcePath('./tile/Tile3D.tsx'), 'utf8');

    expect(handSource).toContain('rotationX={transform.rotationX + winMotion.tiltX}');
    expect(handSource).toContain("region: 'hand'");
    expect(handSource).toContain('tileKey: tile.key');
    expect(handSource).toContain('index,');
    expect(handSource).toContain("showRearFace={tile.faceState === 'face-down' || winPresentation !== null}");
    expect(handSource).toContain('resolveHand3DInteractionBinding');
    expect(handSource).toContain('selectHand3DTile');
    expect(handSource).toContain('activateHand3DTile');
    expect(handSource).toContain('event.stopPropagation()');
    expect(sceneSource).toContain("{seat === 'bottom' ? null : (");
    expect(sceneSource).toContain('<Hand3D\n                seatState={sceneState.seats[seat]}');
    expect(sceneSource).not.toContain('localHandPresentation');
    expect(sceneSource).not.toContain('interactionActions={');
    expect(sceneSource.indexOf("{seat === 'bottom' ? null : (")).toBeLessThan(sceneSource.indexOf('<River3D'));
    expect(sceneSource.indexOf('<River3D')).toBeLessThan(sceneSource.indexOf('<Meld3D'));
    expect(tileSource).toContain('rotation={[0, rotationY, 0]}');
    expect(tileSource).toContain('rotation={[rotationX, transform.rotation[1], transform.rotation[2]]}');
    expect(tileSource).toContain('interaction?.selected');
    expect(tileSource).toContain('interaction?.riichiCandidate');
  });
});
