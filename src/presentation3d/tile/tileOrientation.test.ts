import { describe, expect, it } from 'vitest';
import { resolveTileOrientation } from './tileOrientation';

describe('3D tile orientation', () => {
  it('keeps upright face-up tiles in the shared seat-local frame', () => {
    expect(resolveTileOrientation()).toEqual({ faceState: 'face-up', rotation: [0, 0, 0] });
  });

  it('rotates sideways tiles by exactly one quarter turn', () => {
    expect(resolveTileOrientation('face-up', 'sideways')).toEqual({
      faceState: 'face-up',
      rotation: [0, Math.PI / 2, 0],
    });
  });

  it('preserves face-down state independently of layout orientation', () => {
    expect(resolveTileOrientation('face-down', 'sideways')).toEqual({
      faceState: 'face-down',
      rotation: [0, Math.PI / 2, 0],
    });
  });
});
