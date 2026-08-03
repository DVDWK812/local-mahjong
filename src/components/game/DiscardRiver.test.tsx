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

function riverDimensions(viewportWidth: number) {
  const tileWidth = Math.min(48, Math.max(28, viewportWidth * 0.0265));
  return { tileWidth, tileHeight: tileWidth * 1.35, gap: 2 };
}

function rowBounds(viewportWidth: number, sideways: boolean[]) {
  const { tileWidth, tileHeight, gap } = riverDimensions(viewportWidth);
  let left = 0;
  return sideways.map((isSideways) => {
    const width = isSideways ? tileHeight : tileWidth;
    const bounds = { left, right: left + width, width };
    left = bounds.right + gap;
    return bounds;
  });
}

describe('DiscardRiver', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('普通弃牌占2个半牌宽列', () => {
    const rule = cssRule(css, '.discard-river-tile {');
    expect(rule).toContain('flex: 0 0 var(--river-tile-width)');
    expect(rule).toContain('width: var(--river-tile-width)');
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
    const html = renderToStaticMarkup(<DiscardRiver player={player} position="south" preserveClaimedDiscardGap />);
    const riichiRule = cssRule(css, '.discard-river-tile--riichi');
    const slotRule = cssRule(css, '.riichi-discard-slot .tile');
    expect(html).toContain('riichi-discard-slot');
    expect(html).toMatch(/discard-river-tile--riichi[^>]*><span class="riichi-discard-slot">/);
    expect(html).not.toContain('tile--sideways');
    expect(riichiRule).toContain('width: var(--river-tile-height)');
    expect(riichiRule).toContain('min-width: var(--river-tile-height)');
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
    const html = renderToStaticMarkup(<DiscardRiver player={player} position="south" preserveClaimedDiscardGap />);
    expect((html.match(/discard-river-tile--claimed/g) ?? [])).toHaveLength(2);
    expect((html.match(/discard-river-claimed-placeholder/g) ?? [])).toHaveLength(2);
    expect(html).toContain('discard-river-tile--riichi');
  });

  it('does not render claimed visual nodes when claimed gaps are disabled', () => {
    const state = createInitialGameState();
    const claimedTile = { ...createTile(1, 1), claimed: true } as Tile & { claimed: boolean };
    const player = { ...state.players[0], river: [claimedTile, createTile(2, 2)] };
    const html = renderToStaticMarkup(<DiscardRiver player={player} position="south" />);
    expect(html).not.toContain('discard-river-tile--claimed');
    expect(html).not.toContain('discard-river-claimed-placeholder');
    expect((html.match(/class="tile-image"/g) ?? [])).toHaveLength(1);
  });

  it('内部grid固定13个半牌宽列和4行高，且自身不旋转', () => {
    const gridRule = cssRule(css, '.discard-river-grid {');
    expect(css).toContain('--river-tile-width');
    expect(css).toContain('--river-tile-height');
    expect(css).toContain('--river-half-width');
    expect(css).toContain('--river-area-width');
    expect(css).toContain('--river-area-height');
    expect(gridRule).toContain('display: flex');
    expect(gridRule).toContain('flex-direction: column');
    expect(cssRule(css, '.discard-river-row {')).toContain('min-width: max-content');
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
  it('上下牌河18张恰好按3行×6张排列', () => {
    const state = createInitialGameState();
    const player = { ...state.players[0], river: Array.from({ length: 18 }, (_, index) => createTile((index % 9) as 0, index)) };
    const html = renderToStaticMarkup(<DiscardRiver player={player} position="south" />);
    expect((html.match(/data-river-row="1"/g) ?? [])).toHaveLength(6);
    expect((html.match(/data-river-row="2"/g) ?? [])).toHaveLength(6);
    expect((html.match(/data-river-row="3"/g) ?? [])).toHaveLength(6);
    expect(html).toContain('data-river-row="3" data-river-column="6"');
    const horizontalRule = cssRule(css, '.discard-river--south .discard-river-grid');
    expect(horizontalRule).toContain('width: calc(var(--river-tile-width) * 6 + var(--river-gap) * 5)');
    expect(horizontalRule).toContain('height: calc(var(--river-tile-height) * 3 + var(--river-gap) * 2)');
  });

  it('第19张及后续牌固定在第三行向原阅读方向延伸', () => {
    const state = createInitialGameState();
    const player = { ...state.players[2], river: Array.from({ length: 20 }, (_, index) => createTile((index % 9) as 0, index)) };
    const south = renderToStaticMarkup(<DiscardRiver player={player} position="south" />);
    const north = renderToStaticMarkup(<DiscardRiver player={player} position="north" />);
    expect(south).toContain('data-river-row="3" data-river-column="7"');
    expect(south).toContain('data-river-row="3" data-river-column="8"');
    expect(north).toContain('data-river-row="3" data-river-column="8"');
    expect(cssRule(css, '.discard-river--north {')).toContain('transform: rotate(180deg)');
  });

  it('左右牌河不采用上下牌河的行列定位', () => {
    const state = createInitialGameState();
    const player = { ...state.players[1], river: Array.from({ length: 19 }, (_, index) => createTile((index % 9) as 0, index)) };
    const west = renderToStaticMarkup(<DiscardRiver player={player} position="west" />);
    const east = renderToStaticMarkup(<DiscardRiver player={player} position="east" />);
    expect(west).not.toContain('data-river-row');
    expect(east).not.toContain('data-river-column');
    expect(cssRule(css, '.discard-river--west {')).toContain('transform: rotate(90deg)');
    expect(cssRule(css, '.discard-river--east {')).toContain('transform: rotate(-90deg)');
  });

  it('立直横牌仍占一个顺序槽位，不会挤到下一行', () => {
    const state = createInitialGameState();
    const river = Array.from({ length: 19 }, (_, index) => createTile((index % 9) as 0, index));
    const riichiTile = river[5];
    const player = {
      ...state.players[0],
      river,
      riichi: true,
      riichiState: { declaredAtTurn: 4, ippatsuAvailable: true, kind: 'riichi' as const, riichiDiscardInstanceId: riichiTile.instanceId },
    };
    const html = renderToStaticMarkup(<DiscardRiver player={player} position="south" />);
    expect(html).toContain('riichi-discard-slot');
    expect(html).toContain('data-river-row="1" data-river-column="6"');
    expect(html).toContain('data-river-row="2" data-river-column="1"');
    expect(html).toContain('data-river-row="3" data-river-column="7"');
  });

  it('keeps discard tile buttons fully opaque while claimed placeholders stay hidden', () => {
    const tileDisabledRule = cssRule(css, '.tile:disabled');
    const displayTileRule = cssRule(css, '.discard-river .tile');
    const displayImageRule = cssRule(css, '.discard-river .tile-image');
    const claimedRule = cssRule(css, '.discard-river-tile--claimed');
    expect(tileDisabledRule).toContain('opacity: 1');
    expect(displayTileRule).toContain('opacity: 1');
    expect(displayTileRule).toContain('filter: none');
    expect(displayTileRule).toContain('mix-blend-mode: normal');
    expect(displayImageRule).toContain('opacity: 1');
    expect(displayImageRule).toContain('filter: none');
    expect(claimedRule).toContain('visibility: hidden');
    expect(claimedRule).not.toContain('opacity: 0');
  });

  it.each([1280, 1920])('reserves the full rotated width at %i px', (viewportWidth) => {
    const { tileWidth, tileHeight } = riverDimensions(viewportWidth);
    const normalRule = cssRule(css, '.discard-river-tile {');
    const riichiWidthRule = cssRule(css, '.discard-river-tile--riichi');
    const riichiFlexRule = cssRule(css, '.discard-river-tile--riichi {');
    const slotRule = cssRule(css, '.riichi-discard-slot {');
    expect(tileHeight).toBeGreaterThan(tileWidth);
    expect(normalRule).toContain('width: var(--river-tile-width)');
    expect(riichiWidthRule).toContain('width: var(--river-tile-height)');
    expect(riichiFlexRule).toContain('flex-basis: var(--river-tile-height)');
    expect(slotRule).toContain('width: var(--river-tile-height)');
    expect(slotRule).toContain('height: var(--river-tile-height)');
  });

  it.each(['south', 'east', 'north', 'west'] as const)('keeps adjacent bounds disjoint for %s', (position) => {
    for (const viewportWidth of [1280, 1920]) {
      const bounds = rowBounds(viewportWidth, [false, true, true, false]);
      bounds.slice(1).forEach((current, index) => {
        expect(current.left).toBeGreaterThan(bounds[index].right);
      });
    }
    const state = createInitialGameState();
    const tiles = [createTile(1, 1), { ...createTile(2, 2), isRiichiDiscard: true }, createTile(3, 3)];
    const html = renderToStaticMarkup(<DiscardRiver player={{ ...state.players[0], river: tiles }} position={position} />);
    expect(html).toContain(`discard-river--${position}`);
    expect(html).toContain('riichi-discard-slot');
  });

  it('keeps wrapped rows and consecutive sideways discards disjoint', () => {
    for (const viewportWidth of [1280, 1920]) {
      const firstRow = rowBounds(viewportWidth, [false, false, false, false, true, true]);
      const secondRow = rowBounds(viewportWidth, [true, true, false, false, false, false]);
      for (const row of [firstRow, secondRow]) {
        row.slice(1).forEach((current, index) => expect(current.left).toBeGreaterThan(row[index].right));
      }
      const { tileHeight, gap } = riverDimensions(viewportWidth);
      expect(tileHeight + gap).toBeGreaterThan(tileHeight);
    }
    expect(cssRule(css, '.discard-river-row {')).toContain('flex: 0 0 var(--river-tile-height)');
    expect(cssRule(css, '.discard-river-grid {')).toContain('gap: var(--river-gap)');
  });

  it('preserves ordinary discard spacing and uses no overlap-producing positioning', () => {
    for (const viewportWidth of [1280, 1920]) {
      const { tileWidth, gap } = riverDimensions(viewportWidth);
      const bounds = rowBounds(viewportWidth, [false, false, false]);
      expect(bounds.map(({ left }) => left)).toEqual([0, tileWidth + gap, (tileWidth + gap) * 2]);
    }
    const riverRules = [
      cssRule(css, '.discard-river-row {'),
      cssRule(css, '.discard-river-tile {'),
      cssRule(css, '.discard-river-tile--riichi'),
      cssRule(css, '.riichi-discard-slot {'),
    ].join('\n');
    expect(riverRules).not.toMatch(/margin\s*:\s*-/);
    expect(riverRules).not.toContain('position: absolute');
  });
});
