import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PlayerId } from '../game/types';
import { getBuiltInTestScenario } from '../game/testMode/builtInScenarios';
import { loadTestScenarioState } from '../game/testMode/scenario';
import { Board } from './Board';

const noop = () => undefined;

describe('测试模式固定牌桌视角', () => {
  it('四家视角依次切换时桌面公开元素不旋转，切回原视角后DOM与状态一致', () => {
    const scenario = getBuiltInTestScenario('STAB-001-KAKAN')!;
    const gameState = loadTestScenarioState(scenario);
    const originalState = JSON.parse(JSON.stringify(gameState));
    const views = ([0, 1, 2, 3, 0] as PlayerId[]).map((playerId) => renderBoard(gameState, playerId));
    const fixedTables = views.map((html) => sliceBetween(html, '<section class="mahjong-table"', '<section class="local-hand-area'));
    const fixedIdentities = views.map((html) => sliceBetween(html, '<div class="local-hand-info', '<div class="local-hand-track'));
    const visibleHands = views.slice(0, 4).map((html) => sliceBetween(html, '<div class="local-hand-row">', '<div class="local-meld-track"'));

    fixedTables.forEach((table) => expect(table).toBe(fixedTables[0]));
    fixedIdentities.forEach((identity) => expect(identity).toBe(fixedIdentities[0]));
    expect(fixedTables[0]).toMatch(/data-player-slot="top"[^>]*data-player-index="2"/);
    expect(fixedTables[0]).toMatch(/data-player-slot="right"[^>]*data-player-index="1"/);
    expect(fixedTables[0]).toMatch(/data-player-slot="bottom"[^>]*data-player-index="0"/);
    expect(fixedTables[0]).toMatch(/data-player-slot="left"[^>]*data-player-index="3"/);
    expect(fixedTables[0]).toMatch(/data-river-player="2"[\s\S]*data-river-player="1"[\s\S]*data-river-player="0"[\s\S]*data-river-player="3"/);
    expect(new Set(visibleHands).size).toBeGreaterThan(1);
    ([0, 1, 2, 3] as PlayerId[]).forEach((playerId, index) => expect(views[index]).toContain(`data-local-player="${playerId}"`));
    expect(views[4]).toBe(views[0]);
    expect(gameState).toEqual(originalState);
  });
});

function renderBoard(gameState: ReturnType<typeof loadTestScenarioState>, controlledPlayerId: PlayerId): string {
  return renderToStaticMarkup(
    <Board
      gameState={gameState}
      controlledPlayerId={controlledPlayerId}
      tableBottomPlayerId={0}
      onDiscard={noop}
      onTsumo={noop}
      onRon={noop}
      onPassRon={noop}
      onDeclareRiichi={noop}
      onDeclareKyuushuKyuuhai={noop}
      onPon={noop}
      onChi={noop}
      onKan={noop}
      onChankanRon={noop}
      onPassChankan={noop}
      onPassCall={noop}
      onSkipDrawActions={noop}
      onReset={noop}
    />,
  );
}

function sliceBetween(value: string, start: string, end: string): string {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return value.slice(startIndex, endIndex);
}
