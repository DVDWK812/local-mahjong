import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createMatch } from '../../game/match/matchEngine';
import { MahjongTable } from './MahjongTable';

describe('MahjongTable', () => {
  it('四家玩家区域和中央牌河区同时存在', () => {
    const html = renderToStaticMarkup(<MahjongTable gameState={createInitialGameState()} matchState={createMatch()} />);
    expect((html.match(/data-player-zone=/g) ?? [])).toHaveLength(4);
    expect(html).toContain('data-player-zone="north"');
    expect(html).toContain('data-player-zone="west"');
    expect(html).toContain('data-player-zone="east"');
    expect(html).toContain('data-player-zone="south"');
    expect(html).toContain('中央计分区');
    expect(html).toContain('table-center-cluster');
  });

  it('四家牌河集中渲染在中央周边锚点', () => {
    const html = renderToStaticMarkup(<MahjongTable gameState={createInitialGameState()} />);
    expect(html).toContain('table-river-anchor--north');
    expect(html).toContain('table-river-anchor--west');
    expect(html).toContain('table-river-anchor--east');
    expect(html).toContain('table-river-anchor--south');
    expect((html.match(/discard-river-grid/g) ?? [])).toHaveLength(4);
  });

  it('中央周边预留四个立直棒槽，未立直时透明但保留布局', () => {
    const html = renderToStaticMarkup(<MahjongTable gameState={createInitialGameState()} />);
    expect((html.match(/riichi-stick-slot/g) ?? [])).toHaveLength(8);
    expect((html.match(/data-active="false"/g) ?? [])).toHaveLength(4);
  });

  it('玩家信息不显示点数，点数只在中央计分区显示', () => {
    const html = renderToStaticMarkup(<MahjongTable gameState={createInitialGameState()} matchState={createMatch()} />);
    expect((html.match(/25,000 点/g) ?? [])).toHaveLength(0);
    expect((html.match(/25,000/g) ?? [])).toHaveLength(4);
  });
});
