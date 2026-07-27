import { useMemo, useState } from 'react';
import type { FullRuleConfig } from '../../game/match/types';
import { buildFuExamples, buildPointTable } from '../../game/rulesGuide/fuPointsGuide';
import { GUIDE_YAKU, type GuideYaku, type GuideYakuGroup } from '../../game/rulesGuide/yakuCatalog';
import { YakuExample } from './YakuExample';

export type RulesTab =
  | 'home'
  | 'situational'
  | 'oneHan'
  | 'twoHan'
  | 'threeHan'
  | 'sixHan'
  | 'yakuman'
  | 'doubleYakuman'
  | 'ancient'
  | 'points';

interface RulesGuideScreenProps {
  ruleConfig: FullRuleConfig;
  onBack: () => void;
  embedded?: boolean;
  initialTab?: RulesTab;
}

const tabLabels: Record<RulesTab, string> = {
  home: '主页',
  situational: '状况役',
  oneHan: '1番役',
  twoHan: '2番役',
  threeHan: '3番役',
  sixHan: '6番役',
  yakuman: '役满',
  doubleYakuman: '双倍役满',
  ancient: '古役',
  points: '符数/点数',
};

const groupByTab: Partial<Record<RulesTab, GuideYakuGroup>> = {
  situational: '状况役',
  oneHan: '1番役',
  twoHan: '2番役',
  threeHan: '3番役',
  sixHan: '6番役',
  ancient: '古役',
};

export function RulesGuideScreen({ ruleConfig, onBack, embedded = false, initialTab = 'home' }: RulesGuideScreenProps) {
  const [tab, setTab] = useState<RulesTab>(initialTab);

  return (
    <main className={embedded ? 'rules-guide rules-guide--overlay' : 'rules-guide'}>
      <section className="rules-guide-panel" aria-label="立直麻将规则说明">
        <header className="rules-guide-header">
          <button type="button" onClick={onBack}>返回</button>
          <h1>立直麻将规则说明</h1>
          <nav className="rules-tabs" aria-label="规则说明选项卡">
            {(Object.keys(tabLabels) as RulesTab[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {tabLabels[key]}
              </button>
            ))}
          </nav>
        </header>
        <div className="rules-guide-content">
          {tab === 'home' ? <RulesHomeTab /> : null}
          {tab !== 'home' && tab !== 'points' ? <YakuGuideTab tab={tab} /> : null}
          {tab === 'points' ? <FuPointsGuideTab ruleConfig={ruleConfig} /> : null}
        </div>
      </section>
    </main>
  );
}

function RulesHomeTab() {
  return (
    <div className="rules-tab-panel">
      <section className="rules-reading-panel">
        <h2>基本流程</h2>
        <p>一局从配牌开始，在摸牌、打牌、鸣牌与宣言之间循环，直到有人和牌、荒牌流局或触发途中流局。</p>
        <div className="rules-flow-grid">
          <article className="rules-flow-card">
            <h3>配牌与目标</h3>
            <ul>
              <li>每位玩家起手13张，庄家起手14张并先打第一张牌。</li>
              <li>普通和牌目标是14张组成4个面子加1个雀头；七对子、国士无双等按特殊结构成立。</li>
            </ul>
          </article>
          <article className="rules-flow-card">
            <h3>摸牌与打牌</h3>
            <ul>
              <li>轮到自己时从牌山摸入1张，再选择1张牌打出。</li>
              <li>打出的牌进入河，其他玩家可按规则声明荣和、吃、碰或杠。</li>
            </ul>
          </article>
          <article className="rules-flow-card">
            <h3>吃、碰、杠</h3>
            <ul>
              <li>吃只能取上家的弃牌组成顺子；碰可取任意一家弃牌组成刻子。</li>
              <li>杠由4张相同牌组成，宣言后摸岭上牌；暗杠仍保留门前清状态。</li>
              <li>吃、碰、大明杠和加杠会开门，可能导致部分役不成立或副露减番。</li>
            </ul>
          </article>
          <article className="rules-flow-card">
            <h3>门前清与副露</h3>
            <ul>
              <li>没有吃、碰、明杠的手牌视为门前清。</li>
              <li>副露后的役种番数和成立限制以役种页中读取的计分定义为准。</li>
            </ul>
          </article>
          <article className="rules-flow-card">
            <h3>立直宣言</h3>
            <ul>
              <li>门前清、听牌且至少有1000点时可以立直。</li>
              <li>立直支付1000点供托，成立后获得立直役，并可触发一发、里宝牌等相关结算。</li>
            </ul>
          </article>
          <article className="rules-flow-card">
            <h3>和牌与流局</h3>
            <ul>
              <li>自摸是摸到自己的和牌张；荣和是使用他家弃牌完成和牌。</li>
              <li>无人和牌且牌山用尽时荒牌流局，九种九牌、四风连打等途中流局由当前规则控制。</li>
            </ul>
          </article>
          <article className="rules-flow-card">
            <h3>振听</h3>
            <ul>
              <li>若自己的弃牌或错过的可和牌导致振听，通常不能荣和他家弃牌。</li>
              <li>振听状态下仍可自摸；具体解除方式按项目当前实现处理。</li>
            </ul>
          </article>
          <article className="rules-flow-card">
            <h3>番、符与点数</h3>
            <ul>
              <li>役种决定番数，手牌形状与和牌方式决定符数，宝牌只加番但本身不是役。</li>
              <li>最终点数由番、符、宝牌、供托和本场奖励共同决定，并由计分引擎计算。</li>
            </ul>
          </article>
        </div>
        <p className="rules-footnote">本说明以当前游戏规则配置与计分引擎为准。</p>
      </section>
    </div>
  );
}

function YakuGuideTab({ tab }: { tab: RulesTab }) {
  const items = yakuForTab(tab);

  return (
    <div className="rules-tab-panel">
      <section>
        <h2>{tabLabels[tab]}</h2>
        <div className="yaku-card-grid">
          {items.map((yaku) => <YakuCard key={yaku.id} yaku={yaku} />)}
        </div>
      </section>
    </div>
  );
}

function yakuForTab(tab: RulesTab): GuideYaku[] {
  if (tab === 'yakuman') {
    return GUIDE_YAKU.filter((yaku) => yaku.source === 'yakuman' && (yaku.closedResult.yakumanValue ?? 1) === 1);
  }
  if (tab === 'doubleYakuman') {
    return GUIDE_YAKU.filter((yaku) => yaku.source === 'yakuman' && (yaku.closedResult.yakumanValue ?? 1) >= 2);
  }
  const group = groupByTab[tab];
  if (!group) return [];
  return GUIDE_YAKU.filter((yaku) => yaku.group === group);
}

function YakuCard({ yaku }: { yaku: GuideYaku }) {
  const closedHan = yaku.closedResult.yakuman ? `${yaku.closedResult.yakumanValue ?? 1}倍役满` : `${yaku.closedResult.closedHan ?? yaku.closedResult.han ?? 0}番`;
  const openHan = yaku.openResult
    ? yaku.openResult.yakuman ? `${yaku.openResult.yakumanValue ?? 1}倍役满` : `${yaku.openResult.openHan ?? yaku.openResult.han ?? 0}番`
    : '不成立';
  const openEffect = yaku.openResult
    ? (yaku.openResult.han ?? 0) < (yaku.closedResult.han ?? yaku.openResult.han ?? 0) ? '副露后减1番' : '副露不减番'
    : '副露后不成立';

  return (
    <article className="yaku-card" data-yaku-id={yaku.id}>
      <header>
        <h3>{yaku.closedResult.name}</h3>
        <div className="rules-tags">
          <span>{yaku.openResult ? '副露可成立' : '门清限定'}</span>
          <span>{openEffect}</span>
          {yaku.tags?.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </header>

      <p>{yaku.condition}</p>
      <YakuExample example={yaku.example} />
    </article>
  );
}

function FuPointsGuideTab({ ruleConfig }: { ruleConfig: FullRuleConfig }) {
  const fuExamples = useMemo(() => buildFuExamples(ruleConfig), [ruleConfig]);
  const pointRows = useMemo(() => buildPointTable(ruleConfig), [ruleConfig]);
  return (
    <div className="rules-tab-panel">
      <section className="rules-reading-panel">
        <h2>符数</h2>
        <p>符数从基础20符开始，按和牌方式、等待、雀头和面子加符。七对子固定25符，平和自摸固定20符，其他一般向上取整到10符；副露平和形荣和按项目符计算规则至少30符。</p>
        <ul>
          <li>门前荣和 +10符；自摸 +2符，平和自摸例外。</li>
          <li>明刻/暗刻、明杠/暗杠按中张与幺九牌/字牌分别计符。</li>
          <li>役牌雀头加2符；连风牌雀头按当前规则配置处理。</li>
          <li>边张、嵌张、单骑等待各加2符，双碰和两面不加等待符。</li>
        </ul>
        <div className="fu-example-grid">
          {fuExamples.map((example) => (
            <article key={example.title} className="fu-example-card">
              <h3>{example.title}</h3>
              <YakuExample example={{ hand: example.handIds.slice(0, 13).map((id) => ({ id })), winningTile: { id: example.winningTile } }} />
              <dl className="yaku-meta">
                <div><dt>基础</dt><dd>{example.breakdown.baseFu}</dd></div>
                <div><dt>和牌</dt><dd>{example.breakdown.winFu}</dd></div>
                <div><dt>等待</dt><dd>{example.breakdown.waitFu}</dd></div>
                <div><dt>雀头</dt><dd>{example.breakdown.pairFu}</dd></div>
                <div><dt>面子</dt><dd>{example.breakdown.meldFu}</dd></div>
                <div><dt>合计</dt><dd>{example.breakdown.total}符</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
      <section className="rules-reading-panel">
        <h2>点数</h2>
        <p>基本点为符数 × 2 的「番数+2」次方，再按庄家/闲家、荣和/自摸倍率计算并向上取整到100点。本场每本荣和加300点，自摸各家加100点；立直供托由和牌者取得。</p>
        <p>满贯、跳满、倍满、三倍满、役满、双倍役满以及累计役满处理均调用当前项目点数函数生成。</p>
        <div className="rules-table-wrap">
          <table className="rules-point-table">
            <thead>
              <tr><th>牌型</th><th>子荣和</th><th>亲荣和</th><th>子自摸</th><th>亲自摸</th></tr>
            </thead>
            <tbody>
              {pointRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{formatPoint(row.childRon)}</td>
                  <td>{formatPoint(row.dealerRon)}</td>
                  <td>{formatPoint(row.childTsumo)}</td>
                  <td>{formatPoint(row.dealerTsumo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatPoint(points: { ron?: number; tsumoDealer?: number; tsumoChild?: number; limitName?: string }) {
  const base = points.ron
    ? `${points.ron}`
    : points.tsumoDealer && points.tsumoChild
      ? `${points.tsumoDealer}/${points.tsumoChild}`
      : points.tsumoChild
        ? `${points.tsumoChild} all`
        : '0';
  return points.limitName ? `${base}（${points.limitName}）` : base;
}
