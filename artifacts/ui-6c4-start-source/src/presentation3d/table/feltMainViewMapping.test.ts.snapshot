import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import {
  applyFeltMainViewMapping,
  DEFAULT_FELT_MAIN_VIEW_MAPPING,
  getFeltMainViewMapping,
} from './feltMainViewMapping';

describe('main-view felt mapping', () => {
  it.each([
    ['1280×720', 1280, 720],
    ['1920×1080', 1920, 1080],
  ])('derives the visible fixed-camera UV region at %s', (_label, width, height) => {
    const mapping = getFeltMainViewMapping(width, height);

    expect(mapping.visibleUvRect.u).toBe(0);
    expect(mapping.visibleUvRect.width).toBe(1);
    expect(mapping.visibleUvRect.v).toBeGreaterThan(0);
    expect(mapping.visibleUvRect.height).toBeLessThan(1);
    expect(mapping.cropAspectRatio).toBeGreaterThan(37.25 / 34.25);
  });

  it('uses the crop authority verbatim for renderer repeat and offset', () => {
    const texture = applyFeltMainViewMapping(new Texture());
    expect(texture.repeat.toArray()).toEqual(DEFAULT_FELT_MAIN_VIEW_MAPPING.textureRepeat);
    expect(texture.offset.toArray()).toEqual(DEFAULT_FELT_MAIN_VIEW_MAPPING.textureOffset);
    expect(texture.center.toArray()).toEqual([0, 0]);
    expect(texture.rotation).toBe(0);
  });
});
