import { describe, expect, it } from 'vitest';
import { isInitialPresentationReady, isInitialSceneReady } from './initialSceneReady';

describe('initial 3D presentation readiness', () => {
  it('does not treat Canvas creation alone as a complete scene', () => {
    expect(isInitialSceneReady({
      rendererReady: true,
      tableSceneReady: false,
      criticalAssetsReady: false,
      localPresentationReady: false,
    })).toBe(false);
  });

  it('reveals only after renderer, scene, critical assets, and local presentation are ready', () => {
    const complete = {
      rendererReady: true,
      tableSceneReady: true,
      criticalAssetsReady: true,
      localPresentationReady: true,
    } as const;
    for (const key of Object.keys(complete) as (keyof typeof complete)[]) {
      expect(isInitialSceneReady({ ...complete, [key]: false })).toBe(false);
    }
    expect(isInitialSceneReady(complete)).toBe(true);
    expect(isInitialPresentationReady(true, false)).toBe(false);
    expect(isInitialPresentationReady(true, true)).toBe(true);
  });
});
