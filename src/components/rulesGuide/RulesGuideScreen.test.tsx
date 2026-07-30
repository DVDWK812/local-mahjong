import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameTopBar } from '../game/GameTopBar';
import { RiichiModeMenu } from '../RiichiModeMenu';
import { getRulePreset } from '../../game/match/matchRules';
import { buildFuExamples, buildPointTable } from '../../game/rulesGuide/fuPointsGuide';
import { GUIDE_YAKU } from '../../game/rulesGuide/yakuCatalog';
import { calculatePoints } from '../../game/score/pointCalculator';
import { NORMAL_YAKU } from '../../game/score/yaku/normal';
import { YAKUMAN_YAKU } from '../../game/score/yaku/yakuman';
import { ANCIENT_YAKU, ANCIENT_YAKU_IDS } from '../../game/score/yaku/ancient';
import { createInitialGameState } from '../../game/engine';
import { evaluateWin } from '../../game/scoreCalculator';
import type { Tile, TileId } from '../../game/types';
import { createTile, getTileRank, getTileSuit } from '../../game/tileUtils';
import { YakuExample } from './YakuExample';
import { RulesGuideScreen, type RulesTab } from './RulesGuideScreen';

function noop() {
  return undefined;
}

function pointContext(config = getRulePreset('east-round'), seatWind: 'east' | 'south' = 'south', isTsumo = false) {
  const winTile: Tile = { id: 14, suit: getTileSuit(14), rank: getTileRank(14), red: false, instanceId: 'test-win' };
  return {
    winTile,
    winningTile: winTile,
    winType: isTsumo ? 'tsumo' as const : 'ron' as const,
    isTsumo,
    isRiichi: false,
    isIppatsu: false,
    isMenzen: true,
    roundWind: 'east' as const,
    seatWind,
    doraIndicators: [],
    uraDoraIndicators: [],
    honba: 0,
    riichiSticks: 0,
    ruleConfig: config.round,
  };
}

describe('RulesGuideScreen', () => {
  it('菜单中出现规则说明入口', () => {
    const html = renderToStaticMarkup(<RiichiModeMenu onBack={noop} onFourPlayer={noop} onThreePlayer={noop} />);
    expect(html).toContain('规则说明');
  });

  it('游戏内规则说明位于牌局分析左侧', () => {
    const html = renderToStaticMarkup(
      <GameTopBar gameState={createInitialGameState()} analysisOpen={false} onOpenRulesGuide={noop} onToggleAnalysis={noop} onReturnMenu={noop} />,
    );
    expect(html.indexOf('规则说明')).toBeLessThan(html.indexOf('牌局分析'));
  });

  it('主页、各役种和符数点数选项卡均可渲染', () => {
    const config = getRulePreset('east-round');
    const tabs: RulesTab[] = ['home', 'oneHan', 'twoHan', 'threeHan', 'sixHan', 'yakuman', 'doubleYakuman', 'ancient', 'points'];
    tabs.forEach((initialTab) => {
      const html = renderToStaticMarkup(<RulesGuideScreen ruleConfig={config} initialTab={initialTab} onBack={noop} />);
      expect(html).toContain('主页');
      expect(html).toContain('1番役');
      expect(html).toContain('2番役');
      expect(html).toContain('3番役');
      expect(html).toContain('6番役');
      expect(html).toContain('役满');
      expect(html).toContain('双倍役满');
      expect(html).toContain('古役');
      expect(html).toContain('符数/点数');
      expect(html).toContain('type="button"');
      expect(html).toContain('aria-pressed="true"');
    });
  });

  it('不再渲染当前规则模块', () => {
    const html = renderToStaticMarkup(<RulesGuideScreen ruleConfig={getRulePreset('east-round')} onBack={noop} />);
    expect(html).not.toContain('rules-summary-card');
    expect(html).not.toContain('起始点数');
    expect(html).toContain('基本流程');
    expect(html).toContain('配牌与目标');
    expect(html).toContain('庄家起手14张');
    expect(html).toContain('摸牌与打牌');
    expect(html).toContain('吃、碰、杠');
    expect(html).toContain('立直宣言');
    expect(html).toContain('振听');
  });

  it('不同役种tab只显示对应分组', () => {
    const config = getRulePreset('east-round');
    expect(renderToStaticMarkup(<RulesGuideScreen ruleConfig={config} initialTab="oneHan" onBack={noop} />)).toContain('立直');
    expect(renderToStaticMarkup(<RulesGuideScreen ruleConfig={config} initialTab="oneHan" onBack={noop} />)).toContain('平和');
    expect(renderToStaticMarkup(<RulesGuideScreen ruleConfig={config} initialTab="twoHan" onBack={noop} />)).toContain('双立直');
    expect(renderToStaticMarkup(<RulesGuideScreen ruleConfig={config} initialTab="twoHan" onBack={noop} />)).toContain('七对子');
    expect(renderToStaticMarkup(<RulesGuideScreen ruleConfig={config} initialTab="threeHan" onBack={noop} />)).toContain('二杯口');
    expect(renderToStaticMarkup(<RulesGuideScreen ruleConfig={config} initialTab="sixHan" onBack={noop} />)).toContain('清一色');
    expect(renderToStaticMarkup(<RulesGuideScreen ruleConfig={config} initialTab="yakuman" onBack={noop} />)).toContain('国士无双');
    expect(renderToStaticMarkup(<RulesGuideScreen ruleConfig={config} initialTab="doubleYakuman" onBack={noop} />)).toContain('国士十三面');
  });

  it('当前注册的每个役种都有说明、番数和牌例', () => {
    expect(GUIDE_YAKU.filter((yaku) => yaku.source === 'normal').map((yaku) => yaku.id).sort()).toEqual(Object.keys(NORMAL_YAKU).sort());
    expect(GUIDE_YAKU.filter((yaku) => yaku.source === 'yakuman').map((yaku) => yaku.id).sort()).toEqual(Object.keys(YAKUMAN_YAKU).sort());
    expect(GUIDE_YAKU.filter((yaku) => yaku.source === 'ancient').map((yaku) => yaku.id).sort()).toEqual([...ANCIENT_YAKU_IDS].sort());
    expect(Object.keys(ANCIENT_YAKU).sort()).toEqual([...ANCIENT_YAKU_IDS].sort());
    GUIDE_YAKU.forEach((yaku) => {
      expect(yaku.closedResult.name).not.toBe('');
      expect(yaku.condition).not.toBe('');
      const effectiveMeldTiles = yaku.example.melds?.reduce((sum, meld) => sum + (meld.type === 'kan' ? 3 : meld.tiles.length), 0) ?? 0;
      expect(yaku.example.hand.length + 1 + effectiveMeldTiles).toBe(14);
      expect(yaku.openResult ? yaku.openResult.openAllowed : yaku.closedResult.openAllowed === false || yaku.openResult === null).toBeTruthy();
    });
  });

  it('平和说明使用门清两面听的合法牌例', () => {
    const pinfu = GUIDE_YAKU.find((yaku) => yaku.id === 'pinfu');
    expect(pinfu).toBeDefined();
    expect(pinfu?.condition).toBe('门前清限定。四组面子均为顺子，雀头不是役牌，且以两面听和牌。');
    expect(pinfu?.example.hand.map((tile) => tile.id)).toEqual([1, 2, 3, 2, 3, 4, 12, 13, 14, 23, 24, 13, 13]);
    expect(pinfu?.example.winningTile.id).toBe(25);
    expect(pinfu?.example.melds).toBeUndefined();

    const hand = [...pinfu!.example.hand, pinfu!.example.winningTile]
      .map((guideTile, index) => ({ ...createTile(guideTile.id, index % 4), red: guideTile.red ?? false }));
    const winningTile = hand[hand.length - 1];
    const score = evaluateWin(hand, {
      ...pointContext(),
      winTile: winningTile,
      winningTile,
    });
    expect(score.yaku.some((yaku) => yaku.name === '平和')).toBe(true);
  });

  it('古役无论规则开关都以普通役种形式显示', () => {
    const disabled = renderToStaticMarkup(<RulesGuideScreen ruleConfig={getRulePreset('east-round')} initialTab="ancient" onBack={noop} />);
    const enabledConfig = { ...getRulePreset('east-round'), round: { ...getRulePreset('east-round').round, allowAncientYaku: true } };
    const enabled = renderToStaticMarkup(<RulesGuideScreen ruleConfig={enabledConfig} initialTab="ancient" onBack={noop} />);
    expect(disabled).toContain('大车轮');
    expect(enabled).toContain('大车轮');
    expect(disabled).toContain('<span class="rules-title-tag">当前规则未启用</span>');
    expect(enabled).toContain('<span class="rules-title-tag">当前规则已启用</span>');
    expect(disabled.match(/当前规则未启用/g)?.length).toBe(1);
    expect(enabled.match(/当前规则已启用/g)?.length).toBe(1);
    expect(disabled).not.toContain('当前规则未启用古役。');
    expect(enabled).not.toContain('当前规则未启用古役。');
  });

  it('役种标签不显示副露可成立或副露不成立，仅门清役显示门清限定', () => {
    const html = renderToStaticMarkup(<RulesGuideScreen ruleConfig={getRulePreset('east-round')} initialTab="oneHan" onBack={noop} />);
    expect(html).not.toContain('<span>副露可成立</span>');
    expect(html).not.toContain('<span>副露后不成立</span>');
    expect(html).not.toContain('<span>副露不减番</span>');
    expect(html).toContain('<span>门清限定</span>');
  });

  it('每个牌例的牌编码合法', () => {
    GUIDE_YAKU.forEach((yaku) => {
      const ids = [
        ...yaku.example.hand.map((tile) => tile.id),
        yaku.example.winningTile.id,
        ...(yaku.example.melds?.flatMap((meld) => meld.tiles.map((tile) => tile.id)) ?? []),
      ];
      ids.forEach((id) => expect(id).toBeGreaterThanOrEqual(0));
      ids.forEach((id) => expect(id).toBeLessThanOrEqual(33));
      const counts = new Map<TileId, number>();
      ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
      counts.forEach((count) => expect(count).toBeLessThanOrEqual(4));
    });
  });

  it('示例牌使用非交互牌图且不产生嵌套button', () => {
    const html = renderToStaticMarkup(<YakuExample example={GUIDE_YAKU[0].example} />);
    expect(html).not.toContain('<button');
    expect(html).toContain('role="img"');
  });

  it('符数示例与项目符计算规则一致', () => {
    const examples = buildFuExamples(getRulePreset('east-round'));
    expect(examples.map((example) => example.breakdown.total)).toEqual([40, 20, 40]);
  });

  it('点数表与项目点数函数输出一致', () => {
    const config = getRulePreset('east-round');
    const row = buildPointTable(config)[0];
    expect(row.childRon).toEqual(calculatePoints(row.han, row.fu, pointContext(config, 'south', false)));
    expect(row.dealerTsumo).toEqual(calculatePoints(row.han, row.fu, pointContext(config, 'east', true)));
  });
});
