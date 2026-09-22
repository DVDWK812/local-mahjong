import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SceneCanvasHost, SceneContentReady, CanvasUnavailable } from './SceneCanvasHost';
import { SceneErrorBoundary, SceneLoading } from './SceneErrorBoundary';
import { requestInitialFrameCommit, SceneSessionLifetime } from './initialFrameCommit';
import { isInitialPresentationReady, isInitialSceneReady } from '../initialSceneReady';
import { classifyTableRendererError, tagTableRendererError } from '../rendererDiagnostics';

describe('shared scene session', () => {
  it('accepts a minimal scene without a GameState, players, seats or hand', () => {
    const markup = renderToStaticMarkup(<SceneCanvasHost sessionKey="minimal" camera={{ position: [0, 2, 5] }}>
      <mesh><boxGeometry /><meshBasicMaterial color="red" /></mesh>
      <SceneContentReady sceneReady criticalAssetsReady />
    </SceneCanvasHost>);
    expect(markup).toContain('<canvas');
    expect(markup).not.toContain('mahjong-table');
    const host = readFileSync(resolve('src/presentation3d/session/SceneCanvasHost.tsx'), 'utf8');
    for (const forbidden of ['GameState', 'TableSceneState', 'SEAT_ORDER', 'TABLE_CAMERA', 'buildTableSceneState', 'drawnTile', 'preloadHandPacks']) {
      expect(host).not.toContain(forbidden);
    }
  });

  it('has one gameplay Canvas implementation and keeps the four-player scene as a consumer', () => {
    function sources(dir: string): string[] {
      return readdirSync(dir).flatMap(name => !name.includes('.')
        ? sources(resolve(dir, name))
        : name.endsWith('.tsx') && !name.includes('.test.') ? [resolve(dir, name)] : []);
    }
    const canvasOwners = sources(resolve('src/presentation3d')).filter(path => /<Canvas[\s>]/.test(readFileSync(path, 'utf8')));
    expect(canvasOwners).toEqual([resolve('src/presentation3d/session/SceneCanvasHost.tsx')]);
    const scene = readFileSync(resolve('src/presentation3d/Table3DScene.tsx'), 'utf8');
    expect(scene).toContain('<SceneCanvasHost');
    expect(scene).toContain('position: TABLE_CAMERA.position');
    expect(scene).toContain('const SEAT_ORDER');
  });

  it('does not equate resource readiness or another root frame with this Canvas commit', () => {
    let afterFrame = () => {};
    let rendered = false;
    let committed = false;
    const invalidate = vi.fn();
    const remove = vi.fn();
    const readiness = { rendererReady: true, tableSceneReady: true, criticalAssetsReady: true, localPresentationReady: true };
    for (const field of Object.keys(readiness) as (keyof typeof readiness)[]) {
      expect(isInitialSceneReady({ ...readiness, [field]: false })).toBe(false);
    }
    const cancel = requestInitialFrameCommit({
      afterFrame: cb => { afterFrame = cb; return remove; }, invalidate,
      hasRendered: () => rendered,
      onReady: () => { committed = true; },
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    afterFrame();
    expect(committed).toBe(false);
    rendered = true;
    afterFrame();
    expect(committed).toBe(true);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(isInitialPresentationReady(committed, false)).toBe(false);
    expect(isInitialPresentationReady(committed, true)).toBe(true);
    afterFrame();
    expect(remove).toHaveBeenCalledTimes(1);
    cancel();
  });

  it('cancels an in-flight frame and cannot call ready from an already queued callback', () => {
    let afterFrame = () => {};
    const ready = vi.fn();
    const cancel = requestInitialFrameCommit({ afterFrame: cb => { afterFrame = cb; return vi.fn(); }, invalidate: vi.fn(), hasRendered: () => true, onReady: ready });
    cancel();
    afterFrame();
    expect(ready).not.toHaveBeenCalled();
  });

  it('rejects stale promises after unmount, session replacement and StrictMode reactivation', async () => {
    const session = new SceneSessionLifetime();
    const ready = vi.fn();
    const dispose = session.activate();
    const stale = session.guard(ready);
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; }).then(stale);
    dispose();
    const disposeNew = session.activate();
    finish();
    await pending;
    expect(ready).not.toHaveBeenCalled();
    session.guard(ready)();
    expect(ready).toHaveBeenCalledTimes(1);
    disposeNew();
    session.guard(ready)();
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('cancels readiness on failure and preserves the existing fallback error contract', () => {
    const session = new SceneSessionLifetime();
    session.activate();
    const ready = vi.fn();
    const pendingReady = session.guard(ready);
    session.cancel();
    pendingReady();
    expect(ready).not.toHaveBeenCalled();
    expect(classifyTableRendererError(tagTableRendererError(new Error('lost'), 'webgl-init-failure'))).toBe('webgl-init-failure');
    expect(classifyTableRendererError(new Error('scene failed'))).toBe('scene-render-error');
    const onError = vi.fn();
    const boundary = new SceneErrorBoundary({ children: 'scene', fallback: 'fallback', onError });
    boundary.state = SceneErrorBoundary.getDerivedStateFromError();
    boundary.componentDidCatch(new Error('failed'), { componentStack: 'test' });
    expect(boundary.render()).toBe('fallback');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(renderToStaticMarkup(<CanvasUnavailable />)).toContain('无法启动 3D');
    expect(renderToStaticMarkup(<SceneLoading />)).toContain('正在准备牌桌');
  });

  it('keys Canvas lifetime only by session, never by loading, assets or viewport', () => {
    const first = SceneCanvasHost({ sessionKey: 'same', camera: {}, children: null });
    const next = SceneCanvasHost({ sessionKey: 'same', camera: { aspect: 2 }, children: <SceneContentReady sceneReady criticalAssetsReady /> });
    expect(next.type).toBe(first.type);
    expect(next.key).toBe(first.key);
    expect(SceneCanvasHost({ sessionKey: 'new', camera: {}, children: null }).key).not.toBe(first.key);
  });
});
