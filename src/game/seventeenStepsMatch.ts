import {
  DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG,
  normalizeSeventeenStepsMatchConfig,
  type SeventeenStepsMatchConfig,
} from './seventeenSteps';

export const SEVENTEEN_STEPS_CONFIG_STORAGE_KEY = 'local-mahjong.seventeen-steps.match-config.v1';

export function loadStoredSeventeenStepsMatchConfig(storage?: Pick<Storage, 'getItem'>): SeventeenStepsMatchConfig {
  if (!storage) return normalizeSeventeenStepsMatchConfig(DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG);
  try {
    const raw = storage.getItem(SEVENTEEN_STEPS_CONFIG_STORAGE_KEY);
    if (!raw) return normalizeSeventeenStepsMatchConfig(DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG);
    const parsed = JSON.parse(raw) as { version?: number; config?: Partial<SeventeenStepsMatchConfig> };
    return parsed.version === 1
      ? normalizeSeventeenStepsMatchConfig(parsed.config)
      : normalizeSeventeenStepsMatchConfig(DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG);
  } catch {
    return normalizeSeventeenStepsMatchConfig(DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG);
  }
}

export function saveStoredSeventeenStepsMatchConfig(config: SeventeenStepsMatchConfig, storage?: Pick<Storage, 'setItem'>): void {
  storage?.setItem(SEVENTEEN_STEPS_CONFIG_STORAGE_KEY, JSON.stringify({ version: 1, config }));
}

