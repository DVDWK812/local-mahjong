import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SeventeenStepsScreen } from './SeventeenStepsScreen';
import { getRulePreset } from '../game/match/matchRules';

describe('17步正式游戏界面接入', () => {
  it('进入正式 game-screen，并且只显示上下两个有效座位', () => {
    const html = renderToStaticMarkup(<SeventeenStepsScreen ruleConfig={getRulePreset('east-round')} onBack={() => undefined} />);
    expect(html).toContain('data-testid="game-screen"');
    expect(html).not.toContain('aria-label="麻将牌桌"');
    expect(html).toContain('aria-label="比赛摘要"');
    expect(html).toContain('模式：17步麻将');
    expect(html).not.toContain('data-player-slot="top"');
    expect(html).not.toContain('data-player-slot="bottom"');
    expect(html).not.toContain('data-player-slot="left"');
    expect(html).not.toContain('data-player-slot="right"');
    expect(html).not.toContain('seventeen-steps-screen');
    expect(html).not.toContain('0 / 34');
    expect(html).not.toContain('南家');
    expect(html).not.toContain('强制立直');
  });

  it('构筑阶段显示比赛摘要和全宽构筑内容', () => {
    const html = renderToStaticMarkup(<SeventeenStepsScreen ruleConfig={getRulePreset('east-round')} onBack={() => undefined} />);
    expect(html).toContain('构筑阶段');
    expect(html).toContain('弃牌区');
    expect(html).toContain('手牌区');
    expect(html).toContain('13');
    expect(html).toContain('34 张私有牌');
    expect((html.match(/确认固定手牌/g) ?? [])).toHaveLength(1);
    expect(html).not.toContain('固定手牌确认后不可修改');
    expect(html).toContain('宝牌指示牌');
  });

  it('共享统一牌面厚度，但不复制四人桌固定透视', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toContain('--tile-depth: var(--mahjong-tile-depth)');
    expect(css).toContain('.tile::before');
    expect(css).toContain('.game-screen:not(.seventeen-steps-game) > .mahjong-table');
    expect(css).not.toMatch(/\.seventeen-steps-board-area > \.mahjong-table\s*\{[^}]*perspective/s);
  });
});
