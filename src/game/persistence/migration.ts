import type { SavedMatch } from './storageTypes';
import { CURRENT_SAVE_VERSION } from './storageTypes';

export function migrateSavedMatch(input: unknown): SavedMatch {
  const save = input as Partial<SavedMatch>;
  if (!save || typeof save !== 'object') throw new Error('Saved match is not an object');
  if (save.version === undefined) throw new Error('Saved match version is missing');
  if (save.version > CURRENT_SAVE_VERSION) throw new Error('Saved match was created by a newer version');
  if (save.version === CURRENT_SAVE_VERSION) return save as SavedMatch;
  throw new Error(`Cannot migrate saved match version ${save.version}`);
}
