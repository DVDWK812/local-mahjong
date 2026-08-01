import type { FullRuleConfig } from '../match/types';
import type { GameState, PlayerId } from '../types';

export const TEST_SCENARIO_VERSION = 1 as const;

export interface TestScenarioCheckpoint {
  id: string;
  description: string;
  afterAction?: string;
  expectedRinshanInstanceId?: string;
  expectedDoraSlotIndex?: number;
  expectedLiveWallRemaining?: number;
}

export interface TestScenarioV1 {
  version: typeof TEST_SCENARIO_VERSION;
  id: string;
  name: string;
  description: string;
  relatedAuditId?: string;
  ruleConfig: FullRuleConfig;
  handNumber: 1 | 2 | 3 | 4;
  gameState: GameState;
  manualPlayerIds: PlayerId[];
  declaredTileCount: number;
  initialTotalPoints: number;
  wallState: {
    usedRinshanCount: number;
    liveWallCountBeforeKans: number;
  };
  expectedCheckpoints?: TestScenarioCheckpoint[];
  instructions: string[];
}

export interface ScenarioValidationIssue {
  path: string;
  message: string;
}

export interface ScenarioValidationResult {
  valid: boolean;
  issues: ScenarioValidationIssue[];
}

export interface InvariantCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface TestModeActionLogEntry {
  sequence: number;
  label: string;
  phase: GameState['phase'];
  currentPlayer: PlayerId;
}
