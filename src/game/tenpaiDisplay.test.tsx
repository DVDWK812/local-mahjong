import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameScreen } from '../components/game/GameScreen';
import { TenpaiWaitPanel } from '../components/TenpaiWaitPanel';
import { buildTenpaiDisplay, countVisibleRemainingTiles, getCurrentWaits } from './tenpaiDisplay';
import { createInitialGameState } from './engine';
import { getFuritenState } from './furiten';
import { createSeededRandomSource } from './randomSource';
import type { CallSet, GameState, PlayerState, Tile, TileId } from './types';
import { getTileRank, getTileSuit } from './tileUtils';
import { canRon } from './winChecker';

let tileSeq = 0;

function tile(id: TileId, options: Partial<Tile> = {}): Tile {
  tileSeq += 1;
  return {
    id,
    suit: getTileSuit(id),
    rank: getTileRank(id),
    red: false,
    instanceId: `tenpai-test-${id}-${tileSeq}`,
    ...options,
  };
}

function tiles(ids: TileId[]): Tile[] {
  return ids.map((id) => tile(id));
}

function withPlayer(partial: Partial<PlayerState>, statePatch: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(createSeededRandomSource('tenpai-display-test-state'));
  return {
    ...base,
    currentPlayer: 1,
    phase: 'draw',
    result: null,
    pendingCall: null,
    pendingRon: null,
    pendingKakan: null,
    ...statePatch,
    players: base.players.map((player) => (player.id === 0 ? { ...player, drawnTile: null, calls: [], river: [], ...partial } : player)),
  };
}

function waitIds(state: GameState): TileId[] {
  return getCurrentWaits(state, 0).sort((a, b) => a - b);
}

const ryanmenHand: TileId[] = [0, 1, 2, 9, 10, 11, 18, 19, 20, 31, 31, 3, 4];
const noYakuAndEastWaitHand: TileId[] = [9, 10, 11, 3, 4, 5, 23, 23, 27, 27];

function openMixedWaitState(
  playerPatch: Partial<PlayerState> = {},
  statePatch: Partial<GameState> = {},
): GameState {
  const call: CallSet = {
    type: 'chi',
    tiles: tiles([0, 1, 2]),
    from: 3,
    opened: true,
    sequence: [0, 1, 2],
    calledTile: tile(0),
    usedTileIds: [1, 2],
  };
  return withPlayer({
    hand: tiles(noYakuAndEastWaitHand),
    calls: [call],
    ...playerPatch,
  }, statePatch);
}

describe('听牌及可见剩余量提示数据', () => {
  it('普通多面听显示全部等待', () => {
    expect(waitIds(withPlayer({ hand: tiles(ryanmenHand) }))).toEqual([2, 5]);
  });

  it('单骑、边张、嵌张等待正确', () => {
    expect(waitIds(withPlayer({ hand: tiles([0, 1, 2, 9, 10, 11, 18, 19, 20, 24, 25, 26, 31]) }))).toEqual([31]);
    expect(waitIds(withPlayer({ hand: tiles([0, 1, 9, 10, 11, 18, 19, 20, 24, 25, 26, 31, 31]) }))).toEqual([2]);
    expect(waitIds(withPlayer({ hand: tiles([0, 2, 9, 10, 11, 18, 19, 20, 24, 25, 26, 31, 31]) }))).toEqual([1]);
  });

  it('七对子等待正确', () => {
    expect(waitIds(withPlayer({ hand: tiles([0, 0, 1, 1, 2, 2, 9, 9, 10, 10, 18, 18, 31]) }))).toEqual([31]);
  });

  it('国士无双十三面和单骑等待正确', () => {
    const orphans: TileId[] = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    expect(waitIds(withPlayer({ hand: tiles(orphans) }))).toEqual(orphans);
    expect(waitIds(withPlayer({ hand: tiles([0, 0, 8, 9, 17, 18, 27, 28, 29, 30, 31, 32, 33]) }))).toEqual([26]);
  });

  it('副露手牌等待正确', () => {
    const call: CallSet = { type: 'chi', tiles: tiles([0, 1, 2]), from: 3, opened: true, sequence: [0, 1, 2], calledTile: tile(0), usedTileIds: [1, 2] };
    expect(waitIds(withPlayer({ hand: tiles([9, 10, 11, 18, 19, 20, 31, 31, 3, 4]), calls: [call] }))).toEqual([2, 5]);
  });

  it('赤五与普通五合并统计', () => {
    const state = withPlayer({
      hand: [tile(4, { red: true }), tile(4)],
      river: [tile(4)],
    }, { doraIndicators: [tile(4)] });
    expect(countVisibleRemainingTiles(state, 4, 0)).toBe(0);
  });

  it('已鸣弃牌不会重复扣减', () => {
    const called = tile(4, { claimed: true, claimedBy: 0 });
    const call: CallSet = { type: 'pon', tiles: [called, tile(4), tile(4)], from: 1, opened: true, calledTile: called };
    const state = withPlayer({ hand: [], calls: [call] });
    state.players[1] = { ...state.players[1], river: [called] };
    expect(countVisibleRemainingTiles(state, 4, 0)).toBe(1);
  });

  it('对手暗牌不会影响剩余量', () => {
    const state = withPlayer({ hand: [] });
    state.players[1] = { ...state.players[1], hand: tiles([4, 4, 4, 4]) };
    expect(countVisibleRemainingTiles(state, 4, 0)).toBe(4);
  });

  it('宝牌指示牌会扣减可见剩余量', () => {
    expect(countVisibleRemainingTiles(withPlayer({ hand: [] }, { doraIndicators: [tile(4)] }), 4, 0)).toBe(3);
  });

  it('0枚等待仍显示', () => {
    const state = withPlayer({ hand: tiles(ryanmenHand), river: [tile(2), tile(2), tile(2)] }, { doraIndicators: [tile(2)] });
    const display = buildTenpaiDisplay(state, 0);
    expect(display?.waits.find((wait) => wait.id === 2)?.remaining).toBe(0);
  });

  it('振听标记正确', () => {
    const state = withPlayer({ hand: tiles(ryanmenHand), river: [tile(2)] });
    const display = buildTenpaiDisplay(state, 0);
    expect(display?.waits.find((wait) => wait.id === 2)?.furiten).toBe(true);
  });

  it('正式计分将六索标为无役，役牌东风保持可和', () => {
    const display = buildTenpaiDisplay(openMixedWaitState(), 0);
    expect(display?.waits.map((wait) => wait.id)).toEqual([23, 27]);
    expect(display?.waits.find((wait) => wait.id === 23)?.status).toBe('no-yaku');
    expect(display?.waits.find((wait) => wait.id === 27)?.status).toBe('winnable');
    expect(renderToStaticMarkup(<TenpaiWaitPanel display={display} />)).toContain('无役');
  });

  it('舍牌或同巡振听覆盖全部可和等待，立直后显示永久振听', () => {
    const discardFuriten = buildTenpaiDisplay(openMixedWaitState({ river: [tile(27)] }), 0);
    expect(discardFuriten?.currentFuritenLabel).toBe('当前振听');
    expect(discardFuriten?.waits.find((wait) => wait.id === 27)?.status).toBe('furiten');
    expect(discardFuriten?.waits.find((wait) => wait.id === 23)?.status).toBe('no-yaku');

    const temporary = buildTenpaiDisplay(openMixedWaitState({
      furitenState: { temporaryFuriten: true, riichiPermanentFuriten: false },
    }), 0);
    expect(temporary?.waits.find((wait) => wait.id === 27)?.status).toBe('furiten');

    const permanent = buildTenpaiDisplay(openMixedWaitState({
      riichi: true,
      riichiState: { declaredAtTurn: 1, ippatsuAvailable: false, kind: 'riichi' },
      furitenState: { temporaryFuriten: false, riichiPermanentFuriten: true },
    }), 0);
    expect(permanent?.currentFuritenLabel).toBe('永久振听');
    expect(permanent?.waits.find((wait) => wait.id === 27)?.status).toBe('permanent-furiten');
    expect(renderToStaticMarkup(<TenpaiWaitPanel display={permanent} />)).toContain('永久振听');

    const riichiDiscardFuriten = buildTenpaiDisplay(openMixedWaitState({
      river: [tile(27)],
      riichi: true,
      riichiState: { declaredAtTurn: 1, ippatsuAvailable: false, kind: 'riichi' },
    }), 0);
    expect(riichiDiscardFuriten?.currentFuritenLabel).toBe('永久振听');
    expect(riichiDiscardFuriten?.waits.find((wait) => wait.id === 27)?.status).toBe('permanent-furiten');
  });

  it('悬停模拟打出可弃牌后显示听牌，离开后仍以实际手牌重新计算', () => {
    const extra = tile(8);
    const state = openMixedWaitState(
      { hand: [...tiles(noYakuAndEastWaitHand), extra], drawnTile: extra },
      { currentPlayer: 0, phase: 'discard' },
    );
    expect(buildTenpaiDisplay(state, 0)).toBeNull();
    const preview = buildTenpaiDisplay(state, 0, extra.instanceId);
    expect(preview?.previewDiscardLabel).toBe('9万');
    expect(preview?.waits.map((wait) => wait.id)).toEqual([23, 27]);
    expect(buildTenpaiDisplay(state, 0)).toBeNull();
  });

  it('无役牌不会进入正式荣和候选，也不会产生振听', () => {
    const state = openMixedWaitState();
    expect(canRon(state, 1, tile(23), { candidatePlayers: [0] })).toHaveLength(0);
    expect(getFuritenState(state, 0).temporaryFuriten).toBe(false);
    expect(getFuritenState(state, 0).riichiPermanentFuriten).toBe(false);
  });

  it('手牌不再听牌、摸入第14张、和牌流局或新局时提示消失', () => {
    expect(buildTenpaiDisplay(withPlayer({ hand: tiles([0, 1, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22, 24]) }), 0)).toBeNull();
    expect(buildTenpaiDisplay(withPlayer({ hand: tiles([...ryanmenHand, 2]), drawnTile: tile(2) }, { currentPlayer: 0, phase: 'discard' }), 0)).toBeNull();
    expect(buildTenpaiDisplay(withPlayer({ hand: tiles(ryanmenHand) }, { phase: 'round-ended' }), 0)).toBeNull();
    expect(buildTenpaiDisplay(createInitialGameState(createSeededRandomSource('tenpai-display-test-state')), 0)).toBeNull();
  });

  it('关闭设置后不显示，且显示功能不改变牌局状态', () => {
    const state = withPlayer({ hand: tiles(ryanmenHand) });
    const before = JSON.stringify(state);
    const html = renderToStaticMarkup(
      <GameScreen
        gameState={state}
        analysisOpen={false}
        canDiscard={false}
        onToggleAnalysis={() => undefined}
        onCloseAnalysis={() => undefined}
        onReturnMenu={() => undefined}
        onDiscard={() => undefined}
        onReset={() => undefined}
        showTenpaiWaitsEnabled={false}
      />,
    );
    expect(html).not.toContain('听牌与剩余量');
    expect(buildTenpaiDisplay(state, 0)).not.toBeNull();
    expect(JSON.stringify(state)).toBe(before);
  });
});
