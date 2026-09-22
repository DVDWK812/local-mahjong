import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PlayerMelds } from './PlayerMelds';
import { createTile } from '../game/tileUtils';
import type { PlayerState } from '../game/types';

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  const end = css.indexOf('}', start);
  return start === -1 ? '' : css.slice(start, end);
}

function playerWithCalls(calls: PlayerState['calls']): PlayerState {
  return {
    id: 0,
    name: 'Player 1',
    seatWind: 'east',
    score: 25000,
    hand: [],
    river: [],
    calls,
    drawnTile: null,
    riichi: false,
    riichiState: null,
  };
}

describe('PlayerMelds', () => {
  it('renders multiple melds in stable call order', () => {
    const html = renderToStaticMarkup(<PlayerMelds player={playerWithCalls([
      { type: 'pon', tiles: [createTile(1, 0), createTile(1, 1), createTile(1, 2)], from: 2, opened: true },
      { type: 'kan', kanType: 'ankan', tiles: [createTile(31, 0), createTile(31, 1), createTile(31, 2), createTile(31, 3)], from: 0, opened: false },
    ])} />);
    expect(html.indexOf('data-call-type="pon"')).toBeLessThan(html.indexOf('data-call-type="ankan"'));
  });

  it('keeps sideways metadata for rotated seat classes', () => {
    const html = renderToStaticMarkup(<PlayerMelds seatClass="seat-opposite" player={playerWithCalls([
      { type: 'pon', tiles: [createTile(1, 0), createTile(1, 1), createTile(1, 2)], from: 2, opened: true },
    ])} />);
    expect(html).toContain('seat-opposite');
    expect(html).toContain('data-sideways="true"');
  });

  it('keeps multiple meld groups in one horizontal row', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const playerMeldsRule = css.match(/\.player-melds\s*\{[^}]+\}/)?.[0] ?? '';
    expect(playerMeldsRule).toContain('flex-direction: row');
    expect(playerMeldsRule).toContain('flex-wrap: nowrap');
  });

  it('keeps AI meld tiles and concealed kan backs fully opaque', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const meldTileRule = cssRule(css, '.player-melds .tile');
    const meldImageRule = cssRule(css, '.player-melds .tile-image');
    const hiddenDisabledRule = cssRule(css, '.tile--hidden:disabled');
    const html = renderToStaticMarkup(<PlayerMelds player={playerWithCalls([
      { type: 'kan', kanType: 'ankan', tiles: [createTile(31, 0), createTile(31, 1), createTile(31, 2), createTile(31, 3)], from: 0, opened: false },
    ])} />);
    expect((html.match(/tile--hidden/g) ?? [])).toHaveLength(2);
    expect(meldTileRule).toContain('opacity: 1');
    expect(meldTileRule).toContain('filter: none');
    expect(meldTileRule).toContain('mix-blend-mode: normal');
    expect(meldImageRule).toContain('opacity: 1');
    expect(meldImageRule).toContain('filter: none');
    expect(hiddenDisabledRule).toContain('opacity: 1');
  });
});
