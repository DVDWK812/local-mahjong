import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { HandTrack } from './HandTrack';

describe('HandTrack', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('四家手牌轨道均为单行flex且不换行', () => {
    expect(css).toContain('.opponent-hand-track');
    expect(css).toContain('display: flex');
    expect(css).toContain('flex-wrap: nowrap');
    expect(css).toContain('width: max-content');
  });

  it('左右家只旋转外层wrapper', () => {
    expect(css).toContain('.side-player-hand-wrapper--west');
    expect(css).toContain('transform: rotate(90deg)');
    expect(css).toContain('.side-player-hand-wrapper--east');
    expect(css).toContain('transform: rotate(-90deg)');
    expect(css).not.toContain('grid-template-columns: repeat(2, var(--opponent-tile-width))');
  });

  it('左家手牌渲染为外层旋转wrapper加内部单行轨道', () => {
    const state = createInitialGameState();
    const html = renderToStaticMarkup(<HandTrack player={state.players[3]} position="west" />);
    expect(html).toContain('side-player-hand-wrapper--west');
    expect(html).toContain('opponent-hand-track');
  });

  it('摸入牌与原手牌保留间隔', () => {
    const state = createInitialGameState();
    const html = renderToStaticMarkup(<HandTrack player={state.players[0]} position="south" concealed={false} />);
    expect(html).toContain('opponent-drawn-gap');
  });
});
