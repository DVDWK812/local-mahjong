import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WinResultPresentationController } from '../audio/voice/WinResultPresentationController';
import { SettlementPresentationCoordinator } from '../audio/voice/SettlementPresentationCoordinator';
import type { WinSequenceSignal } from '../audio/voice/VoiceDirector';
import type { WinVoiceSequence } from '../audio/voice/winVoiceSequence';
import { createInitialGameState } from '../game/engine';
import { createTile } from '../game/tileUtils';
import type { GameState, WinResultEntry } from '../game/types';
import { ResultDialog } from './ResultDialog';

function fixture() {
  let listener: ((signal: WinSequenceSignal) => void) | undefined;
  const source = { subscribeWinSequence(next: (signal: WinSequenceSignal) => void) { listener = next; return () => { listener = undefined; }; } };
  return { controller: new WinResultPresentationController(source, 1), emit: (signal: WinSequenceSignal) => listener?.(signal) };
}

function gameState(): GameState {
  const base = createInitialGameState();
  const win: WinResultEntry = {
    winner: 1, from: 0, winType: 'ron', winTile: createTile(13, 0),
    yaku: [{ id: 'riichi', name: '立直', han: 1 }], han: 1, fu: 30, points: 1000, pointDeltas: [-1000, 1000, 0, 0],
  };
  return { ...base, result: { type: 'ron', winners: [win], pointDeltas: win.pointDeltas } };
}

function sequence(): WinVoiceSequence {
  return {
    id: 'stream', winnerId: 1,
    items: [
      { kind: 'win-action', voiceKey: 'action.ron', actorId: 1, displayLabel: '荣和' },
      { kind: 'yaku', voiceKey: 'yaku.riichi', actorId: 1, yakuId: 'riichi', han: 1, displayLabel: '立直' },
    ],
  };
}

describe('ResultDialog streamed win presentation', () => {
  it('尚未收到 sequence 时仍立即保留赢家、手牌和和牌张，而非只显示等待文字', () => {
    const { controller } = fixture();
    const coordinator = new SettlementPresentationCoordinator(controller, 5000, 300);
    coordinator.begin({ id: 'initial', result: gameState().result!, playerIds: [0, 1, 2, 3], scoreAfter: [24000, 26000, 25000, 25000] });
    const html = renderToStaticMarkup(<ResultDialog gameState={gameState()} onReset={() => undefined} winPresentationController={controller} settlementPresentationCoordinator={coordinator} />);
    expect(html).toContain('result-concealed-hand');
    expect(html).toContain('result-winning-tile');
    expect(html).toContain('荣和');
    expect(html).not.toContain('正在开始和牌结算演出');
  });

  it('只显示已经 itemStarted 的项目，sequenceCompleted 前不显示最终番符点数', () => {
    const { controller, emit } = fixture(); const win = sequence();
    emit({ type: 'sequenceStarted', sequence: win, packId: 'xiaozhang' });
    emit({ type: 'itemStarted', sequence: win, item: win.items[0], index: 0, packId: 'xiaozhang' });
    const html = renderToStaticMarkup(<ResultDialog gameState={gameState()} onReset={() => undefined} winPresentationController={controller} />);
    expect(html).toContain('result-presentation-list');
    expect(html).toContain('荣和');
    expect(html).toContain('役种播报中…');
    expect(html).not.toContain('1番30符');
    expect(html).not.toContain('>立直<');
  });

  it('事件在 ResultDialog mount 前发生时，从持久 snapshot 重放已开始的役种', () => {
    const { controller, emit } = fixture(); const win = sequence();
    emit({ type: 'sequenceStarted', sequence: win, packId: 'xiaozhang' });
    emit({ type: 'itemStarted', sequence: win, item: win.items[0], index: 0, packId: 'xiaozhang' });
    emit({ type: 'itemCompleted', sequence: win, item: win.items[0], index: 0, packId: 'xiaozhang', status: 'played' });
    emit({ type: 'itemStarted', sequence: win, item: win.items[1], index: 1, packId: 'xiaozhang' });
    const html = renderToStaticMarkup(<ResultDialog gameState={gameState()} onReset={() => undefined} winPresentationController={controller} />);
    expect(html).toContain('>立直<');
    expect(html).toContain('1番');
    expect(html).not.toContain('役种播报中…');
  });

  it('sequenceCompleted 后恢复完整既有结算数据', () => {
    const { controller, emit } = fixture(); const win = sequence();
    emit({ type: 'sequenceStarted', sequence: win, packId: 'xiaozhang' });
    win.items.forEach((item, index) => {
      emit({ type: 'itemStarted', sequence: win, item, index, packId: 'xiaozhang' });
      emit({ type: 'itemCompleted', sequence: win, item, index, packId: 'xiaozhang', status: 'played' });
    });
    emit({ type: 'sequenceCompleted', sequence: win, packId: 'xiaozhang', status: 'completed' });
    const html = renderToStaticMarkup(<ResultDialog gameState={gameState()} onReset={() => undefined} winPresentationController={controller} />);
    expect(html).toContain('总番');
    expect(html).toContain('1番');
    expect(html).toContain('30符');
    expect(html).toContain('结果得点');
    expect(html).toContain('1,000');
  });

  it('Stage 2 使用权威 delta 显示 before → delta → after，并仅显示 active players', () => {
    vi.useFakeTimers();
    const { controller } = fixture();
    const coordinator = new SettlementPresentationCoordinator(controller, 5000, 1);
    const state = gameState();
    const settled = { ...state, players: state.players.map((player) => player.id === 0 ? { ...player, score: 24000 } : player.id === 1 ? { ...player, score: 26000 } : player) };
    coordinator.begin({ id: 'points', result: settled.result!, playerIds: [0, 1], scoreAfter: settled.players.map((player) => player.score) });
    coordinator.continue();
    vi.advanceTimersByTime(1);
    const html = renderToStaticMarkup(<ResultDialog gameState={settled} onReset={() => undefined} winPresentationController={controller} settlementPresentationCoordinator={coordinator} />);
    expect(html).toContain('点棒结算');
    expect(html).toContain('25,000');
    expect(html).toContain('-1,000');
    expect(html).toContain('+1,000');
    expect(html).toContain('26,000');
    expect(html).not.toContain('Player 3');
    vi.useRealTimers();
  });

  it('Stage 1 只根据 result.winners 渲染赢家卡，不泄露未和牌玩家的手牌', () => {
    const base = gameState();
    const wins: WinResultEntry[] = [
      base.result!.type === 'ron' || base.result!.type === 'tsumo' ? base.result!.winners[0] : (() => { throw new Error('fixture must win'); })(),
      { ...((base.result!.type === 'ron' || base.result!.type === 'tsumo') ? base.result!.winners[0] : (() => { throw new Error('fixture must win'); })()), winner: 2, from: 0, pointDeltas: [-2000, 1000, 1000, 0] },
    ];
    const state: GameState = {
      ...base,
      players: base.players.map((player, id) => ({ ...player, name: ['放铳者', '赢家甲', '赢家乙', '旁观者'][id] })),
      result: { type: 'ron', winners: wins, pointDeltas: [-2000, 1000, 1000, 0] },
    };
    const html = renderToStaticMarkup(<ResultDialog gameState={state} onReset={() => undefined} />);
    expect((html.match(/result-card-title/g) ?? [])).toHaveLength(2);
    expect(html).toContain('赢家甲');
    expect(html).toContain('赢家乙');
    expect(html).not.toContain('放铳者 手牌');
    expect(html).not.toContain('旁观者 手牌');
  });
});
