import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildReplayState } from '../game/replay/roundReplay';
import { advancePlaybackStep } from '../game/replay/replayPlayback';
import type { RoundLog, TileSnapshot } from '../game/replay/types';
import { createTile } from '../game/tileUtils';
import type { CallSet, ExhaustiveDrawResult, PlayerId, TileId } from '../game/types';
import { getTileAltById } from '../game/tileAssets';
import { getReplaySeatMapping, ReplayResultStepDialog, replayStepPlan, ReplayTable, scoreDeltaSummary, selectCameraPlayer, toggleOpenHands, type ReplayPerspectiveState } from './ReplayScreen';
import { ReplayTopBar } from './ReplayTopBar';
import { currentDrawSeatLabel, ReplayWallPanel } from './ReplayWallPanel';

function tile(tileId: TileId, instanceId: string): TileSnapshot {
  return { tileId, instanceId, red: false };
}

function round(): RoundLog {
  const deadWall = Array.from({ length: 14 }, (_, index) => tile((19 + index) as TileId, `dead-${index}`));
  return {
    roundId: 'visibility',
    roundWind: 'east',
    handNumber: 1,
    dealer: 0,
    honba: 0,
    riichiSticks: 0,
    initialScores: [25000, 25000, 25000, 25000],
    initialHands: [
      [tile(8, 'player-0-secret')],
      [tile(0, 'player-1-own')],
      [tile(9, 'player-2-secret')],
      [tile(10, 'player-3-secret')],
    ],
    initialDoraIndicators: [deadWall[4]],
    liveWall: [tile(17, 'future-live')],
    deadWall,
    events: [],
  };
}

function privatePerspective(playerId: PlayerId): ReplayPerspectiveState {
  return {
    cameraPlayerId: playerId,
    isOpenHands: false,
  };
}

function opponentDrawRound(): RoundLog {
  const value = round();
  value.liveWall = [tile(17, 'opponent-draw'), tile(18, 'future-after-draw')];
  value.events = [
    {
      type: 'tile-drawn',
      eventId: 'draw-opponent',
      sequence: 1,
      roundId: value.roundId,
      actor: 1,
      tile: value.liveWall[0],
    },
    {
      type: 'tile-discarded',
      eventId: 'discard-opponent',
      sequence: 2,
      roundId: value.roundId,
      actor: 1,
      tile: value.liveWall[0],
    },
  ];
  return value;
}

function callRound(type: 'chi-declared' | 'pon-declared' | 'minkan-declared'): RoundLog {
  const value = round();
  const called = tile(3, `${type}-called`);
  const drawn = tile(type === 'chi-declared' ? 4 : 3, `${type}-drawn`);
  const companions = type === 'chi-declared'
    ? [tile(5, `${type}-hand-1`)]
    : [tile(3, `${type}-hand-1`), ...(type === 'minkan-declared' ? [tile(3, `${type}-hand-2`)] : [])];
  value.initialHands = [[called], companions, [], []];
  value.liveWall = [drawn, tile(18, `${type}-future`)];
  value.events = [
    {
      type: 'tile-drawn',
      eventId: `${type}-draw`,
      sequence: 1,
      roundId: value.roundId,
      actor: 1,
      tile: drawn,
    },
    {
      type: 'tile-discarded',
      eventId: `${type}-discard`,
      sequence: 2,
      roundId: value.roundId,
      actor: 0,
      tile: called,
    },
    {
      type,
      eventId: `${type}-call`,
      sequence: 3,
      roundId: value.roundId,
      actor: 1,
      from: 0,
      tiles: [called, drawn, ...companions],
    },
  ];
  return value;
}

function renderWall(state: ReturnType<typeof buildReplayState>, cameraPlayerId: PlayerId, allOpen = false): string {
  return renderToStaticMarkup(
    <ReplayWallPanel replayState={state} allOpen={allOpen} cameraPlayerId={cameraPlayerId} />,
  );
}

describe('ReplayScreen 视角边界', () => {
  const mahjongTableSource = readFileSync(resolve(process.cwd(), 'src/components/game/MahjongTable.tsx'), 'utf8');
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  function geometrySignature(html: string): string[] {
    return [...html.matchAll(/class="([^"]*(?:player-slot--|river-slot--|meld-slot--|center-score--)[^"]*)"/g)]
      .map((match) => match[1]
        .replace(/\s+(?:player-zone--current|center-score--current|center-score--dealer)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim());
  }

  it('局数下拉点数摘要使用相对局初分数的净变化和绝对值格式', () => {
    expect(scoreDeltaSummary(
      round(),
      [25000, 25000, 25000, 25000],
      [24000, 24500, 28000, 23500],
      ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    )).toBe('东家 Player 1 -1,000 / 南家 Player 2 -500 / 西家 Player 3 +3,000 / 北家 Player 4 -1,500');
  });

  it('完成局在真实动作后增加一个合成结果步骤，真实末步不弹窗且牌桌状态不变', () => {
    const result: ExhaustiveDrawResult = {
      type: 'exhaustive-draw',
      tenpaiPlayers: [],
      notenPlayers: [0, 1, 2, 3],
      scoreDeltas: [0, 0, 0, 0],
      pointDeltas: [0, 0, 0, 0],
      dealerContinues: false,
      honbaIncrement: 1,
      riichiSticksCarryOver: true,
    };
    const completed = { ...round(), result };
    const plan = replayStepPlan(completed);
    const lastRealState = buildReplayState(completed, plan.realLastStep);
    const resultStepState = buildReplayState(completed, Math.min(plan.replayLastStep, plan.realLastStep));
    expect(plan).toEqual({ realLastStep: 0, replayLastStep: 1, hasResultStep: true });
    expect(resultStepState).toEqual(lastRealState);
    const initialScores: [number, number, number, number] = [25000, 25000, 25000, 25000];
    expect(renderToStaticMarkup(<ReplayResultStepDialog visible={false} replayState={lastRealState} result={result} initialScores={initialScores} onClose={() => undefined} />)).toBe('');
    const dialog = renderToStaticMarkup(<ReplayResultStepDialog visible replayState={resultStepState} result={result} initialScores={initialScores} onClose={() => undefined} />);
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('返回牌桌');
    expect(advancePlaybackStep(plan.realLastStep, plan.replayLastStep)).toEqual({ stepIndex: plan.replayLastStep, playing: false });
  });

  it('未完成局不增加合成结果步骤', () => {
    expect(replayStepPlan(round())).toEqual({ realLastStep: 0, replayLastStep: 0, hasResultStep: false });
  });

  it('所有视角保持top、right、bottom、left四个固定槽位及DOM顺序', () => {
    const state = buildReplayState(round(), 0, { playerNames: ['甲', '乙', '丙', '丁'] });
    for (const cameraPlayerId of [0, 1, 2, 3] as PlayerId[]) {
      const html = renderToStaticMarkup(<ReplayTable replayState={state} perspective={privatePerspective(cameraPlayerId)} />);
      const slots = [...html.matchAll(/data-player-slot="(top|right|bottom|left)"/g)].map((match) => match[1]);
      expect(slots).toEqual(['top', 'right', 'bottom', 'left']);
      expect((html.match(/class="mahjong-table"/g) ?? [])).toHaveLength(1);
    }
  });

  it('切换相机或全牌公开只替换槽位数据，不改变几何类结构', () => {
    const state = buildReplayState(round(), 0, { playerNames: ['甲', '乙', '丙', '丁'] });
    const player1 = renderToStaticMarkup(<ReplayTable replayState={state} perspective={privatePerspective(0)} />);
    const player3 = renderToStaticMarkup(<ReplayTable replayState={state} perspective={privatePerspective(2)} />);
    const player3Open = renderToStaticMarkup(<ReplayTable replayState={state} perspective={{ ...privatePerspective(2), isOpenHands: true }} />);
    expect(geometrySignature(player3)).toEqual(geometrySignature(player1));
    expect(geometrySignature(player3Open)).toEqual(geometrySignature(player3));
    expect(player3).toContain('data-local-player="2"');
    expect(player3).toMatch(/data-player-slot="top"[^>]*data-player-index="0"/);
    expect(player3).toContain('river-slot--left');
    expect(player3).toContain('river-slot--right');
    expect(player3).toContain('hand-slot--top');
    expect(player3).toContain('hand-slot--bottom');
  });

  it('外层React key与布局类只使用固定槽位，回放不应用玩家ID位移规则', () => {
    expect(mahjongTableSource).toContain('key={position}');
    expect(mahjongTableSource).not.toContain('key={playerId}');
    expect(mahjongTableSource).toContain('key={`${position}-river`}');
    expect(css).not.toMatch(/(?<!\.game-screen )\.player-zone\[data-player-index=/);
    expect(css).not.toMatch(/\.replay-[^{]*\{[^}]*(?:rotate|scale)\(/s);
  });

  it('玩家1视角以Player1为bottom并按顺时针映射四家', () => {
    const state = buildReplayState(round(), 0, { playerNames: ['甲', '乙', '丙', '丁'] });
    const html = renderToStaticMarkup(<ReplayTable replayState={state} perspective={privatePerspective(0)} />);
    expect(getReplaySeatMapping(0)).toEqual({
      bottomPlayerId: 0,
      rightPlayerId: 1,
      topPlayerId: 2,
      leftPlayerId: 3,
    });
    expect(html).toContain('data-local-player="0"');
    expect(html).toMatch(/data-player-zone="east"[^>]*data-player-index="1"/);
    expect(html).toMatch(/data-player-zone="north"[^>]*data-player-index="2"/);
    expect(html).toMatch(/data-player-zone="west"[^>]*data-player-index="3"/);
  });

  it('玩家3视角把Player3旋转到底部、Player1旋转到顶部并同步头像名称', () => {
    const state = buildReplayState(round(), 0, { playerNames: ['甲', '乙', '丙', '丁'] });
    const html = renderToStaticMarkup(<ReplayTable replayState={state} perspective={privatePerspective(2)} />);
    expect(getReplaySeatMapping(2)).toEqual({
      bottomPlayerId: 2,
      rightPlayerId: 3,
      topPlayerId: 0,
      leftPlayerId: 1,
    });
    expect(html).toContain('data-local-player="2"');
    expect(html).toMatch(/data-player-zone="south"[^>]*data-player-index="2"/);
    expect(html).toMatch(/data-player-zone="east"[^>]*data-player-index="3"/);
    expect(html).toMatch(/data-player-zone="north"[^>]*data-player-index="0"/);
    expect(html).toMatch(/data-player-zone="west"[^>]*data-player-index="1"/);
    expect(html).toMatch(/class="local-hand-info"[\s\S]*title="丙"/);
  });

  it('普通玩家3视角只公开Player3手牌，顶部Player1显示牌背', () => {
    const state = buildReplayState(round(), 0, { playerNames: ['甲', '乙', '丙', '丁'] });
    const html = renderToStaticMarkup(<ReplayTable replayState={state} perspective={privatePerspective(2)} />);
    expect(html).toContain(getTileAltById(9));
    expect(html).not.toContain(getTileAltById(8));
    expect(html).not.toContain(getTileAltById(0));
    expect(html).not.toContain(getTileAltById(10));
    expect((html.match(/alt="牌背"/g) ?? []).length).toBeGreaterThan(0);
  });

  it('全牌公开显示四家手牌且玩家3仍位于bottom', () => {
    const state = buildReplayState(round(), 0, { playerNames: ['甲', '乙', '丙', '丁'] });
    const html = renderToStaticMarkup(<ReplayTable replayState={state} perspective={{ ...privatePerspective(2), isOpenHands: true }} />);
    expect(html).toContain('data-replay-view="player-3"');
    expect(html).toContain('data-open-hands="true"');
    expect(html).toContain(getTileAltById(8));
    expect(html).toContain(getTileAltById(0));
    expect(html).toContain(getTileAltById(9));
    expect(html).toContain(getTileAltById(10));
    expect(html).toContain('data-local-player="2"');
    expect(html).toMatch(/data-player-zone="north"[^>]*data-player-index="0"/);
  });

  it('cameraPlayerId与全牌公开完全独立，切换玩家不关闭公开状态', () => {
    const open = toggleOpenHands(privatePerspective(0));
    const player3 = selectCameraPlayer(open, 2);
    expect(player3).toEqual({ cameraPlayerId: 2, isOpenHands: true });
    expect(toggleOpenHands(player3)).toEqual({ cameraPlayerId: 2, isOpenHands: false });
  });

  it('顶栏可同时高亮玩家3和全牌公开', () => {
    const html = renderToStaticMarkup(
      <ReplayTopBar
        roundLabel="东1局"
        stepIndex={3}
        totalSteps={10}
        actionSummary="弃牌"
        playerNames={['甲', '乙', '丙', '丁']}
        cameraPlayerId={2}
        isOpenHands
        wallOpen={false}
        onBack={() => undefined}
        onPerspectiveChange={() => undefined}
        onToggleOpenHands={() => undefined}
        onToggleWall={() => undefined}
      />,
    );
    expect(html).toMatch(/class="is-active" aria-pressed="true" title="丙"[^>]*>玩家3<\/button>/);
    expect(html).toMatch(/class="replay-open-hands-toggle is-active" aria-pressed="true"[^>]*>全牌公开<\/button>/);
  });

  it('玩家3视角统一旋转牌河、副露、立直牌与中央计分板', () => {
    const state = buildReplayState(round(), 0, { playerNames: ['甲', '乙', '丙', '丁'] });
    state.gameState.players.forEach((player, playerId) => {
      player.river = [{ ...createTile(playerId as TileId, playerId), isRiichiDiscard: playerId === 0 }];
    });
    const calledTile = createTile(6, 0);
    const call: CallSet = {
      type: 'pon',
      tiles: [calledTile, createTile(6, 1), createTile(6, 2)],
      from: 2,
      opened: true,
      calledTile,
    };
    state.gameState.players[3].calls = [call];
    const html = renderToStaticMarkup(<ReplayTable replayState={state} perspective={privatePerspective(2)} />);
    expect(html).toMatch(/table-river-anchor--south" data-river-player="2"/);
    expect(html).toMatch(/table-river-anchor--east" data-river-player="3"/);
    expect(html).toMatch(/table-river-anchor--north" data-river-player="0"/);
    expect(html).toMatch(/table-river-anchor--west" data-river-player="1"/);
    expect(html).toMatch(/data-table-meld-zone="east" data-meld-player="3"/);
    expect(html).toContain('data-sideways="true"');
    expect(html).toContain('discard-river-tile--riichi');
    expect(html).toMatch(/center-score--north[^"]*"[^>]*data-center-slot="top"[^>]*data-center-player="0"/);
    expect(html).toMatch(/center-score--east[^"]*"[^>]*data-center-slot="right"[^>]*data-center-player="3"/);
    expect(html).toMatch(/center-score--south[^"]*"[^>]*data-center-slot="bottom"[^>]*data-center-player="2"/);
  });

  it('普通视角不泄露未来牌山和未公开里宝牌，全牌公开可查看', () => {
    const state = buildReplayState(round(), 0);
    const hidden = renderWall(state, 0);
    const open = renderWall(state, 0, true);
    expect(hidden).not.toContain('牌山剩余');
    expect(open).not.toContain('牌山剩余');
    expect(open).not.toContain('当前摸牌位置');
    expect(open).not.toContain('岭上牌剩余');
    expect(open).not.toContain('已摸走');
    expect(open).not.toContain('宝牌指示牌：');
    expect(hidden).not.toContain(getTileAltById(17));
    expect(hidden).not.toContain(getTileAltById(state.wall.originalDeadWall[5].id));
    expect(hidden).toContain('里宝牌保持牌背');
    expect(open).toContain(getTileAltById(17));
    expect(open).toContain(getTileAltById(state.wall.originalDeadWall[5].id));
    expect(open).not.toContain('里宝牌位置已公开');
  });

  it('缺少牌山时显示安全降级提示', () => {
    const missing = { ...round(), liveWall: undefined, deadWall: undefined };
    const state = buildReplayState(missing, 0);
    expect(renderToStaticMarkup(<ReplayWallPanel replayState={state} allOpen={false} cameraPlayerId={0} />)).toContain('该牌谱未记录完整牌山');
  });

  it('对手摸牌后弃牌前只标记已摸走但仍显示牌背', () => {
    const state = buildReplayState(opponentDrawRound(), 1);
    const html = renderWall(state, 0);
    expect(currentDrawSeatLabel(state)).toBe('南');
    expect(html).not.toContain('当前摸牌位置');
    expect(html).toContain('replay-wall-tile--drawn');
    expect(html).not.toContain(getTileAltById(17));
    expect(html).toContain('alt="牌背"');
    expect(html).not.toContain('replay-wall__consumed');
  });

  it('对手弃牌后对应已摸走实例才在牌山抽屉显示正面', () => {
    const state = buildReplayState(opponentDrawRound(), 2);
    expect(renderWall(state, 0)).toContain(getTileAltById(17));
  });

  it.each([
    ['吃', 'chi-declared'],
    ['碰', 'pon-declared'],
    ['大明杠', 'minkan-declared'],
  ] as const)('%s公开动作使副露中的已摸走实例可见', (_label, type) => {
    const state = buildReplayState(callRound(type), 3);
    const drawn = state.wall.drawnLiveTiles[0];
    expect(state.gameState.players[1].calls[0].tiles.some((entry) => entry.instanceId === drawn.instanceId)).toBe(true);
    expect(renderWall(state, 0)).toContain(getTileAltById(drawn.id));
  });

  it('公开同牌型的另一实例不会泄露对手暗摸实例', () => {
    const value = opponentDrawRound();
    value.initialHands![0] = [tile(17, 'public-same-type')];
    value.events = [
      value.events[0],
      {
        type: 'tile-discarded',
        eventId: 'discard-same-type-instance',
        sequence: 2,
        roundId: value.roundId,
        actor: 0,
        tile: value.initialHands![0][0],
      },
    ];
    const state = buildReplayState(value, 2);
    expect(state.gameState.players[0].river[0].instanceId).toBe('public-same-type');
    expect(state.wall.drawnLiveTiles[0].instanceId).toBe('opponent-draw');
    expect(renderWall(state, 0)).not.toContain(getTileAltById(17));
  });

  it('全牌公开允许查看对手暗摸牌与未来牌山', () => {
    const state = buildReplayState(opponentDrawRound(), 1);
    const html = renderWall(state, 0, true);
    expect(html).toContain(getTileAltById(17));
    expect(html).toContain(getTileAltById(18));
  });

  it('切换视角后按新的主视角重新计算暗摸牌权限', () => {
    const state = buildReplayState(opponentDrawRound(), 1);
    expect(renderWall(state, 0)).not.toContain(getTileAltById(17));
    expect(renderWall(state, 1)).toContain(getTileAltById(17));
    expect(renderWall(state, 2)).not.toContain(getTileAltById(17));
    expect(renderWall(state, 3)).not.toContain(getTileAltById(17));
  });

  it('前进、后退再前进时牌山公开状态可重复', () => {
    const value = opponentDrawRound();
    const beforeDiscard = renderWall(buildReplayState(value, 1), 0);
    const afterDiscard = renderWall(buildReplayState(value, 2), 0);
    const rebuiltBeforeDiscard = renderWall(buildReplayState(value, 1), 0);
    const rebuiltAfterDiscard = renderWall(buildReplayState(value, 2), 0);
    expect(beforeDiscard).toBe(rebuiltBeforeDiscard);
    expect(afterDiscard).toBe(rebuiltAfterDiscard);
    expect(beforeDiscard).not.toContain(getTileAltById(17));
    expect(afterDiscard).toContain(getTileAltById(17));
  });

  it('公开宝牌指示牌下方标注公开宝牌', () => {
    const state = buildReplayState(round(), 0);
    const html = renderToStaticMarkup(<ReplayWallPanel replayState={state} allOpen={false} cameraPlayerId={0} />);
    expect(html).toContain('<small>公开宝牌</small>');
  });
});
