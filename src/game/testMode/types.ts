import type { FullRuleConfig } from '../match/types';
import type { ReplayRecord } from '../persistence/storageTypes';
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

export const TEST_CASE_DEFINITION_VERSION = 1 as const;

export const TEST_CASE_CATEGORIES = [
  'game-rules',
  'scoring-settlement',
  'replay-hidden-information',
  'persistence-migration',
  'import-version',
  'random-stress',
  'ui-keyboard',
  'stab-001-legacy',
] as const;

export type TestCaseCategory = typeof TEST_CASE_CATEGORIES[number];
export type TestCaseKind = 'playable' | 'replay' | 'persistence' | 'import-validation' | 'seeded-run' | 'ui-interaction';
export type TestCaseRunStatus = 'not-run' | 'running' | 'passed' | 'failed' | 'manual-confirmation';

export interface TestCaseCommonV1 {
  version: typeof TEST_CASE_DEFINITION_VERSION;
  id: string;
  name: string;
  description: string;
  relatedAuditId?: string;
  category: TestCaseCategory;
  expectedResults: string[];
  manualSteps: string[];
  tags: string[];
}

export interface PlayableTestCase extends TestCaseCommonV1 {
  kind: 'playable';
  scenario: TestScenarioV1;
}

export interface ReplayTestCase extends TestCaseCommonV1 {
  kind: 'replay';
  runnerId?: string;
  replay?: ReplayRecord;
  initialRoundIndex?: number;
  initialStepIndex?: number;
}

export interface PersistenceTestCase extends TestCaseCommonV1 {
  kind: 'persistence';
  runnerId?: string;
  operation: 'round-trip' | 'write-failure' | 'read-failure' | 'remove-failure';
  storageKey: string;
  fixtureJson: string;
}

export interface ImportValidationTestCase extends TestCaseCommonV1 {
  kind: 'import-validation';
  format: 'test-scenario-v1' | 'test-case-v1' | 'replay-record' | 'raw-match-log' | 'json';
  inputJson: string;
  expectValid: boolean;
}

export interface SeededRunTestCase extends TestCaseCommonV1 {
  kind: 'seeded-run';
  seed: string;
  iterations: number;
  runnerId: string;
}

export interface UiInteractionStep {
  action: 'click' | 'key' | 'assert-visible' | 'assert-focus' | 'resize';
  target?: string;
  value?: string;
}

export interface UiInteractionTestCase extends TestCaseCommonV1 {
  kind: 'ui-interaction';
  route: string;
  steps: UiInteractionStep[];
}

export type TestCaseDefinitionV1 =
  | PlayableTestCase
  | ReplayTestCase
  | PersistenceTestCase
  | ImportValidationTestCase
  | SeededRunTestCase
  | UiInteractionTestCase;

export interface TestCaseRunResultV1 {
  version: 1;
  caseId: string;
  relatedAuditId: string | null;
  status: Exclude<TestCaseRunStatus, 'not-run' | 'running'>;
  currentStep: string;
  expected: string[];
  actual: string[];
  stateSummary: string;
  artifacts?: Array<{ name: string; mediaType: 'application/json' | 'text/plain'; content: string }>;
}
