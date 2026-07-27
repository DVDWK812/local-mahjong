import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RiichiStick } from './RiichiStick';

describe('RiichiStick', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('未立直时保留透明槽位但不渲染立直棒SVG', () => {
    const html = renderToStaticMarkup(<RiichiStick orientation="horizontal" />);
    expect(html).toContain('riichi-stick-slot--horizontal');
    expect(html).toContain('data-active="false"');
    expect(html).not.toContain('class="riichi-stick"');
  });

  it('横向立直棒尺寸为168×10且红点居中', () => {
    const html = renderToStaticMarkup(<RiichiStick orientation="horizontal" active />);
    expect(html).toContain('viewBox="0 0 168 10"');
    expect(html).toContain('cx="84"');
    expect(html).toContain('cy="5"');
    expect(css).toContain('--riichi-stick-length: 168px');
    expect(css).toContain('--riichi-stick-thickness: 10px');
    expect(css).toContain('width: var(--riichi-stick-length)');
    expect(css).toContain('height: var(--riichi-stick-thickness)');
  });

  it('竖向立直棒尺寸为10×168且SVG填满槽位', () => {
    const html = renderToStaticMarkup(<RiichiStick orientation="vertical" active />);
    expect(html).toContain('viewBox="0 0 10 168"');
    expect(html).toContain('cx="5"');
    expect(html).toContain('cy="84"');
    expect(css).toContain('width: var(--riichi-stick-thickness)');
    expect(css).toContain('height: var(--riichi-stick-length)');
    expect(css).toContain('width: 100%');
    expect(css).toContain('height: 100%');
  });
});
