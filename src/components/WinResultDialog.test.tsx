import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import { createTile } from '../game/tileUtils';
import type { CallSet, GameState, TileId, WinResultEntry } from '../game/types';
import { ResultDialog } from './ResultDialog';

function hand(ids: TileId[]) {
  return ids.map((id, index) => createTile(id, index % 4));
}

function win(overrides: Partial<WinResultEntry> = {}): WinResultEntry {
  return {
    winner: 1,
    from: 0,
    winType: 'ron',
    winTile: createTile(13, 0),
    yaku: [{ name: '断幺九', han: 1 }, { name: '平和', han: 1 }],
    han: 2,
    fu: 40,
    points: 2600,
    pointDeltas: [-2600, 2600, 0, 0],
    ...overrides,
  };
}

function stateWithWin(winEntry: WinResultEntry, overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState();
  return {
    ...base,
    players: base.players.map((player) => {
      if (player.id === winEntry.winner) {
        return {
          ...player,
          hand: hand([1, 2, 3, 10, 11, 12, 19, 20, 21, 13, 14, 15, 16]),
          ...(overrides.players?.[winEntry.winner] ?? {}),
        };
      }
      return overrides.players?.[player.id] ?? player;
    }),
    ...overrides,
    result: {
      type: winEntry.winType,
      winners: [winEntry],
      pointDeltas: winEntry.pointDeltas,
    },
  };
}

describe('ResultDialog win branch', () => {
  it('有副露和立直时按手牌、和牌张、副露、里宝牌四区显示', () => {
    const calls: CallSet[] = [
      { type: 'chi', tiles: hand([1, 2, 3]), from: 0, opened: true, sequence: [1, 2, 3], calledTile: createTile(2, 0), usedTileIds: [1, 3] },
      { type: 'kan', kanType: 'ankan', tiles: hand([31, 31, 31, 31]), from: 1, opened: false },
    ];
    const winEntry = win({ uraDora: 1, pointDeltas: [-2600, 2600, 0, 0] });
    const base = createInitialGameState();
    const state = stateWithWin(winEntry, {
      players: base.players.map((player) => player.id === 1 ? { ...player, hand: hand([1, 2, 3, 10, 11, 12, 13]), calls, riichi: true } : player),
    });
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    const handIndex = html.indexOf('result-concealed-hand');
    const winIndex = html.indexOf('result-winning-tile');
    const meldIndex = html.indexOf('result-melds');
    const uraIndex = html.indexOf('result-ura-dora');
    expect(handIndex).toBeGreaterThan(-1);
    expect(winIndex).toBeGreaterThan(handIndex);
    expect(meldIndex).toBeGreaterThan(winIndex);
    expect(uraIndex).toBeGreaterThan(meldIndex);
    expect(html).toContain('data-call-type="chi"');
    expect(html).toContain('data-call-type="ankan"');
    expect(html).toContain('data-sideways="true"');
    expect(html).toContain('data-face-down="true"');
  });

  it('无副露时隐藏副露区域，未立直时隐藏里宝牌区域', () => {
    const html = renderToStaticMarkup(<ResultDialog gameState={stateWithWin(win())} onReset={() => undefined} />);
    expect(html).not.toContain('result-melds');
    expect(html).not.toContain('result-ura-dora');
  });

  it('立直和牌时显示真实里宝牌指示牌图片', () => {
    const base = createInitialGameState();
    const state = stateWithWin(win({ uraDora: 1 }), {
      players: base.players.map((player) => player.id === 1 ? { ...player, hand: hand([1, 2, 3, 10, 11, 12, 19, 20, 21, 13, 14, 15, 16]), riichi: true } : player),
    });
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('result-ura-dora');
    expect(html).toContain('里宝牌');
    expect(html).toContain('tile-image');
  });

  it('宝牌、里宝牌、赤宝牌与合计直接显示 scoring result 字段', () => {
    const state = stateWithWin(win({ dora: 2, uraDora: 1, redDora: 1, totalDora: 4 }));
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toMatch(/宝牌 <strong>2<\/strong>/);
    expect(html).toMatch(/里宝牌 <strong>1<\/strong>/);
    expect(html).toMatch(/赤宝牌 <strong>1<\/strong>/);
    expect(html).toMatch(/合计 <strong>4<\/strong>/);
  });

  it('子家2番40符荣和直接显示 confirmed 得点与赢家 delta', () => {
    const state = stateWithWin(win({ pointDeltas: [-2600, 3600, 0, 0] }), { riichiSticks: 1, honba: 0 });
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('总番');
    expect(html).toContain('2番');
    expect(html).toContain('40符');
    expect(html).toContain('结果得点');
    expect(html).toContain('2,600');
    expect(html).toContain('本局点数变化');
    expect(html).toContain('+3,600');
  });

  it('庄家2番40符荣和显示 authoritative result points', () => {
    const state = stateWithWin(win({
      winner: 0,
      from: 1,
      pointDeltas: [3900, -3900, 0, 0],
    }), { riichiSticks: 0, honba: 0 });
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('结果得点');
    expect(html).toContain('3,900');
  });

  it('本场和供托只显示 confirmed 上下文，不在 UI 重新拆分付款', () => {
    const state = stateWithWin(win({ pointDeltas: [-2900, 3900, 0, 0] }), { riichiSticks: 1, honba: 1 });
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('本场 1 · 供托 1 根');
    expect(html).not.toContain('× 300点');
    expect(html).not.toContain('× 1000点');
    expect(html).toContain('+3,900');
  });

  it('自摸付款直接显示 confirmed 四家 pointDeltas', () => {
    const state = stateWithWin(win({
      from: null,
      winType: 'tsumo',
      pointDeltas: [-2700, 5300, -1300, -1300],
    }), { honba: 1, riichiSticks: 0 });
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('+5,300');
    expect(html).toContain('-2,700');
    expect((html.match(/-1,300/g) ?? [])).toHaveLength(2);
    expect(html).toContain('最终支付以点数变化为准');
  });

  it('达到满贯以上时在算分最开始显示大红字等级', () => {
    const state = stateWithWin(win({
      han: 5,
      fu: 40,
      points: 8000,
      limitTier: 'mangan',
      pointDeltas: [-8000, 8000, 0, 0],
    }));
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('class="result-limit-label"');
    expect(html.indexOf('满贯')).toBeLessThan(html.indexOf('合计'));
  });

  it('结果页逐项采用 authoritative pointDeltas，不在 UI 补造立直棒扣款', () => {
    const base = createInitialGameState();
    const state = stateWithWin(win({
      winner: 0,
      from: 2,
      han: 5,
      fu: 40,
      points: 9000,
      pointDeltas: [9000, 0, -8000, 0],
    }), {
      riichiSticks: 1,
      players: base.players.map((player) => player.id === 1 ? { ...player, riichi: true } : player),
    });
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect(html).toContain('结果得点');
    expect(html).toContain('9,000');
    expect(html).toContain('+9,000');
    expect(html).toContain('-8,000');
    expect(html).not.toContain('-1,000');
  });

  it('结果弹窗加宽且正文滚动，1366宽度下不会横向溢出', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toContain('width: min(1040px, calc(100vw - 24px))');
    expect(css).toContain('max-height: min(92dvh, 860px)');
    expect(css).toContain('.result-body');
    expect(css).toContain('overflow: auto');
    expect(css).toContain('.result-tile-sections');
    expect(css).toContain('flex-wrap: wrap');
    expect(css).toContain('@media (max-height: 760px)');
    expect(css).toContain('.test-mode-session .result-backdrop');
    expect(css).toContain('inset: var(--test-mode-toolbar-height) 0 0');
  });
});
