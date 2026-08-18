import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createMatch } from '../../game/match/matchEngine';
import { createTile } from '../../game/tileUtils';
import type { TileId } from '../../game/types';
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
    expect((html.match(/data-riichi-player=/g) ?? [])).toHaveLength(4);
    expect(html).toContain('data-riichi-position="south"');
    expect(html).toContain('data-riichi-position="east"');
    expect(html).toContain('data-riichi-position="north"');
    expect(html).toContain('data-riichi-position="west"');
  });

  it('对手信息显示风位与点数，中央计分区继续保留四家点数', () => {
    const html = renderToStaticMarkup(<MahjongTable gameState={createInitialGameState()} matchState={createMatch()} />);
    expect((html.match(/25,000 点/g) ?? [])).toHaveLength(0);
    expect((html.match(/class="player-identity-meta"/g) ?? [])).toHaveLength(3);
    expect((html.match(/25,000/g) ?? [])).toHaveLength(7);
  });

  it('AI 玩家头像框正常显示摸切效果', () => {
    const state = createInitialGameState();
    const gameState = {
      ...state,
      players: state.players.map((player) => {
        if (player.id === 0) return player;
        return {
          ...player,
          river: [{ ...createTile((4 + player.id) as TileId, player.id), isTsumogiri: player.id !== 2 }],
        };
      }),
    };
    const html = renderToStaticMarkup(<MahjongTable gameState={gameState} matchState={createMatch()} />);

    expect(html.match(/class="tsumogiri-marker /g)).toHaveLength(3);
    expect(html.match(/tsumogiri-marker--drawn/g)).toHaveLength(2);
    expect(html.match(/tsumogiri-marker--blocked/g)).toHaveLength(1);
  });
});
