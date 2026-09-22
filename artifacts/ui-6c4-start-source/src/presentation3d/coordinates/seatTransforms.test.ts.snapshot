import { describe, expect, it } from 'vitest';
import { getSeatDirection, getSeatRotation, getSeatTransform } from './seatTransforms';

describe('3D table seat transforms', () => {
  it('maps each visual seat to a deterministic centre-facing rotation', () => {
    expect(getSeatRotation('bottom')).toBe(0);
    expect(getSeatRotation('right')).toBe(Math.PI / 2);
    expect(getSeatRotation('top')).toBe(Math.PI);
    expect(getSeatRotation('left')).toBe(-Math.PI / 2);
  });

  it('maps all directions toward the table centre', () => {
    expect(getSeatDirection('bottom')).toEqual({ x: 0, z: -1 });
    expect(getSeatDirection('right')).toEqual({ x: -1, z: 0 });
    expect(getSeatDirection('top')).toEqual({ x: 0, z: 1 });
    expect(getSeatDirection('left')).toEqual({ x: 1, z: 0 });
  });

  it('keeps opposite seats opposite in shared world coordinates', () => {
    const bottom = getSeatTransform('bottom').position;
    const top = getSeatTransform('top').position;
    const right = getSeatTransform('right').position;
    const left = getSeatTransform('left').position;

    expect(bottom[2]).toBe(-top[2]);
    expect(right[0]).toBe(-left[0]);
    expect(bottom[0]).toBe(top[0]);
    expect(right[2]).toBe(left[2]);
  });
});
