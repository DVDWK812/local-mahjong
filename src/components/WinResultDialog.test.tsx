import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import { createTile } from '../game/tileUtils';
import type { CallSet, GameState, TileId } from '../game/types';
import { ResultDialog } from './ResultDialog';

function hand(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index % 4));
}

describe('ResultDialog win branch', () => {
  it('和牌时显示和牌玩家手牌、和牌牌和完整计番明细', () => {
    const winnerHand = hand([0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 31]);
    const winTile = createTile(31, 1);
    const base = createInitialGameState();
    const state: GameState = {
      ...base,
      honba: 1,
      riichiSticks: 1,
      players: base.players.map((player) => player.id === 0 ? { ...player, hand: winnerHand } : player),
      result: {
        type: 'ron',
        winners: [{
          winner: 0,
          from: 1,
          winType: 'ron',
          winTile,
          yaku: [
            { name: '立直', han: 1 },
            { name: '宝牌', han: 2 },
            { name: '赤宝牌', han: 1 },
          ],
          han: 4,
          fu: 40,
          points: 8000,
          pointDeltas: [9000, -8000, 0, 0],
        }],
        pointDeltas: [9000, -8000, 0, 0],
      },
    };
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('和牌手牌');
    expect(html).toContain('和牌张');
    expect(html).toContain('立直');
    expect(html).toContain('宝牌');
    expect(html).toContain('赤宝牌');
    expect(html).toContain('合计：4番40符');
    expect(html).toContain('本场：1本场');
    expect(html).toContain('供托：1根');
    expect(html).toContain('总计：8,000点');
  });

  it('立直荣和结果分别显示宝牌、里宝牌、赤宝牌，不显示其他计番', () => {
    const winnerHand = hand([0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 31]);
    const winTile = createTile(31, 1);
    const base = createInitialGameState();
    const state: GameState = {
      ...base,
      players: base.players.map((player) => player.id === 0 ? { ...player, hand: winnerHand, riichi: true } : player),
      result: {
        type: 'ron',
        winners: [{
          winner: 0,
          from: 1,
          winType: 'ron',
          winTile,
          yaku: [{ name: '立直', han: 1 }],
          dora: 2,
          uraDora: 1,
          redDora: 1,
          han: 5,
          fu: 40,
          points: 8000,
          pointDeltas: [8000, -8000, 0, 0],
        }],
        pointDeltas: [8000, -8000, 0, 0],
      },
    };

    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('立直');
    expect(html).toContain('宝牌');
    expect(html).toContain('里宝牌');
    expect(html).toContain('赤宝牌');
    expect(html).toContain('合计：5番40符');
    expect(html).not.toContain('其他计番');
  });

  it('和牌结果显示吃、碰、暗杠和加杠副露', () => {
    const base = createInitialGameState();
    const calls: CallSet[] = [
      { type: 'chi', tiles: hand([1, 2, 3]), from: 3, opened: true, sequence: [1, 2, 3], calledTile: createTile(2, 0), usedTileIds: [1, 3] },
      { type: 'pon', tiles: hand([27, 27, 27]), from: 1, opened: true, calledTile: createTile(27, 0) },
      { type: 'kan', kanType: 'ankan', tiles: hand([31, 31, 31, 31]), from: 0, opened: false },
      { type: 'kan', kanType: 'kakan', tiles: hand([5, 5, 5, 5]), from: 2, opened: true, calledTile: createTile(5, 0) },
    ];
    const state: GameState = {
      ...base,
      players: base.players.map((player) => player.id === 0 ? {
        ...player,
        hand: hand([9, 10, 11, 18, 19, 20, 13]),
        calls,
      } : player),
      result: {
        type: 'ron',
        winners: [{
          winner: 0,
          from: 1,
          winType: 'ron',
          winTile: createTile(13, 0),
          yaku: [{ name: '役牌·白', han: 1 }],
          han: 1,
          fu: 40,
          points: 1300,
          pointDeltas: [1300, -1300, 0, 0],
        }],
        pointDeltas: [1300, -1300, 0, 0],
      },
    };
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('result-melds');
    expect(html).toContain('data-call-type="chi"');
    expect(html).toContain('data-call-type="pon"');
    expect(html).toContain('data-call-type="ankan"');
    expect(html).toContain('data-call-type="kakan"');
    expect(html).toContain('data-face-down="true"');
    expect(html).toContain('data-stacked="true"');
  });

  it('多人荣和时分别展示每位和牌者的副露', () => {
    const base = createInitialGameState();
    const state: GameState = {
      ...base,
      players: base.players.map((player) => {
        if (player.id === 1) return { ...player, hand: hand([1, 2, 3, 10, 11, 12, 19, 20, 21, 13]), calls: [{ type: 'pon', tiles: hand([31, 31, 31]), from: 0, opened: true }] };
        if (player.id === 2) return { ...player, hand: hand([1, 2, 3, 10, 11, 12, 19, 20, 21, 14]), calls: [{ type: 'kan', kanType: 'minkan', tiles: hand([32, 32, 32, 32]), from: 0, opened: true }] };
        return player;
      }),
      result: {
        type: 'ron',
        winners: [
          { winner: 1, from: 0, winType: 'ron', winTile: createTile(13, 0), yaku: [{ name: '役牌·白', han: 1 }], han: 1, fu: 40, points: 1300, pointDeltas: [-1300, 1300, 0, 0] },
          { winner: 2, from: 0, winType: 'ron', winTile: createTile(14, 0), yaku: [{ name: '役牌·发', han: 1 }], han: 1, fu: 40, points: 1300, pointDeltas: [-1300, 0, 1300, 0] },
        ],
        pointDeltas: [-2600, 1300, 1300, 0],
      },
    };
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect((html.match(/class="result-melds"/g) ?? [])).toHaveLength(2);
    expect(html).toContain('data-call-type="pon"');
    expect(html).toContain('data-call-type="minkan"');
  });

  it('结果弹窗高度受视口限制，内容区可滚动且继续按钮固定在底部操作栏', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toContain('max-height: min(82dvh, 720px)');
    expect(css).toContain('.result-body');
    expect(css).toContain('overflow: auto');
    expect(css).toContain('.result-actions');
  });
});
