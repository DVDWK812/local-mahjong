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

  it('同时显示吃、碰、大明杠和跳过', () => {
    const html = renderToStaticMarkup(<Board gameState={withHumanCallWindow()} {...handlers} />);
    expect(html).toContain('aria-label="大明杠');
    expect(html).toContain('aria-label="碰');
    expect(html).toContain('aria-label="吃');
    expect(html).toContain('跳过');
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
  });
});
