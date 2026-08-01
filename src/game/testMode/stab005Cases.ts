import { settleRoundState } from '../roundSettlement';
import type { GameState, PlayerId, WinResultEntry, WinRoundResult } from '../types';
import { getBuiltInTestScenario } from './builtInScenarios';
import { cloneTestScenario, scenarioFromGameState } from './scenario';
import { TEST_CASE_DEFINITION_VERSION, type PlayableTestCase, type TestScenarioV1 } from './types';

interface SettlementCaseSpec {
  id: string;
  name: string;
  description: string;
  startingPoints: number;
  sticks: number;
  result: 'ron' | 'tsumo' | 'chankan' | 'multi-ron';
}

const SPECS: SettlementCaseSpec[] = [
  { id: 'STAB-005-RON-1-STICK', name: 'STAB-005 荣和一根供托', description: '荣和结算后桌面供托清零，结果保留结算前一根供托快照。', startingPoints: 25000, sticks: 1, result: 'ron' },
  { id: 'STAB-005-TSUMO-4-STICKS', name: 'STAB-005 自摸四根供托', description: '自摸结算一次领取四根供托，权威状态保持点数守恒。', startingPoints: 25000, sticks: 4, result: 'tsumo' },
  { id: 'STAB-005-CHANKAN-STICKS', name: 'STAB-005 抢杠和供托', description: '抢杠和通过杠相关结算路径后使用同一供托快照语义。', startingPoints: 25000, sticks: 2, result: 'chankan' },
  { id: 'STAB-005-MULTI-RON-STICKS', name: 'STAB-005 多家荣和供托', description: '多家荣和继续按既有顺序只向首位赢家发放供托。', startingPoints: 25000, sticks: 3, result: 'multi-ron' },
  { id: 'STAB-005-CUSTOM-STARTING-POINTS', name: 'STAB-005 自定义起始点数', description: '四家27000点时按108000动态总点数检查结算守恒。', startingPoints: 27000, sticks: 2, result: 'ron' },
];

export function getStab005TestCases(): PlayableTestCase[] {
  return SPECS.map((spec) => buildCase(spec));
}

function buildCase(spec: SettlementCaseSpec): PlayableTestCase {
  const scenario = buildScenario(spec);
  return {
    version: TEST_CASE_DEFINITION_VERSION,
    id: spec.id,
    name: spec.name,
    description: spec.description,
    relatedAuditId: 'STAB-005',
    category: 'scoring-settlement',
    kind: 'playable',
    scenario,
    expectedResults: [
      `结算前供托=${spec.sticks}，当前桌面供托=0`,
      `玩家点数合计=${spec.startingPoints * 4}，守恒检查通过`,
      '结果弹窗、事件记录与回放使用同一结算快照',
    ],
    manualSteps: [
      '进入正式牌桌并打开调试面板。',
      '核对结果弹窗的供托奖励与“结算前供托”一致。',
      '核对当前桌面供托为0、动态总点数守恒为通过。',
      '导出测试牌谱，在最终步骤复核供托和四家分数。',
    ],
    tags: ['结算', '供托', '点数守恒', '人工', '确定性'],
  };
}

function buildScenario(spec: SettlementCaseSpec): TestScenarioV1 {
  const source = cloneTestScenario(getBuiltInTestScenario('STAB-001-ANKAN')!);
  const preSettlement: GameState = {
    ...source.gameState,
    phase: 'discard',
    result: null,
    riichiSticks: spec.sticks,
    lastWinSource: spec.result === 'chankan' ? 'chankan' : spec.result === 'tsumo' ? 'normal-tsumo' : 'ron-discard',
    matchRuleConfig: { ...source.gameState.matchRuleConfig, startingPoints: spec.startingPoints },
    players: source.gameState.players.map((player, index) => ({
      ...player,
      score: spec.startingPoints - (index === 0 ? spec.sticks * 1000 : 0),
    })),
  };
  const result = buildResult(preSettlement, spec);
  const settled = settleRoundState(preSettlement, result);
  const ruleConfig = {
    ...source.ruleConfig,
    match: { ...source.ruleConfig.match, startingPoints: spec.startingPoints },
  };
  return scenarioFromGameState({
    id: spec.id,
    name: spec.name,
    description: spec.description,
    relatedAuditId: 'STAB-005',
    ruleConfig,
    handNumber: 1,
    gameState: settled,
    manualPlayerIds: [0, 1, 2, 3],
    initialTotalPoints: spec.startingPoints * 4,
    instructions: [
      '检查结果弹窗显示结算前供托快照。',
      '检查调试面板当前供托为0且动态点数守恒通过。',
      '导出牌谱并在最终结果步骤复核相同状态。',
    ],
  });
}

function buildResult(state: GameState, spec: SettlementCaseSpec): WinRoundResult {
  const winTile = state.players[0].hand[0];
  if (spec.result === 'tsumo') {
    const deltas = [3000 + spec.sticks * 1000, -1000, -1000, -1000];
    return { type: 'tsumo', winners: [winEntry(0, null, deltas, winTile)], pointDeltas: deltas };
  }
  if (spec.result === 'multi-ron') {
    const first = [-1000, 1000 + spec.sticks * 1000, 0, 0];
    const second = [-1000, 0, 1000, 0];
    return {
      type: 'ron',
      winners: [winEntry(1, 0, first, winTile), winEntry(2, 0, second, winTile)],
      pointDeltas: first.map((delta, index) => delta + second[index]),
    };
  }
  const deltas = [-1000, 1000 + spec.sticks * 1000, 0, 0];
  return { type: 'ron', winners: [winEntry(1, 0, deltas, winTile)], pointDeltas: deltas };
}

function winEntry(winner: PlayerId, from: PlayerId | null, pointDeltas: number[], winTile: WinResultEntry['winTile']): WinResultEntry {
  return {
    winner,
    from,
    winType: from === null ? 'tsumo' : 'ron',
    winTile,
    yaku: [{ name: '测试结算快照', han: 1 }],
    han: 1,
    fu: 30,
    points: pointDeltas[winner],
    pointDeltas,
  };
}
