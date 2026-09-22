import { describe, expect, it } from 'vitest';
import { Texture } from 'three';
import {
  configureLocalAppearanceTexture,
  getFeltCropAspectRatio,
  getTileBackCropAspectRatio,
  getRiichiStickCropAspectRatio,
} from './AppearanceResources3D';
import { DEFAULT_FELT_MAIN_VIEW_MAPPING } from '../table/feltMainViewMapping';
import { RIICHI_STICK_FACE_SIZE } from '../riichi/riichiStickGeometry';

describe('local 3D appearance resources', () => {
  it('uses the new stick crop ratio and covers both old/new images without anisotropic stretching', () => {
    expect(getRiichiStickCropAspectRatio()).toBe(3.16 / 0.24);
    for (const height of [78, 39]) {
      const image = { width: 512, height };
      const texture = configureLocalAppearanceTexture(new Texture(image), 'riichi-stick');
      expect(texture.image).toBe(image);
      expect((512 * texture.repeat.x) / (height * texture.repeat.y)).toBeCloseTo(RIICHI_STICK_FACE_SIZE.length / RIICHI_STICK_FACE_SIZE.width);
      expect(texture.offset.y).toBeCloseTo((1 - texture.repeat.y) / 2);
    }
  });
  it('updates each decoded felt texture and clears stale transforms on reuse', () => {
    const texture = new Texture({ width: 512, height: 406 });
    texture.offset.set(9, -20);
    texture.repeat.set(40, 30);
    texture.center.set(0.5, 0.5);
    texture.rotation = Math.PI;
    const version = texture.version;
    expect(configureLocalAppearanceTexture(texture, 'felt')).toBe(texture);
    expect(texture.image.width).toBe(512);
    expect(texture.image.height).toBe(406);
    expect(texture.version).toBeGreaterThan(version);
    expect(texture.repeat.toArray()).toEqual(DEFAULT_FELT_MAIN_VIEW_MAPPING.textureRepeat);
    expect(texture.offset.toArray()).toEqual(DEFAULT_FELT_MAIN_VIEW_MAPPING.textureOffset);
    expect(texture.center.toArray()).toEqual([0, 0]);
    expect(texture.rotation).toBe(0);
  });
  it('uses the physical Tile3D back ratio for the crop frame', () => {
    expect(getTileBackCropAspectRatio()).toBeCloseTo(1.08 / 1.46);
    expect(getTileBackCropAspectRatio()).not.toBe(1);
  });

  it('uses the main-view authority rather than the full physical felt ratio', () => {
    expect(getFeltCropAspectRatio()).toBeCloseTo(DEFAULT_FELT_MAIN_VIEW_MAPPING.cropAspectRatio);
    expect(getFeltCropAspectRatio()).not.toBeCloseTo(37.25 / 34.25);
  });

  it('corrects only custom tile-back UV orientation', () => {
    const back = configureLocalAppearanceTexture(new Texture(), 'tile-back');
    const felt = configureLocalAppearanceTexture(new Texture(), 'felt');
    const stick = configureLocalAppearanceTexture(new Texture(), 'riichi-stick');

    expect(back.flipY).toBe(false);
    expect(felt.flipY).toBe(true);
    expect(stick.flipY).toBe(true);
    expect(felt.repeat.toArray()).toEqual(DEFAULT_FELT_MAIN_VIEW_MAPPING.textureRepeat);
    expect(felt.offset.toArray()).toEqual(DEFAULT_FELT_MAIN_VIEW_MAPPING.textureOffset);
    expect(stick.repeat.toArray()).toEqual([1, 1]);
    expect(stick.offset.toArray()).toEqual([0, 0]);
  });
});
