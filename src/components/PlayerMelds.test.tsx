import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayerMelds } from './PlayerMelds';
import { createTile } from '../game/tileUtils';
import type { PlayerState } from '../game/types';

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
});
