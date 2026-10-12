import { useEffect, useRef, useState } from 'react';
import type { GbConfig } from '../../game/guobiao/config';
import { GB_FAN_CATALOG } from '../../game/guobiao/fanCatalog';
import { GB_GUIDE_EXAMPLES, GB_GUIDE_SECTIONS, GB_GUIDE_EXCLUSIONS, GB_GUIDE_CASES, guideInput } from '../../game/guobiao/guideContent';
import { Tile } from '../Tile';
import { createTile } from '../../game/tileUtils';
import type { TileId } from '../../game/types';
import './guobiaoRulesGuide.css';

export function GuobiaoRulesGuide({ config, onBack }: { config: GbConfig; onBack: () => void }) {
  const [section, setSection] = useState('flow'), [query, setQuery] = useState('');
  const panel = useRef<HTMLElement>(null), body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    const root = panel.current!.parentElement!;
    const siblings = Array.from(root.parentElement!.children).filter(e => e !== root) as HTMLElement[];
    const old = siblings.map(e => e.inert); siblings.forEach(e => { e.inert = true; });
    const onKey = (e: KeyboardEvent) => {
      // Capture phase prevents window-level gameplay shortcuts, including those outside React.
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { e.preventDefault(); onBack(); }
      if (e.key === 'Tab') {
        const targets = Array.from(panel.current!.querySelectorAll<HTMLElement>('button,input,a[href],summary,[tabindex="0"]')).filter(e => !e.hasAttribute('disabled') && e.getClientRects().length);
        const first = targets[0], last = targets[targets.length - 1];
        if (e.shiftKey && (document.activeElement === first || !panel.current!.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    panel.current!.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { window.removeEventListener('keydown', onKey, true); siblings.forEach((e,i) => { e.inert = old[i]; }); focused?.focus(); };
  }, [onBack]);
  const changeSection = (id: string) => { setSection(id); setQuery(''); if (body.current) body.current.scrollTop = 0; };
  const hits = GB_FAN_CATALOG.filter(f => `${f.name} ${f.value} ${f.id} ${f.description} ${GB_GUIDE_EXCLUSIONS[f.id] ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="gb-guide-backdrop" onClick={e => e.stopPropagation()}>
    <section ref={panel} className="rules-guide-panel gb-guide-panel" role="dialog" aria-modal="true" aria-label="国标麻将比赛规则">
      <header className="rules-guide-header"><button onClick={onBack}>返回</button><h1>国标麻将比赛规则</h1><p>从认识第一张牌开始；阅读期间本地对局暂停，返回后沿用原决策与剩余时间。</p></header>
      <div className="gb-guide-layout"><nav aria-label="国标规则目录">{GB_GUIDE_SECTIONS.map(s => <button key={s.id} aria-current={section===s.id?'page':undefined} onClick={()=>changeSection(s.id)}>{s.title}</button>)}<button aria-current={section==='fans'?'page':undefined} onClick={()=>changeSection('fans')}>完整81番种检索</button><button aria-current={section==='cases'?'page':undefined} onClick={()=>changeSection('cases')}>资格与支付完整算例</button><button aria-current={section==='version'?'page':undefined} onClick={()=>changeSection('version')}>本局配置与版本来源</button></nav>
        <div ref={body} className="rules-guide-content gb-guide-content" tabIndex={0}>
          {GB_GUIDE_SECTIONS.filter(s=>s.id===section).map(s=><article key={s.id}><h2>{s.title}</h2>{s.paragraphs.map((p,i)=><p key={i}>{p}</p>)}{s.tiles&&<GuideTiles ids={s.tiles}/>}</article>)}
          {section==='fans'&&<><h2>完整81番种检索</h2><label>名称、番值、条件或ID<input aria-label="国标番种检索" value={query} onChange={e=>setQuery(e.target.value)} placeholder="例如：暗杠、8、门清"/></label><p>显示 {hits.length} / 81 项。目标番值不是整手合计；完整例子只说明目标番成立，其他番须依法组合。所有完整例子：南家、东圈，无花、非末张、非绝张，除条目明确标注的事件外无条件事件。</p>
            {hits.map(f=>{const ex=GB_GUIDE_EXAMPLES.find(e=>e.id===f.id)!;const input=guideInput(ex);return <article className="gb-guide-fan" key={f.id} data-fan-id={f.id}><h3>{f.ruleIndex}. {f.name} · {f.value}番</h3><p>{f.description}。</p><p>条件：{input.selfDraw?'自摸':'点和'}；{input.source==='kong'?'刚提交杠，从牌尾直接补到常规和牌张':input.source==='robbed-kong'?'抢他人加杠的第四张':input.source==='flower'?'补花后摸到和牌张':'普通牌来源'}；{input.lastWall?'牌墙末张事件已发生':'不是末张'}；{input.visibleOtherCopies===3?'其余三张已公开':'不追加绝张条件'}；花牌{input.flowers}张。暗刻需未公开且未由点和完成；暗杠保留门清，明副露破坏门清。</p><p>完整牌形例（和牌前暗手）：</p><GuideTiles ids={input.concealed}/><p>和牌张：</p><GuideTiles ids={[input.winningTile]}/><p>副露／固定暗杠：{input.melds.length===0?'无':''}</p>{input.melds.map((m,i)=><div key={i}><span>{m.kind==='kan'?(m.opened?'明杠':'暗杠'):m.kind==='pon'?'明刻':'明顺'}</span><GuideTiles ids={m.ids}/></div>)}<p>不计与组合：{GB_GUIDE_EXCLUSIONS[f.id]??'本项无额外专属不计；仍须执行不重复、不得相同与套算约束；不能把所有匹配项无条件相加。'}{f.value<8&&f.id!=='FLOWER_TILES'?' 此项单独不足八番；需要其他合法非花番。':''}</p><small>{f.id} · {f.source}。目标番 {f.value}，非整手合计。</small></article>;})}</>}
          {section==='cases'&&<><h2>资格与支付完整算例</h2>{GB_GUIDE_CASES.map(c=><article className="gb-guide-fan" key={c.id}><h3>{c.title}</h3><p>{c.context}</p><p>和牌前暗手</p><GuideTiles ids={c.input.concealed}/><p>和牌张</p><GuideTiles ids={[c.input.winningTile]}/><p>副露／固定暗杠：{c.input.melds.length===0?'无':''}</p>{c.input.melds.map((m,i)=><div key={i}><span>{m.opened?'明':'暗'}{m.kind==='chi'?'顺':m.kind==='pon'?'刻':'杠'}</span><GuideTiles ids={m.ids}/></div>)}<p>{c.derivation}</p><strong>非花{c.expected.nonFlower}番；花{c.input.flowers}分；{c.expected.canHu?`可和，合计${c.expected.total}番`:'不能和，花分不补门槛'}。</strong></article>)}<p>F=10点和：赢家＋34、放铳者−18、另外两家各−8；自摸：赢家＋54、其他三家各−18。这里F是合法手牌番＋花分，每家另付8分基础支付。两种净变化总和均为0。</p></>}
          {section==='version'&&<><h2>本局配置与版本来源</h2><p>读取此入口传入的配置快照：{config.length==='single'?'单盘练习':'四圈十六盘'}；提示{config.hints?'开启':'关闭'}；计时{config.time.turn.kind==='unlimited'?'无限时间':`基础${config.time.turn.decisionBaseMs/1000}秒＋每盘Bank ${config.time.turn.bankPerHandMs/1000}秒`}。</p><p>{config.rulesVersion}</p><p>{config.fanTableVersion}</p><p>{config.digitalPolicyVersion}</p><p>采用WMO官网2014发布中文《麻将竞赛规则》（中文首印2009，后记2013），附件一81番种、附件四换位；历史文本，不宣称最新。正文已在本页讲解，原文来源用于追溯。</p><p>数字政策：自动公开补花，不保留或弃花；多人请求和牌仅裁定一个胜者；本地阅读规则保护性暂停。省略线下裁判操作，不改变八番资格或支付。双暗杠8番；一明一暗杠按冻结计法合计6番，不混用后来版本。</p></>}
        </div>
      </div>
    </section>
  </div>;
}
function GuideTiles({ ids }: { ids: readonly TileId[] }) { return <div className="rules-tile-line gb-guide-tiles">{ids.map((id,i)=><Tile key={i} tile={{...createTile(id,i),red:false,instanceId:`gb-guide-${id}-${i}`}} compact interactive={false}/>)}</div>; }
