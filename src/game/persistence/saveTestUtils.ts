import { startMatch } from '../match/matchEngine';
import { getRulePreset } from '../match/matchRules';
import { sampleMatchLog } from '../replay/replayTestUtils';
import type { SavedMatch } from './storageTypes';
import { createReplayRecord } from './replayRecord';
import { CURRENT_SAVE_VERSION } from './storageTypes';

export function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    length: 0,
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => { store.delete(key); },
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
}

export function sampleSavedMatch(): SavedMatch {
  const ruleConfig = getRulePreset('mahjong-soul-style');
  const matchState = startMatch(ruleConfig.match);
  return {
    version: CURRENT_SAVE_VERSION,
    saveId: 'save-1',
    savedAt: new Date(0).toISOString(),
    matchState,
    gameState: matchState.currentGame,
    matchLog: sampleMatchLog(),
    ruleConfig,
  };
}

export function sampleReplayRecord(overrides: Partial<ReturnType<typeof createReplayRecord>> = {}) {
  return {
    ...createReplayRecord({ log: sampleMatchLog(), updatedAt: new Date(0).toISOString() }),
    ...overrides,
  };
}
