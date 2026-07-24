import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import { AnalysisPanel } from './AnalysisPanel';
import { TileCounter } from './TileCounter';

describe('牌理分析和牌数统计贴图显示', () => {
  it('推荐打牌和有效牌区域使用贴图牌', () => {
    const html = renderToStaticMarkup(<AnalysisPanel gameState={createInitialGameState()} />);
    expect(html).toContain('推荐打牌 Top 3');
    expect(html).toContain('<img');
    expect(html).toContain('recommend-tile-title');
  });

  it('牌数统计区域 34 种牌均使用贴图牌', () => {
    const html = renderToStaticMarkup(<TileCounter gameState={createInitialGameState()} />);
    expect(html).toContain('牌数统计');
    expect(html).toContain('剩余');
    expect(html).not.toContain('可见 / 剩余');
    expect((html.match(/<img/g) ?? [])).toHaveLength(34);
    expect(html).not.toContain('<b>1m</b>');
  });
});
