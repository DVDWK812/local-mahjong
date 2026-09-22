import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AdditiveBlending } from 'three';
import { TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';
import { createDoraSweep3DMaterial } from '../dora/DoraHighlight3D';

function sourcePath(relativePath: string): string {
  return decodeURIComponent(new URL(relativePath, import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
}

describe('UI-5F.3 Tile3D local-space Dora sweep visual', () => {
  it('keeps legacy configuration compatible and centralizes 3D sweep tuning', () => {
    expect(TABLE_PRESENTATION_TUNING.doraVisual).toEqual({ borderEnabled: 0, breathingEnabled: 1 });
    expect(TABLE_PRESENTATION_TUNING.doraSweep3D).toEqual({
      enabled: 1,
      repeatEnabled: 1,
      repeatIntervalMs: 5000,
      normalDurationMs: 950,
      combinedDurationMs: 1100,
      shellScale: 1.008,
      bandWidth: 0.2,
      softness: 0.16,
      intensity: 0.72,
      dimmedStrength: 0.28,
      color: '#fff5c4',
      direction: [0.72, 0.28, -0.63],
      start: -1.28,
      end: 1.28,
    });
  });

  it('uses a transparent additive local-space shader shell with safe depth semantics', () => {
    const material = createDoraSweep3DMaterial();
    expect(material.transparent).toBe(true);
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.fog).toBe(false);
    expect(material.blending).toBe(AdditiveBlending);
    expect(material.vertexShader).toContain('vTileLocalPosition = position');
    expect(material.fragmentShader).toContain('dot(vTileLocalPosition, uDirection)');
    expect(material.uniforms.uBandWidth.value).toBe(TABLE_PRESENTATION_TUNING.doraSweep3D.bandWidth);
    expect(material.uniforms.uSoftness.value).toBe(TABLE_PRESENTATION_TUNING.doraSweep3D.softness);
    expect(material.uniforms.uIntensity.value).toBe(TABLE_PRESENTATION_TUNING.doraSweep3D.intensity);
    material.dispose();
  });

  it('replaces the Drei Html portal with a Tile3D child shell', () => {
    const tileSource = readFileSync(sourcePath('./Tile3D.tsx'), 'utf8');
    const highlightSource = readFileSync(sourcePath('../dora/DoraHighlight3D.tsx'), 'utf8');
    const cssSource = readFileSync(sourcePath('../table3d.css'), 'utf8');

    expect(tileSource).toContain('<DoraHighlight3D');
    expect(tileSource).not.toContain('<Html');
    expect(tileSource).not.toContain('DoraBreathingOverlay3D');
    expect(highlightSource).toContain('geometry={sharedTileBodyGeometry}');
    expect(highlightSource).toContain('scale={TABLE_PRESENTATION_TUNING.doraSweep3D.shellScale}');
    expect(highlightSource).not.toContain('useFrame');
    expect(cssSource).not.toContain('.tile-3d-dora-breathing-portal');
    expect(cssSource).not.toContain('.dora-breath-anchor');
  });

  it('keeps the Local Hand DOM diagonal sweep contract unchanged', () => {
    const handSource = readFileSync(sourcePath('../../components/game/LocalHandArea.tsx'), 'utf8');
    const tileSource = readFileSync(sourcePath('../../components/Tile.tsx'), 'utf8');
    const cssSource = readFileSync(sourcePath('../table3d.css'), 'utf8');

    expect(handSource).toContain('doraSweepEnabled={screenSpaceOverlay && doraBreathingEnabled}');
    expect(handSource).not.toContain('DoraHighlight3D');
    expect(tileSource).toContain("'local-hand-dora-sweep'");
    expect(tileSource).toContain("'dora-breath-visual'");
    expect(cssSource).toContain('.dora-breath-visual::before');
    expect(cssSource).toContain('animation: tile-3d-dora-wave');
    expect(cssSource).toContain('.local-hand-area--screen-space .local-hand-dora-sweep');
  });

  it('uses one conditional frame driver rather than per-Tile3D polling', () => {
    const tileSource = readFileSync(sourcePath('./Tile3D.tsx'), 'utf8');
    const providerSource = readFileSync(sourcePath('../dora/DoraSweep3DProvider.tsx'), 'utf8');
    const rendererSource = readFileSync(sourcePath('../TableRenderer.tsx'), 'utf8');

    expect(tileSource).not.toContain('useFrame');
    expect(providerSource).toContain('{driverActive ? <DoraSweep3DFrameDriver');
    expect(providerSource.match(/useFrame\(/g)).toHaveLength(1);
    expect(providerSource).not.toContain('setInterval');
    expect(providerSource).toContain('setDriverActive(false)');
    expect(providerSource).toContain('cancelPending()');
    expect(providerSource).toContain('schedulerRef.current?.cancel()');
    expect(rendererSource).toContain('const tileVisualContext = useMemo<TileVisualSemanticContext>');
    expect(rendererSource).toContain('tileVisualContext={tileVisualContext}');
  });
});
