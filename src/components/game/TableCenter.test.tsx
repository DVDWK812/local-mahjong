import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createMatch } from '../../game/match/matchEngine';
import { TableCenter } from './TableCenter';

describe('TableCenter', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('中央计分区使用紧凑方形尺寸', () => {
    expect(css).toContain('--center-size: clamp(120px, 11vw, 180px)');
    expect(css).toContain('width: var(--center-size)');
    expect(css).toContain('height: var(--center-size)');
    expect(css).toContain('border-radius: 8px');
  });

  it('中央小方框显示局数、本场和剩余牌', () => {
    const state = createInitialGameState();
    const match = createMatch({ matchLength: 'east-only' });
    const html = renderToStaticMarkup(<TableCenter gameState={{ ...state, wall: state.wall.slice(0, 4) }} matchState={match} />);
    expect(html).toContain('东1局');
    expect(html).toContain('0本场');
    expect(html).toContain('剩余4张');
  });

  it('中央显示四家座风和点数，庄字使用红色class', () => {
    const state = createInitialGameState();
    const html = renderToStaticMarkup(<TableCenter gameState={state} matchState={createMatch()} />);
    expect((html.match(/data-center-player=/g) ?? [])).toHaveLength(4);
    expect((html.match(/25,000/g) ?? [])).toHaveLength(4);
    expect(html).toContain('class="dealer-marker"');
    expect(html).toContain('>庄</span><span>东</span>');
    expect(css).toContain('.dealer-marker');
    expect(css).toContain('color: #d23b32');
    for (const player of state.players) {
      expect(html).not.toContain(player.name);
    }
  });

  it('当前行动者使用细边框高亮', () => {
    const html = renderToStaticMarkup(<TableCenter gameState={createInitialGameState()} matchState={createMatch()} />);
    expect(html).toContain('center-score--current');
    expect(css).toContain('outline: 2px solid');
  });
});
