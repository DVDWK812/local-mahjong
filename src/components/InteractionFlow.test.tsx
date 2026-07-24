import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import { createTile } from '../game/tileUtils';
import type { GameState, PlayerId, Tile, TileId } from '../game/types';
import { Board } from './Board';
import { Hand } from './Hand';
import { ScorePanel } from './ScorePanel';

function noop() {
  return undefined;
}

const boardHandlers = {
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

function setHumanHand(state: GameState, ids: TileId[]): GameState {
  const hand = tiles(ids);
  return {
    ...state,
    currentPlayer: 0,
    phase: 'discard',
    players: state.players.map((player) => player.id === 0 ? { ...player, hand, drawnTile: hand[hand.length - 1] ?? null, calls: [] } : player),
  };
}

describe('实战交互组件', () => {
  it('对局内侧栏不再显示常驻新对局按钮', () => {
    const html = renderToStaticMarkup(<ScorePanel gameState={createInitialGameState()} />);
    expect(html).not.toContain('新对局');
    expect(html).not.toContain('双立直');
    expect(html).not.toContain('九种九牌');
    expect(html).not.toContain('暗杠');
    expect(html).not.toContain('加杠');
  });

  it('摸入牌显示在最右侧并有明显间隔', () => {
    const state = setHumanHand(createInitialGameState(), [0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31, 32]);
    const html = renderToStaticMarkup(
      <Hand player={state.players[0]} isCurrent isLocal canDiscard onDiscard={noop} />,
    );
    expect(html).toContain('drawn-tile-gap');
    expect(html.lastIndexOf('drawn-tile-gap')).toBeGreaterThan(html.indexOf('一万'));
  });

  it('合法立直时弹出提示并展示弃牌选择', () => {
    const state = setHumanHand(createInitialGameState(), [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
    const html = renderToStaticMarkup(<Board gameState={state} {...boardHandlers} />);
    expect(html).toContain('可执行操作');
    expect(html).toContain('双立直');
    expect(html).toContain('打 ');
  });

  it('合法九种九牌时弹出提示', () => {
    const state = setHumanHand(createInitialGameState(), [0, 8, 9, 17, 18, 26, 27, 28, 31, 1, 2, 3, 4, 5]);
    const html = renderToStaticMarkup(<Board gameState={state} {...boardHandlers} />);
    expect(html).toContain('九种九牌');
    expect(html).toContain('跳过');
  });

  it('合法暗杠和加杠时弹出提示', () => {
    const ankan = setHumanHand(createInitialGameState(), [0, 0, 0, 0, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31]);
    expect(renderToStaticMarkup(<Board gameState={ankan} {...boardHandlers} />)).toContain('暗杠');

    const fourth = createTile(27, 3);
    const base = createInitialGameState();
    const kakan = {
      ...base,
      currentPlayer: 0 as PlayerId,
      phase: 'discard' as const,
      players: base.players.map((player) =>
        player.id === 0
          ? {
              ...player,
              hand: [fourth, ...tiles([1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20])],
              drawnTile: fourth,
              calls: [{ type: 'pon' as const, tiles: tiles([27, 27, 27]), from: 1 as PlayerId, opened: true }],
            }
          : player,
      ),
    };
    expect(renderToStaticMarkup(<Board gameState={kakan} {...boardHandlers} />)).toContain('加杠');
  });

  it('无合法动作时不弹窗', () => {
    const state = setHumanHand(createInitialGameState(), [1, 2, 4, 5, 7, 10, 12, 14, 16, 19, 21, 23, 25, 30]);
    const quiet = {
      ...state,
      players: state.players.map((player) => player.id === 0 ? { ...player, score: 900 } : player),
    };
    const html = renderToStaticMarkup(<Board gameState={quiet} {...boardHandlers} />);
    expect(html).not.toContain('可执行操作');
  });

  it('立直后不能选择其他手牌弃牌', () => {
    const state = setHumanHand(createInitialGameState(), [0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 31, 32]);
    const player = { ...state.players[0], riichi: true };
    const html = renderToStaticMarkup(
      <Hand player={player} isCurrent isLocal canDiscard allowedDiscardInstanceIds={[player.drawnTile?.instanceId ?? '']} onDiscard={noop} />,
    );
    const enabledButtons = html.match(/<button class="tile[^"]*" type="button"/g) ?? [];
    const disabledButtons = html.match(/disabled=""/g) ?? [];
    expect(enabledButtons.length - disabledButtons.length).toBe(1);
  });

  it('立直后可荣和时弹出荣和提示', () => {
    const state = {
      ...createInitialGameState(),
      phase: 'ron-window' as const,
      pendingRon: {
        discarder: 1 as PlayerId,
        tile: createTile(14, 0),
        eligibleRonPlayers: [0] as PlayerId[],
        passedPlayers: [] as PlayerId[],
      },
    };
    const html = renderToStaticMarkup(<Board gameState={state} {...boardHandlers} />);
    expect(html).toContain('可以荣和');
    expect(html).toContain('荣和');
    expect(html).toContain('跳过');
  });

  it('鸣牌提示打开时展示跳过以暂停流程', () => {
    const discarded = createTile(27, 0);
    const state = {
      ...createInitialGameState(),
      phase: 'call-window' as const,
      pendingCall: {
        discarder: 1 as PlayerId,
        tile: discarded,
        options: [{ type: 'pon' as const, player: 0 as PlayerId }],
      },
      players: createInitialGameState().players.map((player) =>
        player.id === 0 ? { ...player, hand: tiles([27, 27, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20]) } : player,
      ),
    };
    const html = renderToStaticMarkup(<Board gameState={state} {...boardHandlers} />);
    expect(html).toContain('可以鸣牌');
    expect(html).toContain('碰');
    expect(html).toContain('跳过');
  });
});
