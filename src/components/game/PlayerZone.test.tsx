import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createTile } from '../../game/tileUtils';
import type { CallSet, PlayerId } from '../../game/types';
import { PlayerZone } from './PlayerZone';

describe('PlayerZone', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('对手区域显示牌背、头像、玩家名、红色庄家标记和当前行动者高亮', () => {
    const state = createInitialGameState();
    const player = state.players[1];
    const html = renderToStaticMarkup(
      <PlayerZone
        playerIndex={1}
        position="east"
        player={player}
        score={player.score}
        seatWind={player.seatWind}
        isDealer
        isCurrentPlayer
      />,
    );
    expect(html).toContain('player-zone--east');
    expect(html).toContain('player-zone--current');
    expect(html).toContain('player-avatar');
    expect(html).toContain('dealer-marker');
    expect(html).toContain('tile--hidden');
  });

  it('头像框下显示摸切标记，非摸切叠加禁止标志，可关闭', () => {
    const state = createInitialGameState();
    const drawnDiscardPlayer = { ...state.players[1], river: [{ ...createTile(4, 1), isTsumogiri: true }] };
    const handDiscardPlayer = { ...state.players[1], river: [{ ...createTile(4, 1), isTsumogiri: false }] };
    const drawnHtml = renderToStaticMarkup(
      <PlayerZone playerIndex={1} position="east" player={drawnDiscardPlayer} score={drawnDiscardPlayer.score} seatWind={drawnDiscardPlayer.seatWind} isDealer={false} isCurrentPlayer={false} />,
    );
    const handHtml = renderToStaticMarkup(
      <PlayerZone playerIndex={1} position="east" player={handDiscardPlayer} score={handDiscardPlayer.score} seatWind={handDiscardPlayer.seatWind} isDealer={false} isCurrentPlayer={false} />,
    );
    const hiddenHtml = renderToStaticMarkup(
      <PlayerZone playerIndex={1} position="east" player={drawnDiscardPlayer} score={drawnDiscardPlayer.score} seatWind={drawnDiscardPlayer.seatWind} isDealer={false} isCurrentPlayer={false} tsumoGiriDisplayEnabled={false} />,
    );

    expect(drawnHtml).toContain('tsumogiri-marker--drawn');
    expect(drawnHtml).toContain('tsumogiri-marker');
    expect(handHtml).toContain('tsumogiri-marker--blocked');
    expect(hiddenHtml).not.toContain('tsumogiri-marker');
    expect(css).toContain('color: #9da99f');
    expect(css).toContain('.tsumogiri-marker--blocked::after');
    expect(css).toContain('border: 2px solid #f00018');
    expect(css).toContain('linear-gradient');
  });

  it('玩家信息、手牌、牌河和副露使用不同安全容器', () => {
    const state = createInitialGameState();
    const player = state.players[1];
    const html = renderToStaticMarkup(
      <PlayerZone
        playerIndex={1}
        position="east"
        player={player}
        score={player.score}
        seatWind={player.seatWind}
        isDealer={false}
        isCurrentPlayer={false}
      />,
    );
    expect(html).toContain('player-identity player-zone-label');
    expect(html).toContain('player-zone-hand-wrap');
    expect(html).toContain('player-zone-river-wrap');
    expect(html).toContain('player-zone-meld-wrap');
    expect(html).toContain('player-identity-meta');
    expect(html).toContain('25,000');
  });

  it('左右家手牌完整显示13张牌背，并预留第14张空间', () => {
    const state = createInitialGameState();
    const westHtml = renderToStaticMarkup(
      <PlayerZone
        playerIndex={3}
        position="west"
        player={state.players[3]}
        score={state.players[3].score}
        seatWind={state.players[3].seatWind}
        isDealer={false}
        isCurrentPlayer={false}
      />,
    );
    const eastHtml = renderToStaticMarkup(
      <PlayerZone
        playerIndex={1}
        position="east"
        player={state.players[1]}
        score={state.players[1].score}
        seatWind={state.players[1].seatWind}
        isDealer={false}
        isCurrentPlayer={false}
      />,
    );
    expect((westHtml.match(/tile--hidden/g) ?? [])).toHaveLength(13);
    expect((eastHtml.match(/tile--hidden/g) ?? [])).toHaveLength(13);
    expect(css).toContain('--opponent-hand-length');
    expect(css).toContain('height: var(--opponent-hand-length)');
  });

  it('左右家只旋转手牌外层wrapper，不裁切内部牌背', () => {
    expect(css).toContain('.side-player-hand-wrapper--west');
    expect(css).toContain('transform: rotate(90deg)');
    expect(css).toContain('.side-player-hand-wrapper--east');
    expect(css).toContain('transform: rotate(-90deg)');
    expect(css).toContain('overflow: visible');
  });

  it('本家桌面PlayerZone可关闭牌河，由中央牌河区统一显示', () => {
    const state = createInitialGameState();
    const html = renderToStaticMarkup(
      <PlayerZone
        playerIndex={0}
        position="south"
        player={state.players[0]}
        score={state.players[0].score}
        seatWind={state.players[0].seatWind}
        isDealer
        isCurrentPlayer={false}
        showHand={false}
        showRiver={false}
      />,
    );
    expect(html).toContain('player-zone--no-river');
    expect(html).not.toContain('player-zone-river-wrap');
    expect(html).not.toContain('player-zone-hand-wrap');
  });

  it('副露显示横牌、加杠叠牌和暗杠背面逻辑', () => {
    const state = createInitialGameState();
    const kakan: CallSet = { type: 'kan', kanType: 'kakan', tiles: [createTile(2, 0), createTile(2, 1), createTile(2, 2), createTile(2, 3)], from: 2 as PlayerId, opened: true, calledTile: createTile(2, 9) };
    const ankan: CallSet = { type: 'kan', kanType: 'ankan', tiles: [createTile(31, 0), createTile(31, 1), createTile(31, 2), createTile(31, 3)], from: 0 as PlayerId, opened: false };
    const player = { ...state.players[0], calls: [kakan, ankan] };
    const html = renderToStaticMarkup(
      <PlayerZone
        playerIndex={0}
        position="south"
        player={player}
        score={player.score}
        seatWind={player.seatWind}
        isDealer
        isCurrentPlayer={false}
      />,
    );
    expect(html).toContain('data-sideways="true"');
    expect(html).toContain('data-stacked="true"');
    expect((html.match(/data-face-down="true"/g) ?? [])).toHaveLength(2);
  });
});
