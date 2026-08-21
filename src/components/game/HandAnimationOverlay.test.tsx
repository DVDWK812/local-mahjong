import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createTile } from '../../game/tileUtils';
import type { Tile } from '../../game/types';
import { DiscardRiver } from './DiscardRiver';
import { GameScreen } from './GameScreen';
import {
  createDiscardGeometry,
  createDrawGeometry,
  createMeldGeometry,
  createRiichiGeometry,
  spawnPointForSeat,
  visualSeatForPlayer,
  type VisualSeat,
} from './HandAnimationOverlay';

const noop = () => undefined;
const overlayRect = { left: 0, top: 0, width: 1000, height: 800 };

function expectSpawnOutsideOwnEdge(seat: VisualSeat, point: { x: number; y: number }) {
  if (seat === 'bottom') expect(point.y).toBeGreaterThan(overlayRect.height);
  if (seat === 'top') expect(point.y).toBeLessThan(0);
  if (seat === 'left') expect(point.x).toBeLessThan(0);
  if (seat === 'right') expect(point.x).toBeGreaterThan(overlayRect.width);
}

describe('HandAnimationOverlay', () => {
  it('作为非透视兄弟层位于 table/hand 之上且低于 operation overlay', () => {
    const html = renderToStaticMarkup(
      <GameScreen
        gameState={createInitialGameState()}
        analysisOpen={false}
        actionPrompt={<section>可执行操作</section>}
        canDiscard={false}
        onToggleAnalysis={noop}
        onCloseAnalysis={noop}
        onReturnMenu={noop}
        onDiscard={noop}
        onReset={noop}
      />,
    );
    const tableIndex = html.indexOf('class="mahjong-table"');
    const handIndex = html.indexOf('class="local-hand-area');
    const animationIndex = html.indexOf('class="hand-animation-overlay"');
    const promptIndex = html.indexOf('class="game-prompt-layer"');
    const css = readFileSync(resolve(process.cwd(), 'src/components/game/handAnimationOverlay.css'), 'utf8');

    expect(animationIndex).toBeGreaterThan(tableIndex);
    expect(animationIndex).toBeGreaterThan(handIndex);
    expect(promptIndex).toBeGreaterThan(animationIndex);
    expect(css).toMatch(/\.hand-animation-overlay\s*\{[^}]*position:\s*absolute;/s);
    expect(css).toMatch(/\.hand-animation-overlay\s*\{[^}]*pointer-events:\s*none;/s);
    expect(css).toContain('z-index: calc(var(--z-hand) + 1)');
  });

  it('按 tableBottomPlayerId 映射四方向，不假设 player 0 在底部', () => {
    expect([0, 1, 2, 3].map((playerId) => visualSeatForPlayer(playerId as 0 | 1 | 2 | 3, 2))).toEqual([
      'top',
      'left',
      'bottom',
      'right',
    ]);
  });

  it.each([
    ['bottom', { left: 100, top: 680, width: 700, height: 80 }],
    ['left', { left: 40, top: 100, width: 80, height: 600 }],
    ['top', { left: 200, top: 40, width: 700, height: 80 }],
    ['right', { left: 880, top: 100, width: 80, height: 600 }],
  ] as const)('%s draw 独立从本座位边缘直达 hand-right anchor', (seat, handRect) => {
    const geometry = createDrawGeometry(handRect, overlayRect, seat);
    expectSpawnOutsideOwnEdge(seat, geometry.entry);
    expect(geometry.source).toEqual(geometry.destination);
    if (seat === 'bottom') expect(geometry.destination.x).toBeGreaterThan(handRect.left + handRect.width / 2);
    if (seat === 'top') expect(geometry.destination.x).toBeLessThan(handRect.left + handRect.width / 2);
    if (seat === 'left') expect(geometry.destination.y).toBeGreaterThan(handRect.top + handRect.height / 2);
    if (seat === 'right') expect(geometry.destination.y).toBeLessThan(handRect.top + handRect.height / 2);
  });

  it.each(['bottom', 'left', 'top', 'right'] as const)('%s discard 从本座位 source 直达 river 并退回同一边缘', (seat) => {
    const sourceRect = { left: 100, top: 200, width: 60, height: 80 };
    const riverRect = { left: 450, top: 350, width: 50, height: 70 };
    const geometry = createDiscardGeometry(sourceRect, riverRect, overlayRect, seat);
    expectSpawnOutsideOwnEdge(seat, geometry.entry);
    expect(geometry.source).toEqual({ x: 130, y: 240 });
    expect(geometry.destination).toEqual({ x: 475, y: 385 });
  });

  it.each(['bottom', 'left', 'top', 'right'] as const)('%s riichi 从本座位手牌区直达本座位立直棒锚点', (seat) => {
    const handRect = { left: 100, top: 200, width: 240, height: 80 };
    const stickRect = { left: 460, top: 360, width: 96, height: 6 };
    const geometry = createRiichiGeometry(handRect, stickRect, overlayRect, seat);
    expectSpawnOutsideOwnEdge(seat, geometry.entry);
    expect(geometry.source).toEqual({ x: 220, y: 240 });
    expect(geometry.destination).toEqual({ x: 508, y: 363 });
    expect(geometry.source).not.toEqual(geometry.destination);
  });

  it.each(['bottom', 'left', 'top', 'right'] as const)('%s meld 从本座位边缘直达自己的 meld anchor 并退回同一边缘', (seat) => {
    const meldRect = { left: 420, top: 330, width: 160, height: 80 };
    const geometry = createMeldGeometry(meldRect, overlayRect, seat);
    expectSpawnOutsideOwnEdge(seat, geometry.entry);
    expect(geometry.source).toEqual({ x: 500, y: 370 });
    expect(geometry.destination).toEqual(geometry.source);
    expect(spawnPointForSeat(overlayRect, geometry.destination, seat)).toEqual(geometry.entry);
  });

  it('连续 bottom pon → top chi → right kan 均从各自边缘独立生成', () => {
    const bottom = createMeldGeometry({ left: 700, top: 650, width: 180, height: 70 }, overlayRect, 'bottom');
    const top = createMeldGeometry({ left: 200, top: 70, width: 180, height: 70 }, overlayRect, 'top');
    const right = createMeldGeometry({ left: 850, top: 220, width: 80, height: 180 }, overlayRect, 'right');
    expectSpawnOutsideOwnEdge('bottom', bottom.entry);
    expectSpawnOutsideOwnEdge('top', top.entry);
    expectSpawnOutsideOwnEdge('right', right.entry);
    expect(new Set([`${bottom.entry.x},${bottom.entry.y}`, `${top.entry.x},${top.entry.y}`, `${right.entry.x},${right.entry.y}`]).size).toBe(3);
  });

  it('连续不同座位动作各自创建 spawn，不继承上一动作终点', () => {
    const bottom = createDiscardGeometry(
      { left: 400, top: 680, width: 60, height: 80 },
      { left: 470, top: 500, width: 50, height: 70 },
      overlayRect,
      'bottom',
    );
    const right = createDrawGeometry({ left: 880, top: 100, width: 80, height: 600 }, overlayRect, 'right');
    expect(right.entry).toEqual(spawnPointForSeat(overlayRect, right.source, 'right'));
    expect(right.entry).not.toEqual(bottom.destination);
    expect(right.entry.x).toBeGreaterThan(overlayRect.width);
  });

  it('为真实河牌保留原始 riverIndex，使 claimed 过滤后仍能精确 mask', () => {
    const state = createInitialGameState();
    const claimed = { ...createTile(1, 1), claimed: true } as Tile;
    const visible = createTile(2, 2);
    const player = { ...state.players[0], river: [claimed, visible] };
    const html = renderToStaticMarkup(<DiscardRiver player={player} position="south" />);

    expect(html).toContain('data-river-index="1"');
    expect(html).not.toContain('data-river-index="0"');
  });

  it('Test Mode 显式关闭实时动画，Replay 不挂载 realtime consumer', () => {
    const testMode = readFileSync(resolve(process.cwd(), 'src/components/TestModeScreen.tsx'), 'utf8');
    const replay = readFileSync(resolve(process.cwd(), 'src/components/ReplayScreen.tsx'), 'utf8');
    expect(testMode).toContain('handAnimationsEnabled={false}');
    expect(replay).not.toContain('HandAnimationOverlay');
    expect(replay).not.toContain('HandAnimationConsumer');
  });

  it('reduced-motion 关闭 transition，overlay 不复制 UI-2 table transform', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/game/handAnimationOverlay.css'), 'utf8');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition:\s*none;/);
    expect(css).not.toContain('perspective(');
    expect(css).not.toContain('rotateX(');
  });

  it('captures local geometry before rules and masks the confirmed river before showing the visual', () => {
    const localHand = readFileSync(resolve(process.cwd(), 'src/components/game/LocalHandArea.tsx'), 'utf8');
    const overlay = readFileSync(resolve(process.cwd(), 'src/components/game/HandAnimationOverlay.tsx'), 'utf8');
    const observer = readFileSync(resolve(process.cwd(), 'src/presentation/gamePresentationEvents.ts'), 'utf8');

    expect(localHand.indexOf('onDiscardSourceCapture?.')).toBeLessThan(localHand.indexOf('onDiscard(player.id, tileInstanceId)'));
    expect(localHand).toContain('clearSourceSnapshot?.();');
    expect(localHand).toContain('scheduleSnapshotExpiry(clearSourceSnapshot)');
    expect(overlay).toContain('action.discardSourceRect ?? handRect');
    expect(overlay).not.toContain('action.discardSourceRect ?? river');
    expect(overlay).toContain('beforeEnqueue(action: HandAnimationAction)');
    expect(overlay).toContain('key={visual.action.eventId}');
    expect(overlay.indexOf('this.resetHandVisual();')).toBeLessThan(overlay.indexOf('const overlay = this.overlayRef.current'));
    expect(overlay).not.toContain('<Tile compact faceDown interactive={false} />');
    expect(overlay.indexOf('this.riverMask.mask(action.eventId, riverTile)')).toBeLessThan(overlay.indexOf('this.setVisual({'));
    expect(overlay.indexOf('beforeEnqueue(action: HandAnimationAction)')).toBeLessThan(overlay.indexOf('async prepare(action: HandAnimationAction)'));
    expect(observer).toContain('usePresentationCommitEffect');
    expect(observer).toContain('useLayoutEffect');
  });

  it('riichi 权威棒先遮罩，再显示独立棒代理，并在 release/cleanup 恢复', () => {
    const overlay = readFileSync(resolve(process.cwd(), 'src/components/game/HandAnimationOverlay.tsx'), 'utf8');
    const css = readFileSync(resolve(process.cwd(), 'src/components/game/handAnimationOverlay.css'), 'utf8');

    expect(overlay).toContain('data-animation-kind={animationKind(visual.action)}');
    expect(overlay).toContain('hand-animation-stick-proxy');
    expect(overlay).toContain('<RiichiStick orientation="horizontal" active />');
    expect(overlay.indexOf('this.riichiStickMask.mask(action.eventId, riichiStick)')).toBeLessThan(overlay.indexOf('this.setVisual({'));
    expect(overlay).toContain("phase === 'release' && action.type === 'riichi_declared'");
    expect(overlay).toContain('this.riichiStickMask.revealAll();');
    expect(css).toMatch(/data-animation-phase="grasp"[^}]*hand-animation-stick-proxy[\s\S]*opacity:\s*1;/);
  });

  it('meld 只解析 caller 自己的 anchor，不创建牌代理或控制 authoritative meld', () => {
    const overlay = readFileSync(resolve(process.cwd(), 'src/components/game/HandAnimationOverlay.tsx'), 'utf8');
    const localHand = readFileSync(resolve(process.cwd(), 'src/components/game/LocalHandArea.tsx'), 'utf8');

    expect(overlay).toContain('data-animation-meld-type=');
    expect(overlay).toContain('findMeldAnchor');
    expect(overlay).toContain('`[data-meld-player="${action.playerId}"]`');
    expect(overlay).not.toContain('hand-animation-meld-proxy');
    expect(localHand).toContain('data-meld-player={meldPlayer.id}');
  });

  it('pacing identity 在 consumer 接收时注册，并由 controller settle / overlay cleanup 释放', () => {
    const consumer = readFileSync(resolve(process.cwd(), 'src/presentation/handAnimation/HandAnimationConsumer.ts'), 'utf8');
    const controller = readFileSync(resolve(process.cwd(), 'src/presentation/handAnimation/HandAnimationController.ts'), 'utf8');
    const overlay = readFileSync(resolve(process.cwd(), 'src/components/game/HandAnimationOverlay.tsx'), 'utf8');
    const observer = readFileSync(resolve(process.cwd(), 'src/presentation/gamePresentationEvents.ts'), 'utf8');
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(observer).toContain('useLayoutEffect');
    expect(consumer.indexOf('this.pacingGate?.begin(event)')).toBeLessThan(consumer.indexOf('this.controller.enqueue(action)'));
    expect(controller).toContain('this.onSettled(action)');
    expect(overlay).toContain('presentationPacingGate.complete(action.eventId)');
    expect(overlay).toContain('presentationPacingGate.clear()');
    expect(app).toContain('runPacedAutomaticAction');
    expect(app).not.toContain('AI_ACTION_DELAY_MS');
  });
});
