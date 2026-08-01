import { canAnkan, evaluateRiichiAnkanWaits, getLegalAnkanCandidates } from '../kanChecker';
import { getDrawActionState } from '../interaction';
import type { GameState, Tile, TileId } from '../types';
import { getBuiltInTestScenario } from './builtInScenarios';
import { cloneTestScenario, scenarioFromGameState } from './scenario';
import { TEST_CASE_DEFINITION_VERSION, type PlayableTestCase } from './types';

export const STAB006_TEST_CASE_IDS = [
  'STAB-006-ANKAN-WAIT-UNCHANGED',
  'STAB-006-ANKAN-WAIT-CHANGED',
  'STAB-006-DRAWN-TILE-IN-QUAD',
  'STAB-006-NO-LEGAL-ANKAN',
] as const;

export function getStab006TestCases(): PlayableTestCase[] {
  return [
    buildCase(STAB006_TEST_CASE_IDS[0], '等待保持，可暗杠', 0, [0, 0, 0, 0, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31], 3, true),
    buildCase(STAB006_TEST_CASE_IDS[1], '等待改变，禁止暗杠', 0, [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8], 3, false),
    buildCase(STAB006_TEST_CASE_IDS[2], '摸入牌属于四张之一', 27, [27, 27, 27, 27, 0, 1, 2, 9, 10, 11, 18, 19, 20, 31], 3, true),
    buildCase(STAB006_TEST_CASE_IDS[3], '没有合法暗杠', null, [0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27, 31], 13, false),
  ];
}

function buildCase(
  id: string,
  name: string,
  candidateTileId: TileId | null,
  handIds: TileId[],
  drawnIndex: number,
  expectedLegal: boolean,
): PlayableTestCase {
  const base = cloneTestScenario(getBuiltInTestScenario('STAB-001-ANKAN')!);
  const state = prepareRiichiState(base.gameState, handIds, drawnIndex, id);
  const sharedIds = getLegalAnkanCandidates(state, 0).map((candidate) => candidate.tileId);
  const uiIds = getDrawActionState(state, 0).ankanCandidates.map((candidate) => candidate.tileId);
  if (candidateTileId === null ? sharedIds.length !== 0 : sharedIds.includes(candidateTileId) !== expectedLegal) {
    throw new Error(`${id}: shared ankan result does not match fixture expectation`);
  }
  if (uiIds.join(',') !== sharedIds.join(',')) throw new Error(`${id}: UI candidates differ from shared candidates`);

  const scenario = scenarioFromGameState({
    id,
    name: `STAB-006 ${name}`,
    description: '立直暗杠的等待保持、UI候选、AI候选与底层执行使用同一共享判定。',
    relatedAuditId: 'STAB-006',
    ruleConfig: base.ruleConfig,
    handNumber: base.handNumber,
    gameState: state,
    manualPlayerIds: [0, 1, 2, 3],
    initialTotalPoints: base.initialTotalPoints,
    instructions: [
      '打开调试面板，核对杠前等待、移除四张后的等待和共享判定结果。',
      `核对UI候选与底层canAnkan完全一致，预期${expectedLegal ? '允许' : '禁止'}暗杠。`,
      expectedLegal ? '点击暗杠并确认正式引擎成功推进到岭上摸牌。' : '确认牌桌不显示暗杠按钮，状态保持不变。',
    ],
  });
  const evaluation = candidateTileId === null ? null : evaluateRiichiAnkanWaits(state, 0, candidateTileId);
  return {
    version: TEST_CASE_DEFINITION_VERSION,
    id,
    name: scenario.name,
    description: scenario.description,
    relatedAuditId: 'STAB-006',
    category: 'game-rules',
    kind: 'playable',
    scenario,
    expectedResults: [
      `UI暗杠候选：${sharedIds.join(',') || '无'}`,
      `底层canAnkan：${candidateTileId === null ? false : canAnkan(state, 0, candidateTileId)}`,
      evaluation ? `杠前等待${evaluation.beforeWaits.join(',')}；移除四张后等待${evaluation.afterWaits.join(',')}` : '没有四张同牌候选',
    ],
    manualSteps: [...scenario.instructions],
    tags: ['STAB-006', '立直', '暗杠', '等待保持', '确定性'],
  };
}

function prepareRiichiState(source: GameState, desiredHandIds: TileId[], drawnIndex: number, scenarioId: string): GameState {
  const state = rewriteHandFaces(source, desiredHandIds);
  const renamed = JSON.parse(JSON.stringify(state).split('STAB-001-ANKAN').join(scenarioId)) as GameState;
  const hand = renamed.players[0].hand;
  renamed.currentPlayer = 0;
  renamed.phase = 'discard';
  renamed.players[0] = {
    ...renamed.players[0],
    hand,
    drawnTile: hand[drawnIndex],
    riichi: true,
    riichiState: { declaredAtTurn: 1, ippatsuAvailable: true, kind: 'riichi' },
  };
  return renamed;
}

function rewriteHandFaces(source: GameState, desiredHandIds: TileId[]): GameState {
  const state = JSON.parse(JSON.stringify(source)) as GameState;
  if (state.players[0].hand.length !== desiredHandIds.length) throw new Error('STAB-006 fixture requires a 14-tile hand');
  const physical = uniquePhysicalTiles(state);
  const faces = new Map(physical.map((tile) => [tile.instanceId, faceOf(tile)]));
  const locked = new Set<string>();
  state.players[0].hand.forEach((handTile, index) => {
    const targetId = desiredHandIds[index];
    const currentFace = faces.get(handTile.instanceId)!;
    if (currentFace.id !== targetId) {
      const donor = physical.find((tile) => !locked.has(tile.instanceId) && tile.instanceId !== handTile.instanceId && faces.get(tile.instanceId)?.id === targetId);
      if (!donor) throw new Error(`STAB-006 fixture cannot source tile.id=${targetId}`);
      const donorFace = faces.get(donor.instanceId)!;
      faces.set(handTile.instanceId, donorFace);
      faces.set(donor.instanceId, currentFace);
    }
    locked.add(handTile.instanceId);
  });
  return mapAllTileReferences(state, (tile) => ({ ...tile, ...faces.get(tile.instanceId)! }));
}

function faceOf(tile: Tile): Pick<Tile, 'id' | 'suit' | 'rank' | 'red'> {
  return { id: tile.id, suit: tile.suit, rank: tile.rank, red: tile.red };
}

function uniquePhysicalTiles(state: GameState): Tile[] {
  const byInstance = new Map<string, Tile>();
  const add = (tile: Tile) => byInstance.set(tile.instanceId, tile);
  state.players.forEach((player) => {
    player.hand.forEach(add);
    player.river.forEach(add);
    player.calls.forEach((call) => call.tiles.forEach(add));
  });
  state.wall.forEach(add);
  state.deadWall.forEach(add);
  return [...byInstance.values()];
}

function mapAllTileReferences(state: GameState, mapTile: (tile: Tile) => Tile): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      hand: player.hand.map(mapTile),
      river: player.river.map(mapTile),
      calls: player.calls.map((call) => ({ ...call, tiles: call.tiles.map(mapTile), calledTile: call.calledTile ? mapTile(call.calledTile) : undefined })),
      drawnTile: player.drawnTile ? mapTile(player.drawnTile) : null,
    })),
    wall: state.wall.map(mapTile),
    deadWall: state.deadWall.map(mapTile),
    doraIndicators: state.doraIndicators.map(mapTile),
    lastDiscard: state.lastDiscard ? { ...state.lastDiscard, tile: mapTile(state.lastDiscard.tile) } : null,
    pendingCall: state.pendingCall ? { ...state.pendingCall, tile: mapTile(state.pendingCall.tile) } : null,
    pendingRon: state.pendingRon ? { ...state.pendingRon, tile: mapTile(state.pendingRon.tile) } : null,
    pendingKakan: state.pendingKakan ? { ...state.pendingKakan, addedTile: mapTile(state.pendingKakan.addedTile) } : null,
  };
}
