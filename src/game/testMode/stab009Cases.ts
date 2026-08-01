import { getRulePreset } from '../match/matchRules';
import { createReplayRecord } from '../persistence/replayRecord';
import { createInitialMatchLog } from '../replay/eventRecorder';
import { TEST_CASE_DEFINITION_VERSION, type ImportValidationTestCase } from './types';

export const STAB009_TEST_CASE_IDS = [
  'STAB-009-REPLAY-V0',
  'STAB-009-REPLAY-V1',
  'STAB-009-REPLAY-V2',
  'STAB-009-RAW-LOG-V0',
  'STAB-009-RAW-LOG-V1',
  'STAB-009-RAW-LOG-V2',
] as const;

export function getStab009TestCases(): ImportValidationTestCase[] {
  const log = createInitialMatchLog({
    matchId: 'STAB-009-version-policy',
    initialDealer: 0,
    initialScores: [25000, 25000, 25000, 25000],
    ruleConfig: getRulePreset('east-round'),
  });
  const record = createReplayRecord({ log, title: 'STAB-009版本策略', updatedAt: new Date(0).toISOString(), source: 'test-mode' });
  return [
    importCase(STAB009_TEST_CASE_IDS[0], 'ReplayRecord', 'replay-record', { ...record, version: 0 }, false, '拒绝：旧版本没有明确迁移器'),
    importCase(STAB009_TEST_CASE_IDS[1], 'ReplayRecord', 'replay-record', { ...record, version: 1 }, true, '接受：当前版本'),
    importCase(STAB009_TEST_CASE_IDS[2], 'ReplayRecord', 'replay-record', { ...record, version: 2 }, false, '拒绝：不支持的未来版本'),
    importCase(STAB009_TEST_CASE_IDS[3], 'MatchLog', 'raw-match-log', { ...log, version: 0 }, false, '拒绝：旧版本没有明确迁移器'),
    importCase(STAB009_TEST_CASE_IDS[4], 'MatchLog', 'raw-match-log', { ...log, version: 1 }, true, '接受：当前版本'),
    importCase(STAB009_TEST_CASE_IDS[5], 'MatchLog', 'raw-match-log', { ...log, version: 2 }, false, '拒绝：不支持的未来版本'),
  ];
}

function importCase(
  id: string,
  label: string,
  format: ImportValidationTestCase['format'],
  fixture: unknown,
  expectValid: boolean,
  reason: string,
): ImportValidationTestCase {
  return {
    version: TEST_CASE_DEFINITION_VERSION,
    id,
    name: `${label} ${id.endsWith('V0') ? 'v0' : id.endsWith('V1') ? 'v1' : 'v2'}版本策略`,
    description: `通过正式${label}导入入口执行统一版本判断。`,
    relatedAuditId: 'STAB-009',
    category: 'import-version',
    kind: 'import-validation',
    format,
    inputJson: JSON.stringify(fixture, null, 2),
    expectValid,
    expectedResults: [reason, `错误包含格式${label}、实际版本和支持版本`],
    manualSteps: ['运行用例。', '核对接受或拒绝原因及版本数字。'],
    tags: ['STAB-009', '导入', '版本', label, '自动'],
  };
}
