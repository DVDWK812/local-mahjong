import { describe, expect, it } from 'vitest';
import { loadStoredSeventeenStepsMatchConfig, saveStoredSeventeenStepsMatchConfig, SEVENTEEN_STEPS_CONFIG_STORAGE_KEY } from './seventeenStepsMatch';
import { DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG } from './seventeenSteps';

describe('17步比赛设置持久化', () => {
  it('保存并恢复 AI、来回数、满贯缚与显示选项', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const config = {
      ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG,
      cycleCount: 4 as const,
      aiDifficulty: 'upper',
      displayOptions: { ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG.displayOptions, doraGlowEnabled: false },
    };
    saveStoredSeventeenStepsMatchConfig(config, storage);
    expect(values.has(SEVENTEEN_STEPS_CONFIG_STORAGE_KEY)).toBe(true);
    expect(loadStoredSeventeenStepsMatchConfig(storage)).toMatchObject(config);
  });
});
