import type { SavedMatch } from './storageTypes';
import { CURRENT_SAVE_VERSION } from './storageTypes';
import { createFullRuleConfig, normalizeMatchRuleConfig, type MatchRuleConfigInput } from '../match/matchRules';
import type { MatchState } from '../match/types';

export function migrateSavedMatch(input: unknown): SavedMatch {
  const save = input as Partial<SavedMatch>;
  if (!save || typeof save !== 'object') throw new Error('Saved match is not an object');
  if (save.version === undefined) throw new Error('Saved match version is missing');
  if (save.version > CURRENT_SAVE_VERSION) throw new Error('Saved match was created by a newer version');
  if (save.version === CURRENT_SAVE_VERSION) {
    const current = save as SavedMatch;
    const ruleConfig = createFullRuleConfig(
      current.ruleConfig.round,
      current.ruleConfig.match as MatchRuleConfigInput,
    );
    const storedMatch = current.matchState as MatchState & {
      currentMatchIndex?: number;
      matchResults?: MatchState['matchResults'];
      aggregateScores?: MatchState['aggregateScores'];
    };
    const matchState: MatchState = {
      ...storedMatch,
      ruleConfig: normalizeMatchRuleConfig(storedMatch.ruleConfig as MatchRuleConfigInput),
      currentMatchIndex: storedMatch.currentMatchIndex ?? 0,
      matchResults: storedMatch.matchResults ?? [],
      aggregateScores: storedMatch.aggregateScores ?? [0, 0, 0, 0],
    };
    return {
      ...current,
      ruleConfig,
      gameState: current.gameState ? {
        ...current.gameState,
        ruleConfig: ruleConfig.round,
        kuikaeForbiddenTileIds: current.gameState.kuikaeForbiddenTileIds ?? {},
      } : undefined,
      matchState,
      matchLog: {
        ...current.matchLog,
        ruleConfig,
      },
    };
  }
  throw new Error(`Cannot migrate saved match version ${save.version}`);
}
