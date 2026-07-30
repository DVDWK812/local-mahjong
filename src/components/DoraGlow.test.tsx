import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { callToMeldDisplayModel } from '../game/meldDisplayAdapter';
import { createTile } from '../game/tileUtils';
import type { CallSet } from '../game/types';
import { DoraIndicator } from './DoraIndicator';
import { MeldDisplay } from './MeldDisplay';
import { Tile } from './Tile';

const indicatorForFiveMan = createTile(3, 0);
const indicatorForSevenMan = createTile(5, 0);

function redFiveMan() {
  return { ...createTile(4, 0), red: true };
}

function frameCount(html: string): number {
  return html.match(/tile-dora-frame/g)?.length ?? 0;
}

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

describe('宝牌与赤宝牌闪光', () => {
  it('普通宝牌显示金色发光框且不显示文字角标', () => {
    const html = renderToStaticMarkup(
      <Tile tile={createTile(6, 0)} doraIndicators={[indicatorForSevenMan]} doraGlowEnabled />,
    );
    expect(html).toContain('tile--dora');
    expect(html).toContain('tile-face');
    expect(html).toContain('tile-dora-frame');
    expect(frameCount(html)).toBe(1);
    expect(html).not.toContain('tile-dora-corner-badge');
    expect(html).not.toContain('>宝</span>');
    expect(html).not.toContain('tile--red-dora');
    expect(html).not.toContain('tile--double-dora');
  });

  it('赤五显示赤宝牌发光框且不显示文字角标', () => {
    const html = renderToStaticMarkup(
      <Tile tile={redFiveMan()} doraIndicators={[]} doraGlowEnabled />,
    );
    expect(html).toContain('tile--red-dora');
    expect(html).toContain('tile-dora-frame');
    expect(frameCount(html)).toBe(1);
    expect(html).not.toContain('tile-dora-corner-badge');
    expect(html).not.toContain('>赤</span>');
    expect(html).not.toContain('tile--double-dora');
  });

  it('赤五同时为普通宝牌时显示增强发光框且不重复显示角标', () => {
    const html = renderToStaticMarkup(
      <Tile tile={redFiveMan()} doraIndicators={[indicatorForFiveMan]} doraGlowEnabled />,
    );
    expect(html).toContain('tile--double-dora');
    expect(html).toContain('tile-dora-frame');
    expect(frameCount(html)).toBe(1);
    expect(html).not.toContain('tile-dora-corner-badge');
    expect(html).not.toContain('>赤宝</span>');
    expect(html).not.toContain('>宝</span>');
    expect(html).not.toContain('>赤</span>');
    expect(html).not.toContain('tile--red-dora');
    expect(html).not.toContain('tile--dora ');
  });

  it('宝牌指示牌本身不会被错误标记为宝牌闪光', () => {
    const html = renderToStaticMarkup(<DoraIndicator indicators={[indicatorForFiveMan]} />);
    expect(html).not.toContain('tile--dora');
    expect(html).not.toContain('tile--red-dora');
    expect(html).not.toContain('tile--double-dora');
    expect(html).not.toContain('tile-dora-frame');
    expect(html).not.toContain('tile-dora-corner-badge');
  });

  it('对手暗牌牌背不显示闪光', () => {
    const html = renderToStaticMarkup(
      <Tile tile={redFiveMan()} faceDown doraIndicators={[indicatorForFiveMan]} doraGlowEnabled />,
    );
    expect(html).not.toContain('tile--dora');
    expect(html).not.toContain('tile--red-dora');
    expect(html).not.toContain('tile--double-dora');
    expect(html).not.toContain('tile-dora-frame');
    expect(html).not.toContain('tile-dora-corner-badge');
  });

  it('关闭设置后不输出任何闪光类名或发光层', () => {
    const html = renderToStaticMarkup(
      <Tile tile={redFiveMan()} doraIndicators={[indicatorForFiveMan]} doraGlowEnabled={false} />,
    );
    expect(html).not.toContain('tile--dora');
    expect(html).not.toContain('tile--red-dora');
    expect(html).not.toContain('tile--double-dora');
    expect(html).not.toContain('tile-dora-frame');
    expect(html).not.toContain('tile-dora-corner-badge');
    expect(html).toContain('tile-red-badge');
  });

  it('副露展示继承闪光且不产生嵌套 button', () => {
    const call: CallSet = {
      type: 'pon',
      tiles: [redFiveMan(), createTile(4, 1), createTile(4, 2)],
      from: 2,
      opened: true,
      calledTile: redFiveMan(),
    };
    const html = renderToStaticMarkup(
      <MeldDisplay meld={callToMeldDisplayModel(call, 0)} doraIndicators={[indicatorForFiveMan]} doraGlowEnabled />,
    );
    expect(html).toContain('tile--double-dora');
    expect(html).toContain('tile-dora-frame');
    expect(html).not.toContain('tile-dora-corner-badge');
    expect(html).not.toContain('<button');
  });

  it('横置宝牌的发光框作为牌面子层随牌一起旋转', () => {
    const html = renderToStaticMarkup(
      <Tile tile={createTile(6, 0)} sideways doraIndicators={[indicatorForSevenMan]} doraGlowEnabled />,
    );
    expect(html).toContain('tile--sideways');
    expect(html).toContain('tile-face');
    expect(html).toContain('tile-dora-frame');
  });

  it('发光框绑定在实际牌面容器上且不使用固定宽高', () => {
    const css = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8');
    const tileRule = cssRule(css, '.tile');
    const faceRule = cssRule(css, '.tile-face');
    const frameRule = cssRule(css, '.tile-dora-frame');

    expect(tileRule).toContain('--dora-frame-inset:');
    expect(tileRule).toContain('--dora-frame-width:');
    expect(tileRule).toContain('--dora-frame-radius:');
    expect(faceRule).toContain('position: relative');
    expect(faceRule).toContain('border-radius: var(--dora-frame-radius)');
    expect(frameRule).toContain('position: absolute');
    expect(frameRule).toContain('inset: var(--dora-frame-inset)');
    expect(frameRule).toContain('box-sizing: border-box');
    expect(frameRule).toContain('border-radius: inherit');
    expect(frameRule).toContain('pointer-events: none');
    expect(frameRule).not.toContain('width:');
    expect(frameRule).not.toContain('height:');
    expect(css).not.toContain('tile-dora-corner-badge');
  });
});
