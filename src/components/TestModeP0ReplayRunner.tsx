import { buildReplayState, type BuiltReplayState } from '../game/replay/roundReplay';
import type { PlayerId } from '../game/types';
import { P0_REPLAY_RUNNER_IDS } from '../game/testMode/p0RegressionCases';
import type { ReplayTestCase } from '../game/testMode/types';
import { replayPublicTileInstanceIds } from './ReplayWallPanel';

export const p0ReplayRunners: Record<string, (testCase: ReplayTestCase) => string[]> = {
  [P0_REPLAY_RUNNER_IDS.hiddenDraw]: runHiddenDraw,
  [P0_REPLAY_RUNNER_IDS.publicAfterDiscard]: runPublicAfterDiscard,
  [P0_REPLAY_RUNNER_IDS.callPublic]: runCallPublic,
  [P0_REPLAY_RUNNER_IDS.cameraSwitch]: runCameraSwitch,
  [P0_REPLAY_RUNNER_IDS.fullOpen]: runFullOpen,
};

function runHiddenDraw(testCase: ReplayTestCase): string[] {
  const state = replayState(testCase, 0, 1);
  const instanceId = state.wall.drawnLiveTiles[0]?.instanceId;
  if (!instanceId) throw new Error('未找到对手已摸走的活牌实例');
  if (replayPublicTileInstanceIds(state.gameState).has(instanceId)) throw new Error(`暗摸实例${instanceId}被错误加入公开集合`);
  if (visibleWallInstanceIds(state, 0, false).has(instanceId)) throw new Error(`暗摸实例${instanceId}在玩家1普通视角获得正面权限`);
  return [`${instanceId}已消费但不公开`, '普通视角渲染为牌背'];
}

function runPublicAfterDiscard(testCase: ReplayTestCase): string[] {
  const state = replayState(testCase, 0, 2);
  const actualId = state.wall.drawnLiveTiles[0]?.instanceId;
  const sameTypeId = state.gameState.players[0].hand[0]?.instanceId;
  const publicIds = replayPublicTileInstanceIds(state.gameState);
  if (!actualId || !publicIds.has(actualId)) throw new Error('实际弃牌instanceId未进入公开集合');
  if (sameTypeId && publicIds.has(sameTypeId)) throw new Error(`同牌型未公开实例${sameTypeId}被错误公开`);
  if (!visibleWallInstanceIds(state, 0, false).has(actualId)) throw new Error(`实际弃牌实例${actualId}未获得正面权限`);
  return [`公开实际实例=${actualId}`, `同牌型实例=${sameTypeId}未获得公开权限`];
}

function runCallPublic(testCase: ReplayTestCase): string[] {
  const labels = ['吃', '碰', '大明杠'];
  return labels.map((label, roundIndex) => {
    const state = replayState(testCase, roundIndex, 3);
    const call = state.gameState.players[1].calls[0];
    const consumed = state.wall.drawnLiveTiles[0];
    if (!call || !consumed || !call.tiles.some((tile) => tile.instanceId === consumed.instanceId)) throw new Error(`${label}副露未引用已消费实例`);
    const publicIds = replayPublicTileInstanceIds(state.gameState);
    const missing = call.tiles.filter((tile) => !publicIds.has(tile.instanceId));
    if (missing.length > 0) throw new Error(`${label}副露实例未全部公开：${missing.map((tile) => tile.instanceId).join(',')}`);
    if (!visibleWallInstanceIds(state, 0, false).has(consumed.instanceId)) throw new Error(`${label}的实际牌山实例未获得正面权限`);
    return `${label}公开${call.tiles.map((tile) => tile.instanceId).join(',')}`;
  });
}

function runCameraSwitch(testCase: ReplayTestCase): string[] {
  const state = replayState(testCase, 0, 1);
  const instanceId = state.wall.drawnLiveTiles[0]?.instanceId;
  const visibleByCamera = ([0, 1, 2, 3] as PlayerId[]).map((camera) => !!instanceId && visibleWallInstanceIds(state, camera, false).has(instanceId));
  if (JSON.stringify(visibleByCamera) !== JSON.stringify([false, true, false, false])) {
    throw new Error(`四家视角权限错误：${JSON.stringify(visibleByCamera)}`);
  }
  return [`四家正面权限=${JSON.stringify(visibleByCamera)}`, '仅当前持牌的玩家2自知该实例'];
}

function runFullOpen(testCase: ReplayTestCase): string[] {
  const state = replayState(testCase, 0, 1);
  const drawId = state.wall.drawnLiveTiles[0]?.instanceId;
  const futureId = state.wall.nextLiveTile?.instanceId;
  const before = visibleWallInstanceIds(state, 0, false);
  const opened = visibleWallInstanceIds(state, 0, true);
  const closed = visibleWallInstanceIds(state, 0, false);
  if (!drawId || !futureId || !opened.has(drawId) || !opened.has(futureId)) throw new Error('全牌公开未显示暗摸牌或未来活牌');
  if (JSON.stringify([...before]) !== JSON.stringify([...closed])) throw new Error('关闭全牌公开后未恢复原视角权限');
  if (before.has(drawId) || before.has(futureId)) throw new Error('普通视角在开关前已泄漏隐藏牌');
  return ['开启后暗摸牌与未来活牌均可见', '关闭后渲染结果与开启前完全一致'];
}

function replayState(testCase: ReplayTestCase, roundIndex: number, stepIndex: number): BuiltReplayState {
  const replay = testCase.replay;
  const round = replay?.log.rounds[roundIndex];
  if (!replay || !round) throw new Error(`用例${testCase.id}缺少第${roundIndex + 1}局完整牌谱`);
  return buildReplayState(round, stepIndex, {
    scores: round.initialScores ?? replay.log.initialScores,
    playerNames: replay.playerNames,
    ruleConfig: replay.log.ruleConfig,
  });
}

function visibleWallInstanceIds(state: BuiltReplayState, cameraPlayerId: PlayerId, allOpen: boolean): Set<string> {
  const allTiles = [...state.wall.originalLiveWall, ...state.wall.originalDeadWall];
  if (allOpen) return new Set(allTiles.map((tile) => tile.instanceId));
  const consumed = new Set([...state.wall.drawnLiveTiles, ...state.wall.drawnDeadTiles].map((tile) => tile.instanceId));
  const known = replayPublicTileInstanceIds(state.gameState);
  state.gameState.players[cameraPlayerId].hand.forEach((tile) => known.add(tile.instanceId));
  const publicDora = new Set(state.gameState.doraIndicators.map((tile) => tile.instanceId));
  return new Set(allTiles
    .filter((tile) => publicDora.has(tile.instanceId) || (consumed.has(tile.instanceId) && known.has(tile.instanceId)))
    .map((tile) => tile.instanceId));
}
