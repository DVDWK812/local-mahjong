import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getRulePreset } from '../game/match/matchRules';
import { createTile } from '../game/tileUtils';
import { DiscardRiver } from './game/DiscardRiver';
import { MatchSettings } from './MatchSettings';
import { Tile } from './Tile';

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  const end = css.indexOf('}', start);
  return start === -1 ? '' : css.slice(start, end);
}

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const tileSource = readFileSync(resolve(process.cwd(), 'src/components/Tile.tsx'), 'utf8');
const boardSource = readFileSync(resolve(process.cwd(), 'src/components/Board.tsx'), 'utf8');
const localHandSource = readFileSync(resolve(process.cwd(), 'src/components/game/LocalHandArea.tsx'), 'utf8');

function redFiveMan() {
  return { ...createTile(4, 0), red: true };
}

describe('鼠标悬停同牌提示', () => {
  it('悬停普通五时，赤五和其他普通五按基础牌型识别为同牌', () => {
    const normalFive = renderToStaticMarkup(
      <Tile tile={createTile(4, 1)} hoveredTileType={4} sameTileHoverEnabled />,
    );
    const redFive = renderToStaticMarkup(
      <Tile tile={redFiveMan()} hoveredTileType={4} sameTileHoverEnabled />,
    );
    expect(normalFive).toContain('tile--same-tile-match');
    expect(redFive).toContain('tile--same-tile-match');
  });

  it('当前悬停牌自身通过 hover 样式保持正常并显示轮廓', () => {
    expect(cssRule(css, '.tile--same-tile-match:hover')).toContain('opacity: 1');
    expect(cssRule(css, '.tile--same-tile-match:hover')).toContain('outline');
  });

  it('不同牌不受影响', () => {
    const html = renderToStaticMarkup(
      <Tile tile={createTile(5, 0)} hoveredTileType={4} sameTileHoverEnabled />,
    );
    expect(html).not.toContain('tile--same-tile-match');
  });

  it('离开后 hoveredTileType 为空，全部恢复', () => {
    const html = renderToStaticMarkup(
      <Tile tile={createTile(4, 0)} hoveredTileType={null} sameTileHoverEnabled />,
    );
    expect(html).not.toContain('tile--same-tile-match');
  });

  it('暗牌和空白弃牌位置不参与', () => {
    const faceDown = renderToStaticMarkup(
      <Tile tile={redFiveMan()} faceDown hoveredTileType={4} sameTileHoverEnabled />,
    );
    const placeholder = renderToStaticMarkup(<Tile hoveredTileType={4} sameTileHoverEnabled />);
    const claimedRiver = renderToStaticMarkup(
      <DiscardRiver
        player={{
          id: 0,
          name: 'Player 1',
          seatWind: 'east',
          score: 25000,
          hand: [],
          river: [{ ...createTile(4, 0), claimed: true }],
          calls: [],
          drawnTile: null,
          riichi: false,
          riichiState: null,
        }}
        position="south"
        preserveClaimedDiscardGap
        hoveredTileType={4}
        sameTileHoverEnabled
      />,
    );
    expect(faceDown).not.toContain('tile--same-tile-match');
    expect(placeholder).not.toContain('tile--same-tile-match');
    expect(claimedRiver).not.toContain('tile--same-tile-match');
  });

  it('牌河正面弃牌支持共享悬停，且赤五与普通五互相识别', () => {
    const html = renderToStaticMarkup(
      <DiscardRiver
        player={{
          id: 0,
          name: 'Player 1',
          seatWind: 'east',
          score: 25000,
          hand: [],
          river: [createTile(4, 0), redFiveMan(), createTile(5, 0)],
          calls: [],
          drawnTile: null,
          riichi: false,
          riichiState: null,
        }}
        position="south"
        hoveredTileType={4}
        sameTileHoverEnabled
      />,
    );

    expect(html.match(/tile--same-tile-match/g)).toHaveLength(2);
    expect(html).not.toContain('<button');
  });

  it('关闭设置后无视觉变化', () => {
    const tileHtml = renderToStaticMarkup(
      <Tile tile={createTile(4, 0)} hoveredTileType={4} sameTileHoverEnabled={false} />,
    );
    const settingsHtml = renderToStaticMarkup(
      <MatchSettings config={getRulePreset('east-round')} sameTileHoverEnabled={false} onConfigChange={() => undefined} />,
    );
    expect(tileHtml).not.toContain('tile--same-tile-match');
    expect(settingsHtml).toContain('悬停显示相同牌');
  });

  it('点击手牌按钮能力保持正常', () => {
    const html = renderToStaticMarkup(
      <Tile tile={createTile(4, 0)} hoveredTileType={4} sameTileHoverEnabled onClick={() => undefined} />,
    );
    expect(html).toContain('<button');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('tile--same-tile-match');
  });

  it('悬停来源卸载时会主动清除共享悬停状态', () => {
    expect(tileSource).toContain('isHoverSourceRef');
    expect(tileSource).toContain('return () => {');
    expect(tileSource).toContain('onHoveredTileTypeChange?.(null)');
  });

  it('弃牌按下和弃牌完成后都会清除悬停状态', () => {
    expect(localHandSource).toContain('onPointerDown={canClick(tile.instanceId) ? () => onHoveredTileTypeChange?.(null) : undefined}');
    expect(localHandSource).toContain('onDiscard(player.id, tileInstanceId)');
    expect(localHandSource.match(/onHoveredTileTypeChange\?\.\(null\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(boardSource).toContain('const handleDiscard = (playerId: PlayerId, tileInstanceId: string)');
    expect(boardSource).toContain('onDiscard(playerId, tileInstanceId)');
  });

  it('牌局推进后会清除旧悬停，且透明度仍复用现有样式', () => {
    expect(boardSource).toContain('setHoveredTileType(null)');
    expect(boardSource).toContain('}, [gameState]);');
    expect(cssRule(css, '.tile--same-tile-match')).toContain('opacity');
    expect(localHandSource).not.toContain('opacity:');
    expect(boardSource).not.toContain('opacity:');
    expect(tileSource).not.toContain('opacity:');
  });
});
