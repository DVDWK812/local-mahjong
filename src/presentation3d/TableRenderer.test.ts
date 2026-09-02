import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import { MahjongTable } from '../components/game/MahjongTable';
import { supports3DGameState, TableRenderer } from './TableRenderer';
import {
  classifyTableRendererError,
  inspectStandardFourPlayerState,
  resolveTableRendererDiagnostics,
  tagTableRendererError,
} from './rendererDiagnostics';
import { resolveTableRenderer, shouldRender3DTable } from './rendererMode';

function sourcePath(relativePath: string): string {
  return decodeURIComponent(new URL(relativePath, import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
}

describe('3D table renderer selection', () => {
  it('keeps the stable 2.5D table as the default', () => {
    expect(resolveTableRenderer()).toBe('2d');
    expect(resolveTableRenderer('?table3d=0')).toBe('2d');
    expect(resolveTableRenderer('?presentationEvents=1')).toBe('2d');
  });

  it('enables the isolated prototype only with the explicit developer query', () => {
    expect(resolveTableRenderer('?table3d=1')).toBe('3d');
    expect(resolveTableRenderer('?foo=bar&table3d=1')).toBe('3d');
    expect(shouldRender3DTable('3d', false)).toBe(true);
    expect(shouldRender3DTable('2d', false)).toBe(false);
    expect(shouldRender3DTable('3d', true)).toBe(false);
  });

  it('retains an error fallback and unmount-safe popstate cleanup', () => {
    const source = readFileSync(sourcePath('./TableRenderer.tsx'), 'utf8');

    expect(source).toContain('fallback={<LegacyTable2D');
    expect(source).toContain("window.removeEventListener('popstate', syncMode)");
    expect(source).toContain('shouldRender3DTable(mode, runtimeFailure !== null)');
  });

  it('loads the WebGL implementation only after 3D is selected', () => {
    const source = readFileSync(sourcePath('./TableRenderer.tsx'), 'utf8');

    expect(source).toContain("await import('./Table3DScene')");
    expect(source).toContain('default: memo(module.Table3DScene)');
    expect(source).not.toContain("from './Table3DScene'");
  });

  it('keeps incomplete and 17-step-shaped tables on the legacy renderer', () => {
    const fourPlayer = createInitialGameState();
    expect(supports3DGameState(fourPlayer)).toBe(true);
    expect(supports3DGameState({ ...fourPlayer, players: fourPlayer.players.slice(0, 2) })).toBe(false);
  });

  it('reports the precise standard-four-player guard inputs', () => {
    const fourPlayer = createInitialGameState();
    expect(inspectStandardFourPlayerState(fourPlayer)).toEqual({
      supported: true,
      playerCount: 4,
      playerIds: [0, 1, 2, 3],
      missingPlayerIds: [],
      duplicatePlayerIds: [],
    });
    expect(inspectStandardFourPlayerState({
      ...fourPlayer,
      players: [fourPlayer.players[0], fourPlayer.players[1]],
    })).toMatchObject({
      supported: false,
      playerCount: 2,
      playerIds: [0, 1],
      missingPlayerIds: [2, 3],
    });
  });

  it('keeps the default and unsupported fallback as an unwrapped legacy table', () => {
    const gameState = createInitialGameState();
    const legacy = renderToStaticMarkup(createElement('main', { className: 'game-screen' },
      createElement(TableRenderer, { gameState, renderer: '2d' })));
    expect(legacy).toContain('<main class="game-screen"><section class="mahjong-table"');
    expect(legacy).not.toContain('table-renderer-diagnostics');

    const directLegacy = renderToStaticMarkup(createElement(MahjongTable, { gameState }));
    expect(renderToStaticMarkup(createElement(TableRenderer, { gameState, renderer: '2d' })))
      .toBe(directLegacy);

    const nonStandard = renderToStaticMarkup(createElement(TableRenderer, {
      gameState: {
        ...gameState,
        players: gameState.players.map((player, index) =>
          index === 3 ? { ...player, id: 2 as const } : player),
      },
      renderer: '3d',
    }));
    expect(nonStandard).toContain('class="mahjong-table"');
    expect(nonStandard).not.toContain('table-renderer-diagnostics');
  });

  it('does not claim 3D active before the WebGL scene reports ready', () => {
    expect(resolveTableRendererDiagnostics('3d', true, true, false, null)).toEqual({
      requested: '3d',
      active: '2d',
      standardFourPlayer: true,
      attempted3dMount: true,
      fallbackReason: 'none',
    });
    expect(resolveTableRendererDiagnostics('3d', true, false, false, 'webgl-init-failure'))
      .toMatchObject({ active: '2d', fallbackReason: 'webgl-init-failure' });
    expect(resolveTableRendererDiagnostics('3d', true, true, true, null))
      .toMatchObject({ active: '3d', fallbackReason: 'none' });
  });

  it('separates real renderer initialization failures from scene render errors', () => {
    const webglError = tagTableRendererError(new Error('context creation failed'), 'webgl-init-failure');
    expect(classifyTableRendererError(webglError)).toBe('webgl-init-failure');
    expect(classifyTableRendererError(new Error('scene render failed'))).toBe('scene-render-error');
  });

  it('coexists with the DOM HUD and switches the shared local hand to a transparent screen-space overlay only after 3D is active', () => {
    const source = readFileSync(sourcePath('./TableRenderer.tsx'), 'utf8');
    const gameScreenSource = readFileSync(sourcePath('../components/game/GameScreen.tsx'), 'utf8');
    const css = readFileSync(sourcePath('./table3d.css'), 'utf8');
    expect(source).toContain('table-renderer-layer--3d');
    expect(source).toContain('<Table3DHud {...tableProps} doraIndicatorSlots={doraIndicatorSlots} />');
    expect(source).toContain('centralHud={centralHud}');
    expect(source).toContain('return <LegacyTable2D {...tableProps} doraIndicatorSlots={doraIndicatorSlots} />');
    expect(source).not.toContain('hudOnly');
    expect(source).toContain('standardFourPlayer.supported');
    expect(source).toContain('sharedPresentationState.scene');
    expect(source).toContain('sharedPresentationState?.doraIndicatorSlots');
    expect(source).not.toContain('doraIndicatorSlots={doraIndicatorSlots}\n              localHandPresentation');
    expect(source).toContain("data-table-interaction-contract={interactionActions ? 'shared' : 'none'}");
    expect(gameScreenSource).toContain("screenSpaceOverlay={activeTableRenderer === '3d'}");
    expect(css).toContain('.local-hand-area--screen-space');
    expect(css).toContain('position: fixed');
    expect(css).toContain('background: transparent');
    expect(css).toContain('transform: translateX(-50%)');
  });

  it('lets Replay share the same visibility-aware renderer while 17-step stays isolated', () => {
    const replaySource = readFileSync(sourcePath('../components/ReplayScreen.tsx'), 'utf8');
    const seventeenStepsSource = readFileSync(sourcePath('../components/SeventeenStepsScreen.tsx'), 'utf8');
    expect(replaySource).toContain('<TableRenderer');
    expect(seventeenStepsSource).not.toContain('<TableRenderer');
  });
});
