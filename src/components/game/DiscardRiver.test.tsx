import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createTile } from '../../game/tileUtils';
import type { Tile } from '../../game/types';
import { DiscardRiver } from './DiscardRiver';

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  const end = css.indexOf('}', start);
  return start === -1 ? '' : css.slice(start, end);
}

describe('DiscardRiver', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('普通弃牌占2个半牌宽列', () => {
    const rule = cssRule(css, '.discard-river-tile {');
    expect(rule).toContain('grid-column: span 2');
    expect(rule).not.toContain('position: absolute');
  });

  it('立直弃牌占3个半牌宽列，并只由slot旋转90度', () => {
    const state = createInitialGameState();
    const riichiTile = createTile(4, 100);
    const player = {
      ...state.players[0],
      river: [createTile(1, 1), riichiTile, createTile(2, 2)],
      riichi: true,
      riichiState: { declaredAtTurn: 4, ippatsuAvailable: true, kind: 'riichi' as const, riichiDiscardInstanceId: riichiTile.instanceId },
    };
    const html = renderToStaticMarkup(<DiscardRiver player={player} position="south" />);
    const riichiRule = cssRule(css, '.discard-river-tile--riichi');
    const slotRule = cssRule(css, '.riichi-discard-slot .tile');
    expect(html).toContain('riichi-discard-slot');
    expect(html).not.toContain('tile--sideways');
    expect(riichiRule).toContain('grid-column: span 3');
    expect(slotRule).toContain('transform: rotate(90deg)');
    expect(riichiRule).not.toContain('scale');
    expect(riichiRule).not.toContain('margin');
  });

  it('被鸣取的普通牌和立直牌保留各自占位', () => {
    const state = createInitialGameState();
    const riichiTile = { ...createTile(4, 100), claimed: true } as Tile & { claimed: boolean };
    const claimedTile = { ...createTile(1, 1), claimed: true } as Tile & { claimed: boolean };
    const player = {
      ...state.players[0],
      river: [claimedTile, riichiTile],
      riichi: true,
      riichiState: { declaredAtTurn: 4, ippatsuAvailable: true, kind: 'riichi' as const, riichiDiscardInstanceId: riichiTile.instanceId },
    };
    const html = renderToStaticMarkup(<DiscardRiver player={player} position="south" />);
    expect((html.match(/discard-river-tile--claimed/g) ?? [])).toHaveLength(2);
    expect((html.match(/discard-river-claimed-placeholder/g) ?? [])).toHaveLength(2);
    expect(html).toContain('discard-river-tile--riichi');
  });

  it('内部grid固定13个半牌宽列和4行高，且自身不旋转', () => {
    const gridRule = cssRule(css, '.discard-river-grid {');
    expect(css).toContain('--river-tile-width');
    expect(css).toContain('--river-tile-height');
    expect(css).toContain('--river-half-width');
    expect(css).toContain('--river-area-width');
    expect(css).toContain('--river-area-height');
    expect(gridRule).toContain('grid-template-columns: repeat(13, var(--river-half-width))');
    expect(gridRule).toContain('grid-auto-rows: var(--river-tile-height)');
    expect(gridRule).toContain('width: var(--river-area-width)');
    expect(gridRule).toContain('height: var(--river-area-height)');
    expect(gridRule).not.toContain('transform');
    expect(gridRule).not.toContain('overflow: hidden');
  });

  it('四个方向只在外层牌河旋转', () => {
    expect(cssRule(css, '.discard-river--west {')).toContain('transform: rotate(90deg)');
    expect(cssRule(css, '.discard-river--east {')).toContain('transform: rotate(-90deg)');
    expect(cssRule(css, '.discard-river--north {')).toContain('transform: rotate(180deg)');
    expect(cssRule(css, '.discard-river--south {')).not.toContain('transform');
    expect(css).not.toContain('.discard-river--west .discard-river-grid');
    expect(css).not.toContain('.discard-river--east .discard-river-grid');
  });

  it('左右家anchor交换宽高以匹配旋转后的视觉区域', () => {
    const sideAnchorRule = cssRule(css, '.table-river-anchor--west');
    expect(sideAnchorRule).toContain('width: var(--river-area-height)');
    expect(sideAnchorRule).toContain('height: var(--river-area-width)');
  });

  it('四家牌河完整保持6.5张×4行，不使用缩放、负边距或单牌绝对定位', () => {
    const state = createInitialGameState();
    const player = { ...state.players[2], river: Array.from({ length: 13 }, (_, index) => createTile((index % 9) as 0, index)) };
    const html = renderToStaticMarkup(<DiscardRiver player={player} position="north" />);
    expect(html).toContain('discard-river--north');
    expect((html.match(/class="tile-image"/g) ?? [])).toHaveLength(13);
    expect(css).toContain('calc(var(--river-half-width) * 13 + var(--river-gap) * 12)');
    expect(css).toContain('calc(var(--river-tile-height) * 4 + var(--river-gap) * 3)');
    expect(css).not.toContain('scale(');
    expect(cssRule(css, '.discard-river-tile {')).not.toContain('position: absolute');
  });
});
