import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createTile } from '../../game/tileUtils';
import type { Tile } from '../../game/types';
import { DiscardRiver } from './DiscardRiver';
import { GameScreen } from './GameScreen';
import { visualSeatForPlayer } from './HandAnimationOverlay';

const noop = () => undefined;

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
    expect(overlay.indexOf('this.riverMask.mask(action.eventId, riverTile)')).toBeLessThan(overlay.indexOf('this.setVisual({'));
    expect(overlay.indexOf('beforeEnqueue(action: HandAnimationAction)')).toBeLessThan(overlay.indexOf('async prepare(action: HandAnimationAction)'));
    expect(observer).toContain('usePresentationCommitEffect');
    expect(observer).toContain('useLayoutEffect');
  });
});
