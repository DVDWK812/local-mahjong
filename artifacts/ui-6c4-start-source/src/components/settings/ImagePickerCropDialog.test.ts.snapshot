import { describe, expect, it } from 'vitest';
import { getImageCropFrame, ImagePickerCropDialog, INITIAL_IMAGE_CROP_ZOOM } from './ImagePickerCropDialog';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

describe('ImagePickerCropDialog crop frame', () => {
  it('doubles initial zoom for every target while preserving the original range', () => {
    expect(INITIAL_IMAGE_CROP_ZOOM).toBe(2);
    for (const aspectRatio of [3 / 4, 1.08 / 1.46, 1.26, 3.16 / 0.24, 74 / 104]) {
      const html = renderToStaticMarkup(createElement(ImagePickerCropDialog, { open: true, aspectRatio, title: '新增图片', onConfirm: () => undefined, onClose: () => undefined }));
      expect(html).toMatch(/type="range" min="0.5" max="3" step="0.01"[^>]*value="2"/);
    }
  });
  it('uses the requested target aspect instead of a fixed square', () => {
    const tileBack = getImageCropFrame(1.08 / 1.46, 320, 300);
    const avatar = getImageCropFrame(3 / 4, 320, 300);

    expect(tileBack.width / tileBack.height).toBeCloseTo(1.08 / 1.46);
    expect(avatar.width / avatar.height).toBeCloseTo(3 / 4);
    expect(tileBack.width).not.toBeCloseTo(tileBack.height);
    expect(avatar.width).not.toBeCloseTo(avatar.height);
  });
});
