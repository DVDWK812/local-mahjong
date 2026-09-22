import { countDora } from './score/hanCalculator';
import { isRedFive } from './tileAssets';
import type { Tile } from './types';

export type DoraGlowClass = 'tile--dora' | 'tile--red-dora' | 'tile--double-dora' | null;

export function getDoraGlowClass(tile: Tile | undefined, indicators: Tile[] = [], enabled = false): DoraGlowClass {
  if (!enabled || !tile) return null;
  const normalDora = countDora([tile], indicators) > 0;
  const redDora = isRedFive(tile);
  if (normalDora && redDora) return 'tile--double-dora';
  if (redDora) return 'tile--red-dora';
  if (normalDora) return 'tile--dora';
  return null;
}
