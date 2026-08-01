import { executePon } from '../callChecker';
import { executeChi } from '../chiChecker';
import { executeKan } from '../kanChecker';
import type { GameState, Tile, TileId } from '../types';
import { sortTiles } from '../tileUtils';
import { getVisibleTileCounts } from '../visibility';
import { getBuiltInTestScenario } from './builtInScenarios';
import { cloneTestScenario, scenarioFromGameState } from './scenario';
import { TEST_CASE_DEFINITION_VERSION, type PlayableTestCase, type TestScenarioV1 } from './types';

export const STAB004_TEST_CASE_IDS = [
  'STAB-004-CHI-VISIBLE-COUNT',
  'STAB-004-PON-VISIBLE-COUNT',
  'STAB-004-MINKAN-VISIBLE-COUNT',
  'STAB-004-RED-FIVE-COUNT',
] as const;

export function getStab004TestCases(): PlayableTestCase[] {
  return [
    buildCase(STAB004_TEST_CASE_IDS[0], '吃牌公开计数', buildChiState(), 10, 1),
    buildCase(STAB004_TEST_CASE_IDS[1], '碰牌公开计数', buildPonState(false), 5, 3),
    buildCase(STAB004_TEST_CASE_IDS[2], '大明杠公开计数', buildMinkanState(), 5, 4),
    buildCase(STAB004_TEST_CASE_IDS[3], '赤五与普通五计数', buildPonState(true), 4, 3),
  ];
}

function buildCase(id: string, name: string, state: GameState, tileId: TileId, expectedVisible: number): PlayableTestCase {
  const renamedState = renameScenarioInstances(state, id);
  const scenario = scenarioFromGameState({
    id,
    name: `STAB-004 ${name}`,
    description: '保留claimed牌河历史，同时按物理实例去重统计公开牌。',
    relatedAuditId: 'STAB-004',
    ruleConfig: cloneTestScenario(getBuiltInTestScenario('STAB-001-MINKAN')!).ruleConfig,
    handNumber: 1,
    gameState: renamedState,
    manualPlayerIds: [0, 1, 2, 3],
    initialTotalPoints: 100000,
    instructions: [
      '打开调试面板的可见牌统计表。',
      `找到tile.id=${tileId}并核对唯一公开实例、来源区域、visibleCount=${expectedVisible}。`,
      `确认remainingCount=${4 - expectedVisible}，claimed牌河与副露均列为同一实例的来源。`,
    ],
  });
  const count = getVisibleTileCounts(scenario.gameState, 0).find((entry) => entry.id === tileId)!;
  if (count.visible !== expectedVisible) throw new Error(`${id}: expected visible=${expectedVisible}, got ${count.visible}`);
  return {
    version: TEST_CASE_DEFINITION_VERSION,
    id,
    name: scenario.name,
    description: scenario.description,
    relatedAuditId: 'STAB-004',
    category: 'game-rules',
    kind: 'playable',
    scenario,
    expectedResults: [
      `tile.id=${tileId}的visibleCount为${expectedVisible}`,
      `remainingCount为${4 - expectedVisible}且不小于0`,
      'claimed牌河与副露中的同一instanceId只计一次，但同时保留两个来源区域',
    ],
    manualSteps: [...scenario.instructions],
    tags: ['STAB-004', '可见牌', 'instanceId', '确定性', '人工'],
  };
}

function baseMinkanScenario(): TestScenarioV1 {
  return cloneTestScenario(getBuiltInTestScenario('STAB-001-MINKAN')!);
}

function buildPonState(useRedFive: boolean): GameState {
  const scenario = baseMinkanScenario();
  let state = scenario.gameState;
  if (useRedFive) state = swapTileTypes(state, 4, 5);
  state = limitPonHandToTwo(state, useRedFive ? 4 : 5);
  state.pendingCall = state.pendingCall ? {
    ...state.pendingCall,
    options: [{ type: 'pon', player: 0 }],
  } : null;
  return executePon(state, 0);
}

function limitPonHandToTwo(state: GameState, tileId: TileId): GameState {
  const cloned = JSON.parse(JSON.stringify(state)) as GameState;
  const matching = cloned.players[0].hand.map((tile, index) => ({ tile, index })).filter((entry) => entry.tile.id === tileId);
  if (matching.length !== 3) throw new Error('STAB-004 pon fixture requires exactly three matching hand tiles');
  const wallIndex = cloned.wall.findIndex((tile) => tile.id !== tileId);
  if (wallIndex === -1) throw new Error('STAB-004 pon fixture cannot find a swap tile');
  const handIndex = matching[2].index;
  const handTile = cloned.players[0].hand[handIndex];
  cloned.players[0].hand[handIndex] = cloned.wall[wallIndex];
  cloned.wall[wallIndex] = handTile;
  cloned.players[0].hand.sort(sortTiles);
  return cloned;
}

function buildMinkanState(): GameState {
  return executeKan(baseMinkanScenario().gameState, 0, 'minkan');
}

function buildChiState(): GameState {
  const scenario = baseMinkanScenario();
  const state = scenario.gameState;
  const caller = state.players[0];
  const oldDiscard = state.players[1].river[0];
  const calledIndex = caller.hand.findIndex((tile) => tile.id === 10);
  if (calledIndex === -1 || !caller.hand.some((tile) => tile.id === 9) || !caller.hand.some((tile) => tile.id === 11)) {
    throw new Error('STAB-004 chi fixture cannot find 9-10-11 sequence');
  }
  const [called] = caller.hand.splice(calledIndex, 1);
  caller.hand.push(oldDiscard);
  caller.hand.sort(sortTiles);
  state.players[1].river = [];
  state.players[3].river = [called];
  state.lastDiscard = { player: 3, tile: called };
  state.pendingCall = {
    discarder: 3,
    tile: called,
    options: [{ type: 'chi', player: 0, sequence: [9, 10, 11], usedTileIds: [9, 11] }],
  };
  return executeChi(state, 0, 0);
}

function swapTileTypes(state: GameState, firstId: TileId, secondId: TileId): GameState {
  const cloned = JSON.parse(JSON.stringify(state)) as GameState;
  const physical = uniquePhysicalTiles(cloned);
  const first = physical.filter((tile) => tile.id === firstId);
  const second = physical.filter((tile) => tile.id === secondId);
  if (first.length !== 4 || second.length !== 4) throw new Error('STAB-004 red-five fixture requires four physical copies');
  const replacements = new Map<string, Tile>();
  second.forEach((tile, index) => replacements.set(tile.instanceId, first[index]));
  first.forEach((tile, index) => replacements.set(tile.instanceId, second[index]));
  const replace = (tile: Tile): Tile => replacements.get(tile.instanceId) ?? tile;
  cloned.players = cloned.players.map((player) => ({
    ...player,
    hand: player.hand.map(replace),
    river: player.river.map(replace),
    calls: player.calls.map((call) => ({ ...call, tiles: call.tiles.map(replace), calledTile: call.calledTile ? replace(call.calledTile) : undefined })),
    drawnTile: player.drawnTile ? replace(player.drawnTile) : null,
  }));
  cloned.wall = cloned.wall.map(replace);
  cloned.deadWall = cloned.deadWall.map(replace);
  cloned.doraIndicators = cloned.doraIndicators.map(replace);
  cloned.lastDiscard = cloned.lastDiscard ? { ...cloned.lastDiscard, tile: replace(cloned.lastDiscard.tile) } : null;
  cloned.pendingCall = cloned.pendingCall ? { ...cloned.pendingCall, tile: replace(cloned.pendingCall.tile) } : null;
  return cloned;
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

function renameScenarioInstances(state: GameState, scenarioId: string): GameState {
  return JSON.parse(JSON.stringify(state).split('STAB-001-MINKAN').join(scenarioId)) as GameState;
}
