import { lazy, memo, Suspense, type ComponentProps, type ReactNode } from 'react';
import { TileFaceDomAppearance } from '../presentation/appearance/TileFaceDomAppearance';
import { tagTableRendererError } from './rendererDiagnostics';
import type { Table3DScene } from './Table3DScene';
const LazyTable3DScene = lazy(async () => {
  try {
    const module = await import('./Table3DScene');
    return { default: memo(module.Table3DScene) };
  } catch (error) {
    throw tagTableRendererError(error, 'lazy-load-error');
  }
});

/** The production scene/HUD layer used by both riichi controllers. */
export function FormalTable3D({ hud, ...scene }: ComponentProps<typeof Table3DScene> & { hud: ReactNode }) {
  return <Suspense fallback={null}>
    <div className="table-renderer-layer table-renderer-layer--3d" data-table-renderer="3d">
      <LazyTable3DScene {...scene} />
      <TileFaceDomAppearance settings={scene.appearanceSettings}>{hud}</TileFaceDomAppearance>
    </div>
  </Suspense>;
}
