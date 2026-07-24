import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createTile } from '../../game/tileUtils';
import { DiscardRiver } from './DiscardRiver';

describe('DiscardRiver', () => {
  it('使用固定牌河面板渲染弃牌，普通弃牌保留单牌占位', () => {
    const state = createInitialGameState();
    const player = { ...state.players[0], river: Array.from({ length: 12 }, (_, index) => createTile((index % 9) as 0, index)) };
    const html = renderToStaticMarkup(<DiscardRiver player={player} position="south" />);
    expect(html).toContain('discard-river-grid');
    expect((html.match(/class="discard-river-tile /g) ?? [])).toHaveLength(12);
  });

  it('对家牌河正常显示牌图并保持固定尺寸容器', () => {
    const state = createInitialGameState();
    const player = { ...state.players[2], river: Array.from({ length: 13 }, (_, index) => createTile((index % 9) as 0, index)) };
    const html = renderToStaticMarkup(<DiscardRiver player={player} position="north" />);
    expect(html).toContain('discard-river--north');
    expect((html.match(/class="tile-image"/g) ?? [])).toHaveLength(13);
  });

  it('左右家牌河旋转后仍使用相同6.5乘4结构', () => {
    const state = createInitialGameState();
    const html = renderToStaticMarkup(<DiscardRiver player={state.players[1]} position="east" />);
    expect(html).toContain('discard-river--east');
    expect(html).toContain('discard-river-grid');
  });

  it('立直弃牌使用横牌slot占位，只旋转不缩放', () => {
    const state = createInitialGameState();
    const riichiTile = createTile(4, 100);
    const player = {
      ...state.players[3],
      river: [createTile(1, 1), riichiTile, createTile(2, 2)],
      riichi: true,
      riichiState: { declaredAtTurn: 4, ippatsuAvailable: true, kind: 'riichi' as const, riichiDiscardInstanceId: riichiTile.instanceId },
    };
    const html = renderToStaticMarkup(<DiscardRiver player={player} position="north" />);
    expect(html).toContain('riichi-discard-slot');
    expect(html).toContain('tile--sideways');
  });

  it('CSS用13个半牌宽实现6.5张乘4行，立直slot不使用absolute或scale', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const tileRuleStart = css.indexOf('.discard-river-tile {');
    const tileRuleEnd = css.indexOf('}', tileRuleStart);
    const tileRule = css.slice(tileRuleStart, tileRuleEnd);
    const riichiRuleStart = css.indexOf('.discard-river-tile--riichi');
    const riichiRuleEnd = css.indexOf('}', riichiRuleStart);
    const riichiRule = css.slice(riichiRuleStart, riichiRuleEnd);
    expect(css).toContain('grid-template-columns: repeat(13, var(--river-half-width))');
    expect(css).toContain('height: var(--river-board-height)');
    expect(css).toContain('width: var(--river-board-width)');
    expect(css).toContain('grid-column: span 2');
    expect(css).toContain('grid-column: span 3');
    expect(tileRule).not.toContain('position: absolute');
    expect(riichiRule).not.toContain('scale');
  });
});
