import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createMatch } from '../../game/match/matchEngine';
import { buildDoraIndicatorSlots } from '../../presentation/table/TablePresentationContract';
import { DoraIndicatorStack } from './DoraIndicatorStack';

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  const end = css.indexOf('}', start);
  return start === -1 ? '' : css.slice(start, end);
}

describe('DoraIndicatorStack', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('左上角显示 5 个宝牌指示牌槽，初始只有第 1 张正面', () => {
    const state = createInitialGameState();
    const html = renderToStaticMarkup(<DoraIndicatorStack gameState={state} matchState={createMatch()} />);
    expect(html).toContain('宝牌指示牌');
    expect((html.match(/class="dora-indicator-slot"/g) ?? [])).toHaveLength(5);
    expect((html.match(/data-dora-open="true"/g) ?? [])).toHaveLength(1);
    expect((html.match(/data-dora-open="false"/g) ?? [])).toHaveLength(4);
  });

  it('宝牌区下方显示当前局数、本场和供托', () => {
    const state = { ...createInitialGameState(), honba: 2, riichiSticks: 1 };
    const match = { ...createMatch(), handNumber: 3 as const };
    const html = renderToStaticMarkup(<DoraIndicatorStack gameState={state} matchState={match} />);
    expect(html).toContain('东3局　2本场');
    expect(html).toContain('供托1');
  });

  it('根据真实 doraIndicators 数量依次翻开，最多显示 5 张', () => {
    const state = createInitialGameState();
    const threeOpen = { ...state, doraIndicators: state.deadWall.slice(0, 3) };
    const allOpen = { ...state, doraIndicators: state.deadWall.slice(0, 6) };
    const threeHtml = renderToStaticMarkup(<DoraIndicatorStack gameState={threeOpen} />);
    const allHtml = renderToStaticMarkup(<DoraIndicatorStack gameState={allOpen} />);
    expect((threeHtml.match(/data-dora-open="true"/g) ?? [])).toHaveLength(3);
    expect((threeHtml.match(/data-dora-open="false"/g) ?? [])).toHaveLength(2);
    expect((allHtml.match(/data-dora-open="true"/g) ?? [])).toHaveLength(5);
  });

  it('被抢杠取消且状态未增加指示牌时不会翻开新牌', () => {
    const state = createInitialGameState();
    const chankanCancelled = { ...state, doraIndicators: [...state.doraIndicators] };
    const html = renderToStaticMarkup(<DoraIndicatorStack gameState={chankanCancelled} />);
    expect((html.match(/data-dora-open="true"/g) ?? [])).toHaveLength(1);
    expect((html.match(/data-dora-open="false"/g) ?? [])).toHaveLength(4);
  });

  it('consumes the shared renderer-neutral Dora slots without changing the 2.5D structure', () => {
    const state = createInitialGameState();
    const slots = buildDoraIndicatorSlots(state.doraIndicators);
    const html = renderToStaticMarkup(<DoraIndicatorStack gameState={state} slots={slots} />);

    expect((html.match(/data-dora-state="revealed"/g) ?? [])).toHaveLength(1);
    expect((html.match(/data-dora-state="hidden"/g) ?? [])).toHaveLength(4);
    expect((html.match(/class="dora-indicator-slot"/g) ?? [])).toHaveLength(5);
  });
  it('keeps dora face tiles and back tiles fully opaque', () => {
    const state = createInitialGameState();
    const html = renderToStaticMarkup(<DoraIndicatorStack gameState={state} matchState={createMatch()} />);
    const doraTileRule = cssRule(css, '.dora-indicator-stack .tile');
    const doraImageRule = cssRule(css, '.dora-indicator-stack .tile-image');
    expect(html).toContain('data-dora-open="true"');
    expect(html).toContain('data-dora-open="false"');
    expect(doraTileRule).toContain('opacity: 1');
    expect(doraTileRule).toContain('filter: none');
    expect(doraTileRule).toContain('mix-blend-mode: normal');
    expect(doraImageRule).toContain('opacity: 1');
    expect(doraImageRule).toContain('filter: none');
  });
});
