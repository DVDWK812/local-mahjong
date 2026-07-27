import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
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
  return ids.map((id, index) => createTile(id, index));
}

function callWindowWithRedFive(): GameState {
  const discarded = createTile(13, 99);
  discarded.red = true;
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
        { type: 'chi', player: 0 as PlayerId, sequence: [12, 13, 14], usedTileIds: [12, 14] },
      ],
    },
    players: base.players.map((player) => player.id === 0 ? {
      ...player,
      hand: tiles([13, 13, 13, 12, 14, 0, 2, 5, 7, 9, 18, 22, 31]),
    } : player),
  };
}

function callOptionSegments(html: string): string[] {
  const segments: string[] = [];
  let cursor = 0;
  while (true) {
    const start = html.indexOf('<button type="button" class="call-option-button"', cursor);
    if (start === -1) return segments;
    const end = html.indexOf('</button>', start);
    segments.push(html.slice(start, end + '</button>'.length));
    cursor = end + '</button>'.length;
  }
}

describe('鸣牌提示点击范围', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('吃碰杠候选均由外层按钮承接点击，内部牌图不是按钮', () => {
    const html = renderToStaticMarkup(<Board gameState={callWindowWithRedFive()} {...handlers} />);
    const segments = callOptionSegments(html);

    expect(segments).toHaveLength(3);
    segments.forEach((segment) => {
      expect(segment).toContain('call-option-tiles');
      expect(segment).toContain('tile-image');
      expect(segment.match(/<button/g)).toHaveLength(1);
      expect(segment).not.toContain('disabled=""');
    });
    expect(css).toContain('.call-option-button .tile');
    expect(css).toContain('pointer-events: none');
  });

  it('黄色描边牌和候选空白区域都属于同一个候选按钮', () => {
    const html = renderToStaticMarkup(<Board gameState={callWindowWithRedFive()} {...handlers} />);
    const segments = callOptionSegments(html);

    expect(segments.some((segment) => segment.includes('call-option-tile--called'))).toBe(true);
    expect(css).toContain('outline: 3px solid #e2b93b');
    expect(css).toContain('.call-option-button {');
    expect(css).toContain('cursor: pointer');
  });

  it('可以鸣牌标题后显示真实弃牌图，赤牌提示显示赤牌标记', () => {
    const html = renderToStaticMarkup(<Board gameState={callWindowWithRedFive()} {...handlers} />);

    expect(html).toContain('aria-label="可以鸣牌：赤五筒"');
    expect(html).toContain('action-prompt-title-with-tile');
    expect(html).toContain('action-prompt-title-tile');
    expect(html).toContain('tile-red-badge');
    expect(html).toContain('跳过');
  });
});
