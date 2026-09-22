import type { Texture } from 'three';

/** Shared by static sticks, animation proxies and image crop/preview. */
export const RIICHI_STICK_3D_LAYOUT = {
  length: 3.16,
  width: 0.24,
  height: 0.065,
  epsilon: 0.006,
} as const;

export const RIICHI_STICK_FACE_SIZE = {
  length: RIICHI_STICK_3D_LAYOUT.length - 0.035,
  width: RIICHI_STICK_3D_LAYOUT.width - 0.012,
} as const;

/** Preserve image proportions (including old library crops), without editing Blob pixels. */
export function applyRiichiStickTextureCover(texture: Texture): void {
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  const image: unknown = texture.image;
  if (!image || typeof image !== 'object' || !('width' in image) || !('height' in image)
    || typeof image.width !== 'number' || typeof image.height !== 'number'
    || !(image.width > 0 && image.height > 0)) return;
  const sourceAspect = image.width / image.height;
  const surfaceAspect = RIICHI_STICK_FACE_SIZE.length / RIICHI_STICK_FACE_SIZE.width;
  if (sourceAspect > surfaceAspect) texture.repeat.x = surfaceAspect / sourceAspect;
  else texture.repeat.y = sourceAspect / surfaceAspect;
  texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2);
}
