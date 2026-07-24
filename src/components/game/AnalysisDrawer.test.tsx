import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { AnalysisDrawer } from './AnalysisDrawer';

describe('AnalysisDrawer', () => {
  it('默认关闭但保留抽屉结构', () => {
    const html = renderToStaticMarkup(<AnalysisDrawer open={false} gameState={createInitialGameState()} onClose={() => undefined} />);
    expect(html).toContain('analysis-drawer');
    expect(html).not.toContain('analysis-drawer--open');
    expect(html).toContain('aria-hidden="true"');
  });

  it('打开后显示向听、有效牌、推荐内容和牌数统计', () => {
    const html = renderToStaticMarkup(<AnalysisDrawer open gameState={createInitialGameState()} onClose={() => undefined} />);
    expect(html).toContain('analysis-drawer--open');
    expect(html).toContain('向听数');
    expect(html).toContain('有效牌');
    expect(html).toContain('推荐打牌 Top 3');
    expect(html).toContain('牌数统计');
    expect(html).toContain('关闭');
  });
});
