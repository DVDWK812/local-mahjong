import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createTile } from '../../game/tileUtils';
import type { CallSet } from '../../game/types';
import { LocalHandArea } from './LocalHandArea';

describe('LocalHandArea', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('本家区域使用玩家信息、手牌、副露三列布局', () => {
    expect(css).toContain('grid-template-columns: auto minmax(0, 1fr) auto');
    expect(css).toContain('"info hand melds"');
    expect(css).toContain('.local-hand-track');
    expect(css).toContain('.local-meld-track');
  });

  it('本家手牌左对齐且不换行，摸入牌仍位于手牌最右侧', () => {
    const state = createInitialGameState();
    const html = renderToStaticMarkup(
      <LocalHandArea
        player={state.players[0]}
        isCurrent
        canDiscard
        onDiscard={() => undefined}
      />,
    );
    expect(html).toContain('local-hand-track');
    expect(html).toContain('local-hand-row');
    expect(html).toContain('drawn-tile-gap');
    expect(css).toContain('justify-content: flex-start');
    expect(css).toContain('flex-wrap: nowrap');
  });

  it('本家头像信息下方显示摸切标记，关闭后隐藏', () => {
    const state = createInitialGameState();
    const player = { ...state.players[0], river: [{ ...createTile(4, 1), isTsumogiri: true }] };
    const shown = renderToStaticMarkup(
      <LocalHandArea player={player} isCurrent canDiscard onDiscard={() => undefined} />,
    );
    const hidden = renderToStaticMarkup(
      <LocalHandArea player={player} isCurrent canDiscard tsumoGiriDisplayEnabled={false} onDiscard={() => undefined} />,
    );

    expect(shown).toContain('tsumogiri-marker--drawn');
    expect(shown).toContain('tsumogiri-marker');
    expect(hidden).not.toContain('tsumogiri-marker');
  });

  it('本家信息区显示固定座位身份的风位和点数', () => {
    const state = createInitialGameState();
    const html = renderToStaticMarkup(
      <LocalHandArea player={state.players[0]} identityPlayer={state.players[2]} isCurrent canDiscard onDiscard={() => undefined} />,
    );
    expect(html).toContain('local-hand-meta');
    expect(html).toContain('西');
    expect(html).toContain('25,000');
  });

  it('食替禁打时显示提示，并沿用不可点击的手牌状态', () => {
    const state = createInitialGameState();
    const allowed = state.players[0].hand.slice(1).map((tile) => tile.instanceId);
    const html = renderToStaticMarkup(
      <LocalHandArea
        player={state.players[0]}
        isCurrent
        canDiscard
        allowedDiscardInstanceIds={allowed}
        kuikaeForbiddenTileIds={[state.players[0].hand[0].id]}
        onDiscard={() => undefined}
      />,
    );
    expect(html).toContain('食替禁止');
    expect(html).toContain('tile--kuikae-forbidden');
    expect(css).toContain('.tile--kuikae-forbidden');
  });

  it('本家副露区域位于最右侧，并在副露较多时优先缩小副露牌', () => {
    const state = createInitialGameState();
    const call: CallSet = {
      type: 'pon',
      tiles: [createTile(1, 0), createTile(1, 1), createTile(1, 2)],
      from: 1,
      opened: true,
      calledTile: createTile(1, 3),
    };
    const player = { ...state.players[0], calls: [call] };
    const html = renderToStaticMarkup(
      <LocalHandArea
        player={player}
        isCurrent
        canDiscard
        onDiscard={() => undefined}
      />,
    );
    expect(html).toContain('local-meld-track');
    expect(html).toContain('player-melds');
    expect(css).toContain('justify-content: flex-end');
    expect(css).toContain('.local-meld-track .tile');
  });

  it('只有可弃手牌接入听牌悬停预览，弃牌时先清除预览', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/game/LocalHandArea.tsx'), 'utf8');
    expect(source).toContain('onDiscardPreviewChange?.(tile.instanceId)');
    expect(source).toContain('onDiscardPreviewChange?.(drawnTile.instanceId)');
    expect(source).toContain('onDiscardPreviewChange?.(null)');
    expect(source).toContain('canClick(tile.instanceId) ? () => onDiscardPreviewChange');
  });

  it('本家区域高度比旧版更紧凑且动作提示使用绝对定位不推动布局', () => {
    expect(css).toContain('min-height: calc(var(--hand-tile-height) + 16px)');
    expect(css).toContain('.game-prompt-layer');
    expect(css).toContain('position: absolute');
  });
});
