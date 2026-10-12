import { useState } from 'react';
import type { XzConfig } from '../../game/xuezhan/config';
import { BASIC_HAND, GUIDE_GOLDENS, PLAIN_HAND, XZ_GUIDE_TABS, XZ_PATTERN_GUIDE, guideExample, patternAvailability, patternName, xzGuideParagraphs, type XzGuideTab } from '../../game/xuezhan/guide';
import { YakuExample } from './YakuExample';
import { RulesGuideFrame, RulesGuideSearch } from './RulesGuideFrame';

/** Both entry points consume this one body. No live hand or action consumer is used. */
export function XuezhanRulesGuide({ config, context, onBack, initialTab='basics' }: {
  config: XzConfig; context: 'draft'|'match'; onBack: () => void; initialTab?: XzGuideTab;
}) {
  const [tab,setTab]=useState<XzGuideTab>(initialTab), [query,setQuery]=useState('');
  const sections=(Object.keys(XZ_GUIDE_TABS) as XzGuideTab[]).filter(id=>query || id===tab);
  return <RulesGuideFrame title="血战到底规则说明" embedded onBack={onBack} tabs={XZ_GUIDE_TABS} active={tab} onTab={id=>{setTab(id as XzGuideTab);setQuery('');}} search={<RulesGuideSearch value={query} onChange={setQuery}/>}>
    <p role="status">{context==='draft'?'当前设置 · 返回保留草稿':'本场规则 · 阅读期间已暂停，返回保留进入前的暂停状态和剩余时间'}</p>
    <p>本项目当前血战规则；以下开关与数值来自{context==='draft'?'当前草稿':'本场规则快照'}。不同牌桌的规则可能不同。</p>
    <div className="rules-tab-panel">{sections.map(id=>id==='patterns'?<section key={id} id="xz-guide-patterns"><h2>全部16个番型</h2><p>平胡为0番基底。下列牌例用于说明该项成立，不代表本场只算这一项；当前配置决定可用奖励和最终支付。</p><div className="yaku-card-grid">
      {XZ_PATTERN_GUIDE.filter(p=>!query||`${patternName(p.id)}${p.plain}${p.condition}${p.combination}`.includes(query)).map(p=><article className="yaku-card" key={p.id} id={`xz-guide-${p.id}`} data-pattern={p.id}>
        <h3>{patternName(p.id)} · {config.rules.patterns[p.id].fan}番{p.id==='root'?'／根':''}</h3><strong>{context==='match'?'本场':'当前设置'}：{patternAvailability(p.id,config)}</strong>
        <p>{p.plain}</p><p>条件：{p.condition}</p><YakuExample example={p.example}/><p>组合与误解：{p.combination}</p>
      </article>)}</div></section>:<section key={id} id={`xz-guide-${id}`} className="rules-reading-panel"><h2>{XZ_GUIDE_TABS[id]}</h2>
        {xzGuideParagraphs(id,config).filter(p=>!query||p.includes(query)).map((p,i)=><p key={i}>{p}</p>)}
        {id==='basics'&&!query&&<><h3>合法胡牌例（缺条）</h3><YakuExample example={guideExample(PLAIN_HAND,'四面子一对，只有万与筒。')}/><h3>不能胡的反例</h3><YakuExample example={guideExample(BASIC_HAND,'三门俱全；虽然四面子一对，也不满足缺门。')}/></>}
        {id==='scoring'&&!query&&GUIDE_GOLDENS.map(g=><article className="yaku-card" key={g.name}><h3>{g.name}</h3><YakuExample example={guideExample(g.hand,'固定教学预设：缺条，无额外事件。')}/><p>原始{g.fan}番 → 封顶后{g.fan}番 → {2**g.fan}倍 → 基值{g.base} → 每位付款额{g.payment}。</p><p>{g.payers}。</p><p>本次净变化：{g.net.map((n,i)=>`${'ABCD'[i]} ${n>0?'+':''}${n}`).join('；')}。</p></article>)}
      </section>)}</div>
  </RulesGuideFrame>;
}
