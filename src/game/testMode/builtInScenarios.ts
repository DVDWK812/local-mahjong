import { getRulePreset } from '../match/matchRules';
import type { CallSet, GameState, PlayerId, PlayerState, Tile, TileId } from '../types';
import { getTileRank, getTileSuit, sortTiles } from '../tileUtils';
import { DORA_INDICATOR_SLOT_INDICES, doraIndicatorSlots } from '../wall';
import { cloneTestScenario, scenarioFromGameState } from './scenario';
import type { TestScenarioCheckpoint, TestScenarioV1 } from './types';

export const BUILT_IN_TEST_SCENARIO_IDS = [
  'STAB-001-ANKAN',
  'STAB-001-MINKAN',
  'STAB-001-KAKAN',
  'STAB-001-FOUR-KANS',
  'UI-RIICHI-WAIT-PREVIEW',
] as const;

export function getBuiltInTestScenarios(): TestScenarioV1[] {
  return [buildAnkanScenario(), buildMinkanScenario(), buildKakanScenario(), buildFourKansScenario(), buildRiichiWaitPreviewScenario()].map(cloneTestScenario);
}

export function getBuiltInTestScenario(id: string): TestScenarioV1 | undefined {
  return getBuiltInTestScenarios().find((scenario) => scenario.id === id);
}

export function getChiihouExampleScenario(): TestScenarioV1 {
  const id = 'EXAMPLE-CHIIHOU';
  const builder = new StableTileBuilder(id);
  const hand1 = ([1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14] as TileId[])
    .map((tileId) => builder.take(tileId, 'player-1-hand'))
    .sort(sortTiles);
  const hand0 = fillHand(builder, 14, 'player-0-hand', 20).sort(sortTiles);
  const players = buildPlayers(builder, hand0, { hand1 });
  const state = baseState(builder, players, buildDeadWall(builder), { currentPlayer: 0, phase: 'discard' });
  state.players[0].drawnTile = hand0[hand0.length - 1];
  const winningTileIndex = state.wall.findIndex((tile) => tile.id === 14);
  const [winningTile] = state.wall.splice(winningTileIndex, 1);
  state.wall.unshift(winningTile);
  const scenario = createScenario(id, '地和 JSON 示例', '从庄家第一次弃牌前开始；无人鸣牌后，闲家第一次正常摸牌即可自摸。', state, [
    '庄家打出最右侧摸切牌。',
    '确认没有发生鸣牌，当前轮到玩家2摸牌。',
    '点击测试工具栏“摸牌”。',
    '确认玩家2的“自摸”按钮可用并点击。',
    '确认结果包含役满“地和”。',
  ]);
  scenario.relatedAuditId = 'YAKUMAN-CHIIHOU';
  return cloneTestScenario(scenario);
}

function buildAnkanScenario(): TestScenarioV1 {
  const id = 'STAB-001-ANKAN';
  const builder = new StableTileBuilder(id);
  const hand0 = [
    ...builder.takeMany(0, 4, 'player-0-hand'),
    ...fillHand(builder, 10, 'player-0-hand', 8),
  ].sort(sortTiles);
  const players = buildPlayers(builder, hand0);
  const deadWall = buildDeadWall(builder);
  const state = baseState(builder, players, deadWall, { currentPlayer: 0, phase: 'discard' });
  state.players[0].drawnTile = hand0[hand0.length - 1];
  const scenario = createScenario(id, 'STAB-001 暗杠', '玩家1当前可立即暗杠，验证第一张岭上牌、第二表宝槽和活牌墙缩短。', state, [
    '确认操作提示出现“暗杠”。',
    '执行玩家1的暗杠。',
    '核对岭上牌instanceId、原始王牌槽6的新表宝牌以及活牌墙减少1。',
    '导出生成牌谱并在回放相同步骤核对牌山状态。',
  ]);
  scenario.expectedCheckpoints = [kanCheckpoint('kan-1', state, deadWall, 0, '玩家1暗杠牌型0')];
  return scenario;
}

function buildMinkanScenario(): TestScenarioV1 {
  const id = 'STAB-001-MINKAN';
  const builder = new StableTileBuilder(id);
  const targetId: TileId = 5;
  const hand0 = [...builder.takeMany(targetId, 3, 'player-0-hand'), ...fillHand(builder, 10, 'player-0-hand', 9)].sort(sortTiles);
  const discarded = builder.take(targetId, 'player-1-river');
  const players = buildPlayers(builder, hand0, { player1Count: 13 });
  players[1].river = [discarded];
  const deadWall = buildDeadWall(builder);
  const state = baseState(builder, players, deadWall, { currentPlayer: 0, phase: 'call-window' });
  state.turn = 2;
  state.lastDiscard = { player: 1, tile: discarded };
  state.pendingCall = {
    discarder: 1,
    tile: discarded,
    options: [{ type: 'kan', kanType: 'minkan', player: 0 }],
  };
  state.playerDiscardCounts = [0, 1, 0, 0];
  const scenario = createScenario(id, 'STAB-001 明杠', '玩家2已弃出目标牌，玩家1处于可直接明杠的正式鸣牌窗口。', state, [
    '确认鸣牌窗口显示“明杠”。',
    '由玩家1执行明杠。',
    '核对被鸣弃牌保留claimed历史、第一张岭上牌和原始王牌槽6。',
    '核对活牌墙减少1并导出牌谱复查。',
  ]);
  scenario.expectedCheckpoints = [kanCheckpoint('kan-1', state, deadWall, 0, '玩家1对玩家2弃牌执行明杠')];
  return scenario;
}

function buildKakanScenario(): TestScenarioV1 {
  const id = 'STAB-001-KAKAN';
  const builder = new StableTileBuilder(id);
  const targetId: TileId = 7;
  const calledTile = builder.take(targetId, 'player-1-river');
  const ponTiles = [builder.take(targetId, 'player-0-pon'), builder.take(targetId, 'player-0-pon'), calledTile];
  const addedTile = builder.take(targetId, 'player-0-hand');
  const hand0 = [addedTile, ...fillHand(builder, 10, 'player-0-hand', 11)].sort(sortTiles);
  const players = buildPlayers(builder, hand0, { player1Count: 13 });
  const claimedHistory = { ...calledTile, claimed: true, claimedBy: 0 as const };
  players[1].river = [claimedHistory];
  const call: CallSet = {
    type: 'pon',
    tiles: ponTiles,
    from: 1,
    opened: true,
    calledTile,
  };
  players[0].calls = [call];
  players[0].drawnTile = addedTile;
  const deadWall = buildDeadWall(builder);
  const state = baseState(builder, players, deadWall, { currentPlayer: 0, phase: 'discard' });
  state.callsOccurred = true;
  state.firstTurnInterrupted = true;
  const scenario = createScenario(id, 'STAB-001 加杠', '玩家1已有碰牌副露，当前摸牌为同牌型第四张，可直接宣告加杠。', state, [
    '确认操作提示出现“加杠”。',
    '由玩家1执行加杠；若出现抢杠窗口，按场景状态选择跳过。',
    '核对碰副露升级为加杠、第一张岭上牌和原始王牌槽6。',
    '核对活牌墙减少1并导出牌谱复查。',
  ]);
  scenario.expectedCheckpoints = [kanCheckpoint('kan-1', state, deadWall, 0, '玩家1将牌型7的碰升级为加杠')];
  return scenario;
}

function buildFourKansScenario(): TestScenarioV1 {
  const id = 'STAB-001-FOUR-KANS';
  const builder = new StableTileBuilder(id);
  const hand0 = [
    ...builder.takeMany(27, 4, 'player-0-hand'),
    ...builder.takeMany(28, 3, 'player-0-hand'),
    ...builder.takeMany(29, 3, 'player-0-hand'),
    ...builder.takeMany(30, 3, 'player-0-hand'),
    builder.take(31, 'player-0-hand'),
  ].sort(sortTiles);
  const fixedRinshan = new Map<number, Tile>([
    [0, builder.take(28, 'dead-wall-slot-0')],
    [1, builder.take(29, 'dead-wall-slot-1')],
    [2, builder.take(30, 'dead-wall-slot-2')],
  ]);
  const players = buildPlayers(builder, hand0);
  const deadWall = buildDeadWall(builder, fixedRinshan);
  const state = baseState(builder, players, deadWall, { currentPlayer: 0, phase: 'discard' });
  state.players[0].drawnTile = hand0.find((tile) => tile.id === 31) ?? hand0[hand0.length - 1];
  const scenario = createScenario(id, 'STAB-001 连续四杠', '四次岭上摸牌依次补成下一组暗杠，固定顺序连续验证1至4次杠。', state, [
    '玩家1暗杠东；核对岭上槽0与原始表宝槽6。',
    '玩家1暗杠南；核对岭上槽1与原始表宝槽8。',
    '玩家1暗杠西；核对岭上槽2与原始表宝槽10。',
    '玩家1暗杠北；核对岭上槽3与原始表宝槽12。',
    '每一步核对活牌墙累计减少1，最后导出牌谱逐步复查。',
  ]);
  const kanNames = ['东', '南', '西', '北'];
  scenario.expectedCheckpoints = [0, 1, 2, 3].map((index) => kanCheckpoint(`kan-${index + 1}`, state, deadWall, index, `玩家1暗杠${kanNames[index]}`));
  return scenario;
}

function buildRiichiWaitPreviewScenario(): TestScenarioV1 {
  const id = 'UI-RIICHI-WAIT-PREVIEW';
  const builder = new StableTileBuilder(id);
  const hand0 = ([0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31] as TileId[])
    .map((tileId) => builder.take(tileId, 'player-0-hand'))
    .sort(sortTiles);
  const players = buildPlayers(builder, hand0);
  const state = baseState(builder, players, buildDeadWall(builder), { currentPlayer: 0, phase: 'discard' });
  state.players[0].drawnTile = hand0.find((tile) => tile.id === 31) ?? hand0[hand0.length - 1];
  const scenario = createScenario(
    id,
    '立直候选听牌预览',
    '玩家1处于可立直的弃牌阶段，用于检查每个立直候选的正式听牌与剩余枚数提示。',
    state,
    [
      '确认操作框显示多个立直弃牌候选。',
      '依次悬停不同候选，确认听牌与剩余枚数立即更新。',
      '移出候选后确认听牌提示清除。',
      '重新加载场景并点击候选，确认立直与弃牌流程保持不变。',
    ],
  );
  return scenario;
}

function createScenario(id: string, name: string, description: string, state: GameState, instructions: string[]): TestScenarioV1 {
  return scenarioFromGameState({
    id,
    name,
    description,
    relatedAuditId: 'STAB-001',
    ruleConfig: getRulePreset('east-round'),
    handNumber: 1,
    gameState: state,
    instructions,
    manualPlayerIds: [0, 1, 2, 3],
    initialTotalPoints: 100000,
  });
}

function kanCheckpoint(id: string, state: GameState, deadWall: Tile[], kanIndex: number, afterAction: string): TestScenarioCheckpoint {
  return {
    id,
    description: `第${kanIndex + 1}次杠后核对固定王牌槽位`,
    afterAction,
    expectedRinshanInstanceId: deadWall[kanIndex].instanceId,
    expectedDoraSlotIndex: DORA_INDICATOR_SLOT_INDICES[kanIndex + 1],
    expectedLiveWallRemaining: state.wall.length - kanIndex - 1,
  };
}

function baseState(
  builder: StableTileBuilder,
  players: PlayerState[],
  deadWall: Tile[],
  current: Pick<GameState, 'currentPlayer' | 'phase'>,
): GameState {
  const wall = builder.remainingTiles('live-wall');
  const rules = getRulePreset('east-round');
  return {
    roundWind: 'east',
    dealer: 0,
    honba: 0,
    riichiSticks: 0,
    wall,
    deadWall,
    doraIndicators: doraIndicatorSlots(deadWall).slice(0, 1),
    players,
    currentPlayer: current.currentPlayer,
    phase: current.phase,
    turn: 1,
    lastDiscard: null,
    result: null,
    pendingCall: null,
    pendingRon: null,
    pendingKakan: null,
    kanState: null,
    callsOccurred: false,
    firstTurnInterrupted: false,
    playerDrawCounts: [0, 0, 0, 0],
    playerDiscardCounts: [0, 0, 0, 0],
    lastDrawSource: 'initial-hand',
    lastWinSource: null,
    lastLiveWallDiscarder: null,
    pendingAbortiveDrawAfterFourthKan: false,
    kuikaeForbiddenTileIds: {},
    ruleConfig: rules.round,
    matchRuleConfig: rules.match,
  };
}

function buildPlayers(builder: StableTileBuilder, hand0: Tile[], options: { player1Count?: number; hand1?: Tile[] } = {}): PlayerState[] {
  const winds = ['east', 'south', 'west', 'north'] as const;
  return ([0, 1, 2, 3] as PlayerId[]).map((id) => ({
    id,
    name: `测试玩家${id + 1}`,
    seatWind: winds[id],
    score: 25000,
    hand: id === 0
      ? hand0
      : id === 1 && options.hand1
        ? options.hand1
        : fillHand(builder, id === 1 ? options.player1Count ?? 13 : 13, `player-${id}-hand`, id * 7).sort(sortTiles),
    river: [],
    calls: [],
    drawnTile: null,
    riichi: false,
    riichiState: null,
    furitenState: { temporaryFuriten: false, riichiPermanentFuriten: false },
    pendingRiichiSidewaysDiscard: false,
  }));
}

function buildDeadWall(builder: StableTileBuilder, fixed = new Map<number, Tile>()): Tile[] {
  const slots: Tile[] = [];
  for (let index = 0; index < 14; index += 1) {
    const fixedTile = fixed.get(index);
    slots.push(fixedTile ?? builder.takeNextAvailable(`dead-wall-slot-${index}`, index * 3));
  }
  return slots;
}

function fillHand(builder: StableTileBuilder, count: number, zone: string, offset: number): Tile[] {
  return Array.from({ length: count }, (_, index) => builder.takeNextAvailable(zone, offset + index));
}

class StableTileBuilder {
  private readonly counts = Array.from({ length: 34 }, () => 0);
  private readonly zoneCounts = new Map<string, number>();

  constructor(private readonly scenarioId: string) {}

  take(id: TileId, zone: string): Tile {
    const copyIndex = this.counts[id];
    if (copyIndex >= 4) throw new Error(`${this.scenarioId}: 牌型${id}超过四张`);
    this.counts[id] += 1;
    const zoneIndex = this.zoneCounts.get(zone) ?? 0;
    this.zoneCounts.set(zone, zoneIndex + 1);
    return {
      id,
      suit: getTileSuit(id),
      rank: getTileRank(id),
      red: (id === 4 || id === 13 || id === 22) && copyIndex === 0,
      instanceId: `${this.scenarioId}-${zone}-${zoneIndex}`,
    };
  }

  takeMany(id: TileId, count: number, zone: string): Tile[] {
    return Array.from({ length: count }, () => this.take(id, zone));
  }

  takeNextAvailable(zone: string, offset = 0): Tile {
    for (let step = 0; step < 34; step += 1) {
      const id = ((offset + step) % 34) as TileId;
      if (this.counts[id] < 4) return this.take(id, zone);
    }
    throw new Error(`${this.scenarioId}: 没有剩余牌实例`);
  }

  remainingTiles(zone: string): Tile[] {
    const tiles: Tile[] = [];
    for (let id = 0; id < 34; id += 1) {
      while (this.counts[id] < 4) tiles.push(this.take(id as TileId, zone));
    }
    return tiles;
  }
}
