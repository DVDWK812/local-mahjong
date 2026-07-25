import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { callToMeldDisplayModel } from '../game/meldDisplayAdapter';
import { createTile } from '../game/tileUtils';
import type { CallSet, PlayerState, TileId } from '../game/types';
import { Hand } from './Hand';
import { MeldDisplay } from './MeldDisplay';
import { River } from './River';
import { Tile } from './Tile';

function noop() {
  return undefined;
}

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  const end = css.indexOf('}', start);
  return start === -1 ? '' : css.slice(start, end);
}

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

function tiles(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index));
}

function player(partial: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 0,
    name: 'Player 1',
    seatWind: 'east',
    score: 25000,
    hand: tiles([0, 1, 2]),
    river: tiles([3, 4, 5]),
    calls: [],
    drawnTile: null,
    riichi: false,
    riichiState: null,
    ...partial,
  };
}

describe('贴图牌显示组件', () => {
  it('Tile 使用 img 渲染正面、背面和占位图', () => {
    const red = { ...createTile(4, 0), red: true };
    const face = renderToStaticMarkup(<Tile tile={red} />);
    const back = renderToStaticMarkup(<Tile tile={red} faceDown />);
    const missing = renderToStaticMarkup(<Tile />);
    expect(face).toContain('<img');
    expect(face).toContain('alt="赤五万"');
    expect(face).toContain('m5');
    expect(face).toContain('tile-red-badge');
    expect(back).toContain('alt="牌背"');
    expect(back).toContain('back');
    expect(missing).toContain('alt="缺失牌图"');
    expect(missing).toContain('placeholder');
  });

  it('手牌和河牌均使用贴图', () => {
    const model = player();
    const handHtml = renderToStaticMarkup(<Hand player={model} isCurrent isLocal canDiscard onDiscard={noop} />);
    const riverHtml = renderToStaticMarkup(<River player={model} />);
    expect((handHtml.match(/<img/g) ?? [])).toHaveLength(3);
    expect((riverHtml.match(/<img/g) ?? [])).toHaveLength(3);
    expect(handHtml).toContain('alt="一万"');
    expect(riverHtml).toContain('alt="四万"');
  });

  it('副露使用贴图并保留横牌和加杠叠牌元数据', () => {
    const call: CallSet = { type: 'kan', kanType: 'kakan', tiles: tiles([2, 2, 2, 2]), from: 2, opened: true, calledTile: createTile(2, 8) };
    const html = renderToStaticMarkup(<MeldDisplay meld={callToMeldDisplayModel(call, 0)} />);
    expect((html.match(/<img/g) ?? [])).toHaveLength(4);
    expect(html).toContain('data-sideways="true"');
    expect(html).toContain('data-stacked="true"');
    expect(html).toContain('tile--sideways');
  });

  it('暗杠显示为背面、正面、正面、背面', () => {
    const call: CallSet = { type: 'kan', kanType: 'ankan', tiles: tiles([31, 31, 31, 31]), from: 0, opened: false };
    const html = renderToStaticMarkup(<MeldDisplay meld={callToMeldDisplayModel(call, 0)} />);
    expect((html.match(/alt="牌背"/g) ?? [])).toHaveLength(2);
    expect((html.match(/alt="白"/g) ?? [])).toHaveLength(2);
    expect((html.match(/data-face-down="true"/g) ?? [])).toHaveLength(2);
  });
  it('keeps display-only disabled tiles opaque without disabling clickable hand tiles', () => {
    const displayOnly = renderToStaticMarkup(<Tile tile={createTile(0, 0)} />);
    const clickable = renderToStaticMarkup(<Tile tile={createTile(0, 0)} onClick={noop} />);
    expect(displayOnly).toContain('disabled=""');
    expect(clickable).not.toContain('disabled=""');
    expect(cssRule(css, '.tile:disabled')).toContain('opacity: 1');
  });
});
