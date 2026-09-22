import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createTile } from '../game/tileUtils';
import { OperationButton } from './ActionPrompt';
import { Tile } from './Tile';

const tile = createTile(0, 0);
const noop = () => undefined;

describe('UI-4B 手牌与操作状态', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('区分 normal、playable、selected、disabled、drawn 与 riichi-candidate', () => {
    const normal = renderToStaticMarkup(<Tile tile={tile} interactive={false} />);
    const playable = renderToStaticMarkup(<Tile tile={tile} onClick={noop} />);
    const selected = renderToStaticMarkup(<Tile tile={tile} selected onClick={noop} />);
    const disabled = renderToStaticMarkup(<Tile tile={tile} disabled />);
    const drawn = renderToStaticMarkup(<Tile tile={tile} drawn onClick={noop} />);
    const riichiCandidate = renderToStaticMarkup(<Tile tile={tile} riichiCandidate interactive={false} />);

    expect(normal).toContain('data-tile-state="normal"');
    expect(playable).toContain('tile--playable');
    expect(playable).toContain('data-tile-state="playable"');
    expect(selected).toContain('tile--selected');
    expect(selected).toContain('data-tile-state="selected"');
    expect(selected).toContain('aria-pressed="true"');
    expect(disabled).toContain('tile--disabled');
    expect(disabled).toContain('data-tile-state="disabled"');
    expect(disabled).toContain('disabled=""');
    expect(drawn).toContain('tile--drawn');
    expect(drawn).toContain('data-tile-state="drawn"');
    expect(drawn).not.toContain('tile--selected');
    expect(riichiCandidate).toContain('tile--riichi-candidate');
    expect(riichiCandidate).toContain('data-tile-state="riichi-candidate"');
  });

  it('只有 playable 手牌获得悬停位移，其他状态使用独立视觉语义', () => {
    expect(css).toContain('.tile--playable:not(:disabled):hover');
    expect(css).not.toContain('.tile:not(:disabled) {');
    expect(css).toContain('.tile--selected {');
    expect(css).toContain('.tile--drawn {');
    expect(css).toContain('.tile--riichi-candidate {');
    expect(css).toContain('.local-hand-area--interactive .tile--disabled {');
    expect(css).not.toContain('.local-hand-area .tile--disabled {');
  });

  it('操作按钮携带非颜色单一依赖的类型语义，并保留原生 disabled', () => {
    const win = renderToStaticMarkup(<OperationButton kind="win">荣和</OperationButton>);
    const pass = renderToStaticMarkup(<OperationButton kind="pass" disabled>跳过</OperationButton>);

    expect(win).toContain('operation-button--win');
    expect(win).toContain('data-operation="win"');
    expect(pass).toContain('operation-button--pass');
    expect(pass).toContain('data-operation="pass"');
    expect(pass).toContain('disabled=""');
    expect(css).toMatch(/\.action-prompt \.operation-button--win,[\s\S]*?min-height: 42px[\s\S]*?border: 2px solid/);
    expect(css).toMatch(/\.action-prompt \.operation-button--pass,[\s\S]*?margin-left: auto/);
  });
});
