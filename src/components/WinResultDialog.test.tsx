import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import { createTile } from '../game/tileUtils';
import type { GameState, TileId } from '../game/types';
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

  it('结果弹窗高度受视口限制，内容区可滚动且继续按钮固定在底部操作栏', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toContain('max-height: min(82dvh, 720px)');
    expect(css).toContain('.result-body');
    expect(css).toContain('overflow: auto');
    expect(css).toContain('.result-actions');
  });
});
