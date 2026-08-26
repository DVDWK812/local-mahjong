import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import { createTile } from '../game/tileUtils';
import type { GameState, PlayerId, Tile, TileId } from '../game/types';
import { Board } from './Board';

function noop() {
  return undefined;
}

const handlers = {
  onDiscard: noop,
  onTsumo: noop,
  onRon: noop,
  onPassRon: noop,
  onDeclareRiichi: noop,
  onDeclareKyuushuKyuuhai: noop,
  onPon: noop,
  onChi: noop,
  onKan: noop,
  onChankanRon: noop,
  onPassChankan: noop,
  onPassCall: noop,
  onSkipDrawActions: noop,
  onReset: noop,
};

function tiles(ids: TileId[]): Tile[] {
  return ids.map((id, index) => createTile(id, index % 4));
}

function withHumanCallWindow(): GameState {
  const discarded = createTile(12, 3);
  const base = createInitialGameState();
  return {
    ...base,
    phase: 'call-window',
    pendingCall: {
      discarder: 3 as PlayerId,
      tile: discarded,
      options: [
        { type: 'kan', kanType: 'minkan', player: 0 as PlayerId },
        { type: 'pon', player: 0 as PlayerId },
        { type: 'chi', player: 0 as PlayerId, sequence: [12, 13, 14], usedTileIds: [13, 14] },
      ],
    },
    players: base.players.map((player) => player.id === 0 ? {
      ...player,
      hand: tiles([12, 12, 12, 13, 14, 0, 2, 5, 7, 9, 18, 22, 31]),
    } : player),
  };
}

function withOnlyHumanChi(): GameState {
  const state = withHumanCallWindow();
  return {
    ...state,
    pendingCall: state.pendingCall ? {
      ...state.pendingCall,
      options: state.pendingCall.options.filter((option) => option.type === 'chi'),
    } : null,
    players: state.players.map((player) => player.id === 0 ? {
      ...player,
      hand: tiles([13, 14, 0, 2, 5, 7, 9, 18, 19, 22, 25, 29, 31]),
    } : player),
  };
}

function withPonAndKan(): GameState {
  const state = withHumanCallWindow();
  return {
    ...state,
    pendingCall: state.pendingCall ? {
      ...state.pendingCall,
      options: state.pendingCall.options.filter((option) => option.type !== 'chi'),
    } : null,
  };
}

function withHumanDrawPrompt(): GameState {
  const base = createInitialGameState();
  const drawnTile = createTile(4, 0);
  drawnTile.red = true;
  return {
    ...base,
    phase: 'discard',
    currentPlayer: 0,
    players: base.players.map((player) => player.id === 0 ? {
      ...player,
      hand: [...tiles([0, 1, 2, 3, 5, 9, 10, 11, 18, 19, 20, 31, 31]), drawnTile],
      drawnTile,
    } : player),
  };
}

function withHumanRonPrompt(): GameState {
  const base = createInitialGameState();
  return {
    ...base,
    phase: 'ron-window',
    pendingRon: {
      discarder: 1 as PlayerId,
      tile: createTile(32, 0),
      eligibleRonPlayers: [0 as PlayerId],
      passedPlayers: [],
    },
  };
}

describe('ActionPrompt 鸣牌与和牌提示', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('同时显示吃、碰、明杠和跳过', () => {
    const html = renderToStaticMarkup(<Board gameState={withHumanCallWindow()} {...handlers} />);
    expect(html).toContain('aria-label="明杠');
    expect(html).toContain('aria-label="碰');
    expect(html).toContain('aria-label="吃');
    expect(html).toContain('跳过');
    expect(html).toContain('data-operation-area="stable"');
    expect(html).toContain('data-operation="kan"');
    expect(html).toContain('data-operation="pon"');
    expect(html).toContain('data-operation="chi"');
    expect(html).toContain('data-operation="pass"');
  });

  it('鸣牌候选使用横向牌图并突出被叫牌', () => {
    const html = renderToStaticMarkup(<Board gameState={withHumanCallWindow()} {...handlers} />);
    expect(html).toContain('call-option-tiles');
    expect(html).toContain('tile-image');
    expect(html).toContain('call-option-tile--called');
    expect(html).toContain('data-called="true"');
    expect(css).toContain('.call-option-tiles');
    expect(css).toContain('flex-direction: row');
    expect(css).toContain('flex-wrap: nowrap');
    expect(css).toContain('outline: 3px solid #e2b93b');
  });

  it('自摸和立直候选使用真实牌图', () => {
    const html = renderToStaticMarkup(<Board gameState={withHumanDrawPrompt()} {...handlers} />);
    expect(html).toContain('prompt-tile-action');
    expect(html).toContain('aria-label="自摸');
    expect(html).toContain('tile-image');
  });

  it('荣和提示使用真实牌图', () => {
    const html = renderToStaticMarkup(<Board gameState={withHumanRonPrompt()} {...handlers} />);
    expect(html).toContain('prompt-tile-action');
    expect(html).toContain('aria-label="荣和');
    expect(html).toContain('tile-image');
    expect(html).toContain('data-operation="win"');
    expect(html).toContain('data-operation="pass"');
    expect(html.indexOf('data-operation="win"')).toBeLessThan(html.indexOf('data-operation="pass"'));
  });

  it('仅可吃时不显示碰或杠，跳过仍固定保留', () => {
    const html = renderToStaticMarkup(<Board gameState={withOnlyHumanChi()} {...handlers} />);
    expect(html).toContain('data-operation="chi"');
    expect(html).toContain('data-operation="pass"');
    expect(html).not.toContain('data-operation="pon"');
    expect(html).not.toContain('data-operation="kan"');
  });

  it('同时可碰与杠时维持杠、碰、跳过的稳定分组', () => {
    const html = renderToStaticMarkup(<Board gameState={withPonAndKan()} {...handlers} />);
    expect(html).toContain('data-operation="kan"');
    expect(html).toContain('data-operation="pon"');
    expect(html).toContain('data-operation="pass"');
    expect(html).not.toContain('data-operation="chi"');
  });

  it('操作类型使用固定视觉顺序，和牌突出且跳过保持末位', () => {
    expect(css).toMatch(/\.operation-button--win,[\s\S]*?order: 10/);
    expect(css).toMatch(/\.operation-button--riichi,[\s\S]*?order: 20/);
    expect(css).toMatch(/\.operation-button--kan,[\s\S]*?order: 30/);
    expect(css).toMatch(/\.operation-button--pon,[\s\S]*?order: 40/);
    expect(css).toMatch(/\.operation-button--chi,[\s\S]*?order: 50/);
    expect(css).toMatch(/\.action-prompt \.operation-button--pass,[\s\S]*?order: 100/);
    expect(css).toMatch(/\.action-prompt \.operation-button--win,[\s\S]*?min-height: 42px[\s\S]*?border: 2px solid/);
    expect(css).toContain('grid-template-columns: clamp(96px, 10vw, 140px) minmax(0, 1fr)');
  });
});
