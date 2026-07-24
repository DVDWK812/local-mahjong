import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTile } from './tileUtils';
import { getTileAlt, getTileAssetKey, getTileBackImage, getTileImage, getTilePlaceholderImage, isRedFive } from './tileAssets';

describe('裁切版麻将牌贴图资源', () => {
  it('包含 34 张基础牌、牌背和占位图，且不再需要赤五独立素材', () => {
    const files = readdirSync(resolve(process.cwd(), 'src/assets/tiles')).filter((file) => file.endsWith('.png')).sort();
    expect(files).toHaveLength(36);
    expect(files).toEqual(expect.arrayContaining([
      'm1.png', 'm9.png', 'p1.png', 'p9.png', 's1.png', 's9.png',
      'z1.png', 'z5.png', 'z6.png', 'z7.png',
      'back.png', 'placeholder.png',
    ]));
    expect(files).not.toContain('m5r.png');
    expect(files).not.toContain('p5r.png');
    expect(files).not.toContain('s5r.png');
  });

  it('万、筒、索和字牌映射正确', () => {
    expect(getTileAssetKey(createTile(0, 1))).toBe('m1');
    expect(getTileAssetKey(createTile(8, 1))).toBe('m9');
    expect(getTileAssetKey(createTile(9, 1))).toBe('p1');
    expect(getTileAssetKey(createTile(17, 1))).toBe('p9');
    expect(getTileAssetKey(createTile(18, 1))).toBe('s1');
    expect(getTileAssetKey(createTile(26, 1))).toBe('s9');
    expect(getTileAssetKey(createTile(27, 1))).toBe('z1');
    expect(getTileAssetKey(createTile(31, 1))).toBe('z5');
    expect(getTileAssetKey(createTile(32, 1))).toBe('z6');
    expect(getTileAssetKey(createTile(33, 1))).toBe('z7');
  });

  it('赤五仍映射到普通五牌图片，并通过 isRedFive 标记', () => {
    const redMan = { ...createTile(4, 1), red: true };
    const redPin = { ...createTile(13, 1), red: true };
    const redSou = { ...createTile(22, 1), red: true };
    expect(getTileAssetKey(redMan)).toBe('m5');
    expect(getTileAssetKey(redPin)).toBe('p5');
    expect(getTileAssetKey(redSou)).toBe('s5');
    expect(getTileImage(redMan)).toContain('m5');
    expect(getTileImage(redMan)).not.toContain('m5r');
    expect(isRedFive(redMan)).toBe(true);
    expect(isRedFive(createTile(4, 1))).toBe(false);
  });

  it('牌图、牌背、占位图和中文 alt 可用', () => {
    const east = createTile(27, 0);
    const white = createTile(31, 0);
    const green = createTile(32, 0);
    const red = createTile(33, 0);
    expect(getTileImage(east)).toContain('z1');
    expect(getTileAlt(east)).toBe('东');
    expect(getTileAlt(white)).toBe('白');
    expect(getTileAlt(green)).toBe('发');
    expect(getTileAlt(red)).toBe('中');
    expect(getTileBackImage()).toContain('back');
    expect(getTilePlaceholderImage()).toContain('placeholder');
  });
});
