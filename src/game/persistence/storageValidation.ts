import { validateMatchState } from '../match/matchEngine';
import { validateMatchLog } from '../replay/validation';
import type { SavedMatch } from './storageTypes';

export function validateSavedMatch(save: SavedMatch): void {
  if (!save.saveId) throw new Error('saveId is required');
  if (!save.savedAt) throw new Error('savedAt is required');
  const matchIssues = validateMatchState(save.matchState);
  if (matchIssues.length > 0) throw new Error(matchIssues.join('; '));
  validateMatchLog(save.matchLog);
  if (save.gameState) {
    if (save.gameState.dealer !== save.matchState.dealer) throw new Error('GameState dealer does not match MatchState dealer');
    if (save.gameState.honba !== save.matchState.honba) throw new Error('GameState honba does not match MatchState honba');
    const instances = save.gameState.players.flatMap((player) => [...player.hand, ...player.river, ...player.calls.flatMap((call) => call.tiles)]).map((tile) => tile.instanceId);
    if (new Set(instances).size !== instances.length) throw new Error('Duplicate tile instance in saved GameState');
  }
}
