import { validateMatchState } from '../match/matchEngine';
import { validateMatchLog } from '../replay/validation';
import type { ReplayRecord, SavedMatch } from './storageTypes';
import { validateTileInstanceRegions } from '../tileInstanceValidation';

export function validateSavedMatch(save: SavedMatch): void {
  if (!save.saveId) throw new Error('saveId is required');
  if (!save.savedAt) throw new Error('savedAt is required');
  const matchIssues = validateMatchState(save.matchState);
  if (matchIssues.length > 0) throw new Error(matchIssues.join('; '));
  validateMatchLog(save.matchLog);
  if (save.gameState) {
    if (save.gameState.dealer !== save.matchState.dealer) throw new Error('GameState dealer does not match MatchState dealer');
    if (save.gameState.honba !== save.matchState.honba) throw new Error('GameState honba does not match MatchState honba');
    const tileInstanceIssues = validateTileInstanceRegions(save.gameState);
    if (tileInstanceIssues.length > 0) throw new Error(tileInstanceIssues.join('; '));
  }
}

export function validateReplayRecord(record: ReplayRecord): void {
  if (!record || typeof record !== 'object') throw new Error('Replay record is not an object');
  if (record.version !== 1) throw new Error('Unsupported replay record version');
  if (!record.id || record.id !== record.matchId || record.log.matchId !== record.id) {
    throw new Error('Replay id does not match match log');
  }
  if (!record.title.trim()) throw new Error('Replay title is required');
  if (!isIsoDate(record.createdAt) || !isIsoDate(record.updatedAt)) throw new Error('Replay timestamps are invalid');
  if (!Array.isArray(record.playerNames) || record.playerNames.length !== 4) throw new Error('Replay requires four players');
  if (!Array.isArray(record.scores) || record.scores.length !== 4 || record.scores.some((score) => !Number.isFinite(score))) {
    throw new Error('Replay scores are invalid');
  }
  if (!['four-east', 'four-south', 'single'].includes(record.matchType)) throw new Error('Replay match type is invalid');
  if (!Number.isInteger(record.roundCount) || record.roundCount < 0) throw new Error('Replay round count is invalid');
  if (record.source !== 'local-match') throw new Error('Replay source is invalid');
  if (record.status !== 'completed' && record.status !== 'incomplete') throw new Error('Replay status is invalid');
  validateMatchLog(record.log);
}

function isIsoDate(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
