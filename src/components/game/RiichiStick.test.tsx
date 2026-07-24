import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RiichiStick } from './RiichiStick';

describe('RiichiStick', () => {
  it('未立直时保留透明槽位但不渲染立直棒SVG', () => {
    const html = renderToStaticMarkup(<RiichiStick orientation="horizontal" />);
    expect(html).toContain('riichi-stick-slot--horizontal');
    expect(html).toContain('data-active="false"');
    expect(html).not.toContain('class="riichi-stick"');
  });

  it('水平立直棒使用原创SVG并带红色圆点', () => {
    const html = renderToStaticMarkup(<RiichiStick orientation="horizontal" active />);
    expect(html).toContain('riichi-stick-slot--active');
    expect(html).toContain('viewBox="0 0 120 16"');
    expect(html).toContain('fill="#d23b32"');
  });

  it('竖向立直棒使用竖向槽位', () => {
    const html = renderToStaticMarkup(<RiichiStick orientation="vertical" active />);
    expect(html).toContain('riichi-stick-slot--vertical');
    expect(html).toContain('data-riichi-stick="vertical"');
  });
});
