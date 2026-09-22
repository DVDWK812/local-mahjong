import { describe, expect, it } from 'vitest';
import { voiceKeyForTileId } from './tileVoice';

describe('voiceKeyForTile', () => {
  it('covers the 34 stable tile IDs in catalogue order', () => {
    expect(Array.from({ length: 34 }, (_, id) => voiceKeyForTileId(id as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33))).toEqual([
      'tile.m1','tile.m2','tile.m3','tile.m4','tile.m5','tile.m6','tile.m7','tile.m8','tile.m9',
      'tile.p1','tile.p2','tile.p3','tile.p4','tile.p5','tile.p6','tile.p7','tile.p8','tile.p9',
      'tile.s1','tile.s2','tile.s3','tile.s4','tile.s5','tile.s6','tile.s7','tile.s8','tile.s9',
      'tile.z1','tile.z2','tile.z3','tile.z4','tile.z5','tile.z6','tile.z7',
    ]);
  });

  it('red fives share their stable normal-five tile IDs', () => {
    expect(voiceKeyForTileId(4)).toBe('tile.m5');
    expect(voiceKeyForTileId(13)).toBe('tile.p5');
    expect(voiceKeyForTileId(22)).toBe('tile.s5');
  });
});
