import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { callToMeldDisplayModel } from '../game/meldDisplayAdapter';
import { createTile } from '../game/tileUtils';
import type { CallSet, TileId } from '../game/types';
import { MeldDisplay } from './MeldDisplay';

function tiles(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index));
}

describe('MeldDisplay', () => {
  it('renders chi with an accessible source label', () => {
    const model = callToMeldDisplayModel(
      { type: 'chi', tiles: tiles([0, 1, 2]), from: 3, opened: true, sequence: [0, 1, 2], calledTile: createTile(1, 9), usedTileIds: [0, 2] },
      0,
    );
    const html = renderToStaticMarkup(<MeldDisplay meld={model} />);
    expect(html).toContain('aria-label="吃 · 来自上家"');
    expect(html).toContain('data-sideways="true"');
  });

  it('renders minkan with four tiles and a sideways called tile', () => {
    const call: CallSet = { type: 'kan', kanType: 'minkan', tiles: tiles([7, 7, 7, 7]), from: 2, opened: true, calledTile: createTile(7, 9) };
    const html = renderToStaticMarkup(<MeldDisplay meld={callToMeldDisplayModel(call, 0)} />);
    expect((html.match(/class="tile tile--compact/g) ?? []).length).toBe(4);
    expect(html).toContain('data-sideways="true"');
  });

  it('renders red fives inside melds', () => {
    const red = createTile(4, 0);
    red.red = true;
    const html = renderToStaticMarkup(<MeldDisplay meld={callToMeldDisplayModel({ type: 'pon', tiles: [red, createTile(4, 1), createTile(4, 2)], from: 2, opened: true, calledTile: red }, 0)} />);
    expect(html).toContain('alt="赤五万"');
    expect(html).toContain('m5');
    expect(html).toContain('tile-red-badge');
  });
});
