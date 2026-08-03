import type { ReplayRecord } from '../persistence/storageTypes';
import { initialScoresForRound, buildReplayState } from '../replay/roundReplay';
import type { GameState, PlayerId, Tile, TileId } from '../types';
import { validateTileInstanceRegions } from '../tileInstanceValidation';
import { getDrawActionState } from '../interaction';
import { canPon } from '../callChecker';
import { canChi } from '../chiChecker';
import { canChankan, canMinkan } from '../kanChecker';
import { legalDiscardTiles } from '../kuikae';
import { doraIndicatorSlots } from '../wall';
import { TEST_SCENARIO_VERSION, type InvariantCheck, type ScenarioValidationIssue, type ScenarioValidationResult, type TestScenarioV1 } from './types';

export class TestScenarioValidationError extends Error {
  readonly issues: ScenarioValidationIssue[];

  constructor(issues: ScenarioValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
    this.name = 'TestScenarioValidationError';
    this.issues = issues;
  }
}

export function cloneTestScenario(scenario: TestScenarioV1): TestScenarioV1 {
  return JSON.parse(JSON.stringify(scenario)) as TestScenarioV1;
}

export function parseTestScenarioJson(json: string): TestScenarioV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new TestScenarioValidationError([{ path: '$', message: `不是有效JSON：${error instanceof Error ? error.message : '解析失败'}` }]);
  }
  const validation = validateTestScenario(parsed);
  if (!validation.valid) throw new TestScenarioValidationError(validation.issues);
  return cloneTestScenario(parsed as TestScenarioV1);
}

export function serializeTestScenario(scenario: TestScenarioV1): string {
  return JSON.stringify(scenario, null, 2);
}

export function loadTestScenarioState(scenario: TestScenarioV1): GameState {
  const validation = validateTestScenario(scenario);
  if (!validation.valid) throw new TestScenarioValidationError(validation.issues);
  return cloneTestScenario(scenario).gameState;
}

export function validateTestScenario(input: unknown): ScenarioValidationResult {
  const issues: ScenarioValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  if (!isRecord(input)) return { valid: false, issues: [{ path: '$', message: '场景必须是对象' }] };
  if (input.version !== TEST_SCENARIO_VERSION) add('version', `仅支持版本${TEST_SCENARIO_VERSION}`);
  for (const key of ['id', 'name', 'description'] as const) {
    if (typeof input[key] !== 'string' || !input[key].trim()) add(key, '必须是非空字符串');
  }
  if (!isRecord(input.ruleConfig)) add('ruleConfig', '缺少完整规则配置');
  if (!isRecord(input.gameState)) add('gameState', '缺少可序列化GameState');
  if (!Array.isArray(input.instructions) || input.instructions.some((entry) => typeof entry !== 'string')) add('instructions', '必须是字符串数组');
  if (!Array.isArray(input.manualPlayerIds)) add('manualPlayerIds', '必须是玩家ID数组');
  if (!Number.isInteger(input.declaredTileCount) || Number(input.declaredTileCount) <= 0) add('declaredTileCount', '必须是正整数');
  if (!Number.isFinite(input.initialTotalPoints)) add('initialTotalPoints', '必须是有限数值');
  if (!isRecord(input.wallState)) add('wallState', '缺少牌山记账信息');
  if (!isRecord(input.gameState)) return { valid: false, issues };

  const state = input.gameState as unknown as GameState;
  if (!Array.isArray(state.players) || state.players.length !== 4) {
    add('gameState.players', '必须恰好包含四名玩家');
    return { valid: false, issues };
  }
  const playerIds = state.players.map((player) => player?.id);
  if (new Set(playerIds).size !== 4 || playerIds.some((id) => !isPlayerId(id))) add('gameState.players', 'playerId必须为唯一的0、1、2、3');
  if (!isPlayerId(state.currentPlayer)) add('gameState.currentPlayer', '当前玩家必须为0至3');
  if (!VALID_PHASES.has(state.phase)) add('gameState.phase', '未知phase');
  if (!Array.isArray(state.wall)) add('gameState.wall', '活牌墙必须是数组');
  if (!Array.isArray(state.deadWall) || state.deadWall.length !== 14) add('gameState.deadWall', '王牌必须保留固定14张槽位');

  const physicalTiles = collectPhysicalTiles(state, add);
  const uniqueTiles = uniqueTilesByInstance(physicalTiles, add);
  if (Number.isInteger(input.declaredTileCount) && uniqueTiles.size !== input.declaredTileCount) {
    add('declaredTileCount', `声明为${input.declaredTileCount}，实际唯一物理实例为${uniqueTiles.size}`);
  }
  validateTileCopies(uniqueTiles, add);
  for (const message of safeInstanceRegionValidation(state)) add('gameState', message);

  const usedRinshanCount = isRecord(input.wallState) ? input.wallState.usedRinshanCount : undefined;
  const liveWallCountBeforeKans = isRecord(input.wallState) ? input.wallState.liveWallCountBeforeKans : undefined;
  const completedKanCount = countCompletedKans(state);
  if (!Number.isInteger(usedRinshanCount) || Number(usedRinshanCount) < 0 || Number(usedRinshanCount) > 4) {
    add('wallState.usedRinshanCount', '必须是0至4的整数');
  } else if (usedRinshanCount !== completedKanCount) {
    add('wallState.usedRinshanCount', `应与已完成杠数${completedKanCount}一致`);
  }
  if (!Number.isInteger(liveWallCountBeforeKans) || Number(liveWallCountBeforeKans) < 0) {
    add('wallState.liveWallCountBeforeKans', '必须是非负整数');
  } else if (Array.isArray(state.wall) && liveWallCountBeforeKans !== state.wall.length + completedKanCount) {
    add('wallState.liveWallCountBeforeKans', '必须等于当前活牌墙长度加已使用岭上牌数');
  }
  validateDoraSlots(state, completedKanCount, add);
  validatePlayerStateReferences(state, add);
  validatePhaseAndHands(state, add);
  validatePendingWindows(state, add);

  if (Number.isFinite(input.initialTotalPoints)) {
    const actual = conservedPoints(state);
    if (actual !== input.initialTotalPoints) add('initialTotalPoints', `点数与供托合计为${actual}，不等于声明值${input.initialTotalPoints}`);
  }
  if (Array.isArray(input.manualPlayerIds)) {
    const manualIds = input.manualPlayerIds as unknown[];
    if (new Set(manualIds).size !== manualIds.length || manualIds.some((id) => !isPlayerId(id))) add('manualPlayerIds', '只能包含不重复的0至3');
  }
  return { valid: issues.length === 0, issues };
}

export function scenarioFromGameState(params: {
  id: string;
  name: string;
  description: string;
  relatedAuditId?: string;
  ruleConfig: TestScenarioV1['ruleConfig'];
  handNumber: TestScenarioV1['handNumber'];
  gameState: GameState;
  instructions?: string[];
  manualPlayerIds?: PlayerId[];
  initialTotalPoints?: number;
  usedRinshanCount?: number;
}): TestScenarioV1 {
  const gameState = JSON.parse(JSON.stringify(params.gameState)) as GameState;
  const usedRinshanCount = params.usedRinshanCount ?? countCompletedKans(gameState);
  return {
    version: TEST_SCENARIO_VERSION,
    id: params.id,
    name: params.name,
    description: params.description,
    relatedAuditId: params.relatedAuditId,
    ruleConfig: JSON.parse(JSON.stringify(params.ruleConfig)) as TestScenarioV1['ruleConfig'],
    handNumber: params.handNumber,
    gameState,
    manualPlayerIds: params.manualPlayerIds ?? [0, 1, 2, 3],
    declaredTileCount: uniqueTilesByInstance(collectPhysicalTiles(gameState)).size,
    initialTotalPoints: params.initialTotalPoints ?? conservedPoints(gameState),
    wallState: {
      usedRinshanCount,
      liveWallCountBeforeKans: gameState.wall.length + usedRinshanCount,
    },
    instructions: params.instructions ?? [],
  };
}

export type ReplayScenarioConversion =
  | { ok: true; scenario: TestScenarioV1 }
  | { ok: false; reason: string; issues?: ScenarioValidationIssue[] };

export function convertReplayStepToTestScenario(replay: ReplayRecord, roundIndex: number, stepIndex: number): ReplayScenarioConversion {
  const round = replay.log.rounds[roundIndex];
  if (!round) return { ok: false, reason: '找不到指定回放局。' };
  const hasCompleteWall = (Array.isArray(round.liveWall) && Array.isArray(round.deadWall) && round.deadWall.length === 14)
    || (Array.isArray(round.wallOrder) && round.wallOrder.length >= 14);
  if (!hasCompleteWall) return { ok: false, reason: '该旧牌谱未记录完整活牌墙和14张王牌，无法转换为可继续操作的测试场景。' };
  const scores = initialScoresForRound(replay.log, roundIndex);
  const built = buildReplayState(round, stepIndex, {
    scores,
    playerNames: replay.playerNames,
    ruleConfig: replay.log.ruleConfig,
  });
  const scenario = scenarioFromGameState({
    id: sanitizeScenarioId(`replay-${replay.matchId}-${round.roundId}-step-${built.stepIndex}`),
    name: `${replay.title} · ${round.roundWind}${round.handNumber}局 · 步骤${built.stepIndex}`,
    description: '由牌谱播放器当前步骤转换；后续动作使用正式游戏引擎。',
    ruleConfig: replay.log.ruleConfig,
    handNumber: Math.max(1, Math.min(4, round.handNumber)) as 1 | 2 | 3 | 4,
    gameState: built.gameState,
    usedRinshanCount: built.wall.drawnDeadTiles.length,
    initialTotalPoints: scores.reduce((sum, score) => sum + score, 0) + round.riichiSticks * 1000,
    instructions: ['确认当前步骤状态后，从测试模式工具栏选择控制玩家并继续操作。'],
  });
  const validation = validateTestScenario(scenario);
  return validation.valid
    ? { ok: true, scenario }
    : { ok: false, reason: '当前牌谱步骤不能形成合法测试场景。', issues: validation.issues };
}

export function runtimeInvariantChecks(scenario: TestScenarioV1, state: GameState): InvariantCheck[] {
  const usedRinshanCount = countCompletedKans(state);
  const uniqueTiles = uniqueTilesByInstance(collectPhysicalTiles(state));
  const expectedTileCount = scenario.declaredTileCount - Math.max(0, usedRinshanCount - scenario.wallState.usedRinshanCount);
  const regionIssues = safeInstanceRegionValidation(state);
  const tileCopyIssues: ScenarioValidationIssue[] = [];
  validateTileCopies(uniqueTiles, (path, message) => tileCopyIssues.push({ path, message }));
  const doraIssues: ScenarioValidationIssue[] = [];
  validateDoraSlots(state, usedRinshanCount, (path, message) => doraIssues.push({ path, message }));
  const phaseIssues: ScenarioValidationIssue[] = [];
  validatePlayerStateReferences(state, (path, message) => phaseIssues.push({ path, message }));
  validatePendingWindows(state, (path, message) => phaseIssues.push({ path, message }));
  const legal = legalActionSummary(state);
  const terminal = state.phase === 'round-ended' || state.phase === 'exhaustive-draw';
  return [
    check('tile-total', '牌实例总量', uniqueTiles.size === expectedTileCount, `${uniqueTiles.size} / 预期${expectedTileCount}`),
    check('effective-unique', '有效区域实例唯一性', regionIssues.length === 0, regionIssues.join('；') || '通过'),
    check('tile-copies', '每种牌不超过四张', tileCopyIssues.length === 0, tileCopyIssues.map((issue) => issue.message).join('；') || '通过'),
    check('wall-accounting', '活牌墙与王牌数量关系', state.deadWall.length === 14 && state.wall.length === scenario.wallState.liveWallCountBeforeKans - usedRinshanCount, `活牌${state.wall.length}，王牌${state.deadWall.length}，已杠${usedRinshanCount}`),
    check('rinshan-unique', '岭上牌无重复使用', usedRinshanCount <= 4 && regionIssues.every((issue) => !issue.toLowerCase().includes('dead wall')), `已使用${usedRinshanCount}张`),
    check('dora-slots', '宝牌槽位有效', doraIssues.length === 0, doraIssues.map((issue) => issue.message).join('；') || `公开${state.doraIndicators.length}张`),
    check('phase-player', '当前玩家与phase有效', phaseIssues.length === 0 && isPlayerId(state.currentPlayer) && VALID_PHASES.has(state.phase), phaseIssues.map((issue) => issue.message).join('；') || `${state.currentPlayer} / ${state.phase}`),
    check('points', '点数加供托守恒', conservedPoints(state) === scenario.initialTotalPoints, `${conservedPoints(state)} / 初始${scenario.initialTotalPoints}`),
    check('legal-progress', '存在合法推进或已经终局', terminal || legal.length > 0, terminal ? '终局' : legal.join('、') || '无合法动作'),
  ];
}

export function legalActionSummary(state: GameState): string[] {
  if (state.phase === 'round-ended' || state.phase === 'exhaustive-draw') return [];
  if (state.phase === 'draw') return state.wall.length > 0 ? ['摸牌'] : ['结算流局'];
  if (state.phase === 'discard') {
    const actions = getDrawActionState(state, state.currentPlayer);
    const labels: string[] = [];
    if (legalDiscardTiles(state, state.currentPlayer).length > 0) labels.push('弃牌');
    if (actions.canTsumo) labels.push('自摸');
    if (actions.canRiichi) labels.push('立直');
    if (actions.canKyuushuKyuuhai) labels.push('九种九牌');
    if (actions.ankanCandidates.length > 0) labels.push(`暗杠(${actions.ankanCandidates.map((entry) => entry.tileId).join(',')})`);
    if (actions.kakanCandidates.length > 0) labels.push(`加杠(${actions.kakanCandidates.map((entry) => entry.tileId).join(',')})`);
    return labels;
  }
  if (state.phase === 'call-window') {
    const labels = ['跳过鸣牌'];
    for (const player of state.players) {
      if (canMinkan(state, player.id)) labels.push(`玩家${player.id + 1}明杠`);
      if (canPon(state, player.id)) labels.push(`玩家${player.id + 1}碰`);
      if (canChi(state, player.id)) labels.push(`玩家${player.id + 1}吃`);
    }
    return labels;
  }
  if (state.phase === 'ron-window') return ['荣和', '跳过荣和'];
  if (state.phase === 'chankan-window') {
    const canRon = state.players.some((player) => canChankan(state, player.id));
    return canRon ? ['抢杠和', '跳过抢杠'] : ['继续加杠'];
  }
  return ['继续正式状态机'];
}

export function stateSummary(scenario: TestScenarioV1, state: GameState, actionSequence: number): string {
  const checks = runtimeInvariantChecks(scenario, state);
  return [
    `场景: ${scenario.id}`,
    `动作序号: ${actionSequence}`,
    `当前玩家: ${state.currentPlayer}`,
    `phase: ${state.phase}`,
    `活牌墙: ${state.wall.length}`,
    `王牌: ${state.deadWall.length}`,
    `岭上已用: ${countCompletedKans(state)}`,
    `宝牌指示牌: ${state.doraIndicators.map((tile) => `${tile.instanceId}(${tile.id})`).join(', ')}`,
    `分数: ${state.players.map((player) => player.score).join(' / ')}`,
    `供托: ${state.riichiSticks}`,
    `合法动作: ${legalActionSummary(state).join('、') || '无'}`,
    ...checks.map((entry) => `${entry.passed ? 'PASS' : 'FAIL'} ${entry.label}: ${entry.detail}`),
  ].join('\n');
}

export function countCompletedKans(state: GameState): number {
  return state.players.reduce((count, player) => count + player.calls.filter((call) => call.type === 'kan').length, 0);
}

export function conservedPoints(state: Pick<GameState, 'players' | 'riichiSticks'>): number {
  return state.players.reduce((sum, player) => sum + player.score, 0) + state.riichiSticks * 1000;
}

function collectPhysicalTiles(state: GameState, add?: (path: string, message: string) => void): Array<{ path: string; tile: Tile }> {
  const entries: Array<{ path: string; tile: Tile }> = [];
  const push = (path: string, value: unknown) => {
    if (!isTile(value)) {
      add?.(path, '不是有效牌对象');
      return;
    }
    entries.push({ path, tile: value });
  };
  state.players?.forEach((player, playerIndex) => {
    player.hand?.forEach((tile, index) => push(`gameState.players[${playerIndex}].hand[${index}]`, tile));
    player.river?.forEach((tile, index) => push(`gameState.players[${playerIndex}].river[${index}]`, tile));
    player.calls?.forEach((call, callIndex) => call.tiles?.forEach((tile, index) => push(`gameState.players[${playerIndex}].calls[${callIndex}].tiles[${index}]`, tile)));
  });
  state.wall?.forEach((tile, index) => push(`gameState.wall[${index}]`, tile));
  state.deadWall?.forEach((tile, index) => push(`gameState.deadWall[${index}]`, tile));
  return entries;
}

function uniqueTilesByInstance(entries: Array<{ path: string; tile: Tile }>, add?: (path: string, message: string) => void): Map<string, Tile> {
  const unique = new Map<string, Tile>();
  for (const { path, tile } of entries) {
    if (!tile.instanceId.trim()) {
      add?.(`${path}.instanceId`, 'instanceId不能为空');
      continue;
    }
    const existing = unique.get(tile.instanceId);
    if (existing && (existing.id !== tile.id || existing.red !== tile.red)) add?.(`${path}.instanceId`, '同一instanceId引用了不同牌');
    else if (!existing) unique.set(tile.instanceId, tile);
  }
  return unique;
}

function validateTileCopies(unique: Map<string, Tile>, add: (path: string, message: string) => void): void {
  const counts = new Map<TileId, number>();
  const redCounts = new Map<TileId, number>();
  for (const tile of unique.values()) {
    counts.set(tile.id, (counts.get(tile.id) ?? 0) + 1);
    if (tile.red) redCounts.set(tile.id, (redCounts.get(tile.id) ?? 0) + 1);
    if (tile.red && tile.id !== 4 && tile.id !== 13 && tile.id !== 22) add('gameState', `只有五万、五筒、五索可以是赤牌：${tile.instanceId}`);
  }
  for (const [id, count] of counts) if (count > 4) add('gameState', `牌型${id}有${count}张，超过四张`);
  for (const [id, count] of redCounts) if (count > 1) add('gameState', `赤牌牌型${id}有${count}张，超过项目上限一张`);
}

function validateDoraSlots(state: GameState, usedRinshanCount: number, add: (path: string, message: string) => void): void {
  if (!Array.isArray(state.deadWall) || state.deadWall.length !== 14 || !Array.isArray(state.doraIndicators)) return;
  const expected = doraIndicatorSlots(state.deadWall).slice(0, Math.min(5, usedRinshanCount + 1));
  if (state.doraIndicators.length !== expected.length) add('gameState.doraIndicators', `已完成${usedRinshanCount}次杠时应公开${expected.length}张表宝牌`);
  expected.forEach((tile, index) => {
    if (state.doraIndicators[index]?.instanceId !== tile.instanceId) add(`gameState.doraIndicators[${index}]`, `必须来自共享王牌表宝槽，期望${tile.instanceId}`);
  });
}

function validatePlayerStateReferences(state: GameState, add: (path: string, message: string) => void): void {
  state.players.forEach((player, index) => {
    if (player.id !== index) add(`gameState.players[${index}].id`, '玩家数组必须按playerId 0至3排列');
    if (player.drawnTile && !player.hand.some((tile) => tile.instanceId === player.drawnTile?.instanceId)) {
      add(`gameState.players[${index}].drawnTile`, '当前摸牌实例必须属于该玩家手牌');
    }
  });
}

function validatePhaseAndHands(state: GameState, add: (path: string, message: string) => void): void {
  if (state.phase === 'round-ended') return;
  state.players.forEach((player) => {
    const base = 13 - player.calls.length * 3;
    const hasExtra = (state.phase === 'discard' && state.currentPlayer === player.id)
      || (state.phase === 'chankan-window' && state.pendingKakan?.declarer === player.id);
    const expected = base + (hasExtra ? 1 : 0);
    if (player.hand.length !== expected) add(`gameState.players[${player.id}].hand`, `当前phase下应有${expected}张暗手，实际${player.hand.length}张`);
  });
}

function validatePendingWindows(state: GameState, add: (path: string, message: string) => void): void {
  if (state.phase === 'call-window') {
    if (!state.pendingCall) add('gameState.pendingCall', '鸣牌窗口必须包含pendingCall');
    else {
      if (!state.pendingCall.options.length) add('gameState.pendingCall.options', '鸣牌窗口至少需要一个候选');
      if (!state.players[state.pendingCall.discarder]?.river.some((tile) => tile.instanceId === state.pendingCall?.tile.instanceId)) add('gameState.pendingCall.tile', '必须对应来源玩家牌河中的弃牌实例');
    }
  }
  if (state.phase === 'ron-window' && !state.pendingRon) add('gameState.pendingRon', '荣和窗口必须包含pendingRon');
  if (state.phase === 'chankan-window') {
    const pending = state.pendingKakan;
    if (!pending) add('gameState.pendingKakan', '抢杠窗口必须包含pendingKakan');
    else {
      const declarer = state.players[pending.declarer];
      if (!declarer?.hand.some((tile) => tile.instanceId === pending.addedTileInstanceId)) add('gameState.pendingKakan.addedTileInstanceId', '加杠牌必须仍在宣告者手牌');
      if (declarer?.calls[pending.ponCallIndex]?.type !== 'pon') add('gameState.pendingKakan.ponCallIndex', '必须指向待升级的碰副露');
    }
  }
}

function safeInstanceRegionValidation(state: GameState): string[] {
  try {
    return validateTileInstanceRegions(state);
  } catch (error) {
    return [`实例区域校验异常：${error instanceof Error ? error.message : '未知错误'}`];
  }
}

function check(id: string, label: string, passed: boolean, detail: string): InvariantCheck {
  return { id, label, passed, detail };
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isPlayerId(value: unknown): value is PlayerId {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 3;
}

function isTile(value: unknown): value is Tile {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.id)
    && value.id >= 0
    && value.id <= 33
    && typeof value.instanceId === 'string'
    && typeof value.red === 'boolean'
    && typeof value.suit === 'string'
    && Number.isFinite(value.rank);
}

function sanitizeScenarioId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

const VALID_PHASES = new Set<GameState['phase']>([
  'draw',
  'discard',
  'ron-window',
  'call-window',
  'kakan-declaration',
  'chankan-window',
  'rinshan-draw',
  'round-ended',
  'exhaustive-draw',
]);
