import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { MahjongTable } from '../components/game/MahjongTable';
import { createInitialGameState } from './engine';
import type { GameState } from './types';

function withRiichi(state: GameState, playerIndex: number): GameState {
  return {
    ...state,
    players: state.players.map((player, index) => index === playerIndex
      ? {
          ...player,
          riichi: true,
          riichiState: { declaredAtTurn: 3, ippatsuAvailable: true, kind: 'riichi' as const },
        }
      : player),
  };
}

describe('riichi visual state', () => {
  it('立直正式成立后显示一根立直棒', () => {
    const html = renderToStaticMarkup(createElement(MahjongTable, { gameState: withRiichi(createInitialGameState(), 0) }));
    expect((html.match(/class="riichi-stick"/g) ?? [])).toHaveLength(1);
    expect((html.match(/data-active="true"/g) ?? [])).toHaveLength(1);
  });

  it('立直声明尚未成立时不显示立直棒', () => {
    const state = createInitialGameState();
    const pendingLikeState: GameState = {
      ...state,
      players: state.players.map((player, index) => index === 0
        ? {
            ...player,
            riichi: false,
            riichiState: { declaredAtTurn: 3, ippatsuAvailable: true, kind: 'riichi' as const },
          }
        : player),
    };
    const html = renderToStaticMarkup(createElement(MahjongTable, { gameState: pendingLikeState }));
    expect(html).not.toContain('class="riichi-stick"');
  });

  it('本家和对家为水平立直棒，左右家为竖向立直棒', () => {
    const base = createInitialGameState();
    const html = renderToStaticMarkup(
      createElement(MahjongTable, {
        gameState: {
          ...base,
          players: base.players.map((player) => ({
            ...player,
            riichi: true,
            riichiState: { declaredAtTurn: 3, ippatsuAvailable: true, kind: 'riichi' as const },
          })),
        },
      }),
    );
    expect((html.match(/data-riichi-stick="horizontal"/g) ?? [])).toHaveLength(2);
    expect((html.match(/data-riichi-stick="vertical"/g) ?? [])).toHaveLength(2);
  });

  it('下一局初始状态不显示旧立直棒', () => {
    const html = renderToStaticMarkup(createElement(MahjongTable, { gameState: createInitialGameState() }));
    expect(html).not.toContain('class="riichi-stick"');
    expect((html.match(/data-active="false"/g) ?? [])).toHaveLength(4);
  });
});
