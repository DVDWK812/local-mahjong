import { useEffect, useState } from 'react';
import { AI_DIFFICULTY_OPTIONS, AI_PERSONALITY_OPTIONS, type AIPlayerSetting } from './MatchSettings';
import { TimeControlSettings } from './TimeControlSettings';
import { createConfig, PATTERNS, PRESETS, presetRules, RANGES, ruleId, validateConfig, type Pattern, type Preset, type XzConfig, type XzRules } from '../game/xuezhan/config';
import { disabledReason, RULE_FIELDS } from '../game/xuezhan/fields';
import { XuezhanRulesGuide } from './rulesGuide/XuezhanRulesGuide';
import { BackButton } from './BackButton';
import './xuezhan.css';
const DRAFT = 'local-mahjong.xuezhan.config.v1';
export function XuezhanSettings({ onBack, onStart }: { onBack: () => void; onStart: (config: XzConfig) => void; onResume?: () => void; onAudio?: () => void; onAppearance?: () => void }) {
  const [initial] = useState(() => { try { const saved = localStorage.getItem(DRAFT); return { config: saved ? validateConfig(JSON.parse(saved)) : createConfig(), notice: '' }; } catch (e) { return { config: createConfig(), notice: `已拒绝损坏或不兼容的自定义配置：${e}。当前展示新建比赛默认值，原记录保留。` }; } });
  const [config, setConfig] = useState<XzConfig>(initial.config);
  const [notice, setNotice] = useState(initial.notice), [guide, setGuide] = useState(false);
  const [starting, setStarting] = useState(false);
  const r = config.rules;
  useEffect(() => {
    if (config === initial.config) return;
    try { localStorage.setItem(DRAFT, JSON.stringify(validateConfig(config))); } catch { /* invalid drafts remain editable, last valid persisted config is retained */ }
  }, [config, initial.config]);
  let error = ''; try { validateConfig({ ...config, ruleId: ruleId(r) }); } catch (e) { error = String((e as Error).message); }
  const update = (rules: XzRules) => setConfig(c => ({ ...c, rules, ruleId: ruleId(rules) }));
  const field = (key: keyof XzRules, value: unknown) => {
    const next = { ...r, [key]: value };
    const changes: string[] = [];
    if (key === 'selfDrawOnly' && value) { next.multiWin = false; next.passWin = 'off'; next.robKong = false; changes.push('已联动关闭多响、过手胡、抢补杠'); }
    if (key === 'kongPay' && !value) { next.transfer = false; next.refund = 'off'; changes.push('已联动关闭呼叫转移、退税'); }
    setNotice(changes.join('；')); update(next);
  };
  const basic = ['rounds','startingScore','exchange','missing','base','cap','selfDraw','selfDrawExtra'] as const;
  const renderField = (f: (typeof RULE_FIELDS)[number]) => {
    const reason = disabledReason(f.key,r), value=r[f.key], range=RANGES[f.key];
    if (reason && !['multiWin','passWin','robKong','unclearedCalls'].includes(f.key)) return null;
    return <label className="settings-field" key={f.key}>{f.label}{f.key==='selfDrawExtra'?`（${r.selfDraw==='fan'?'番':'底'}）`:''}
      {f.options?<select aria-label={f.label} value={String(value)} disabled={!!reason} onChange={e=>field(f.key,typeof value==='number'?Number(e.target.value):e.target.value)}>{f.options.map(([v,label])=><option key={String(v)} value={v}>{label}</option>)}</select>
        :typeof value==='boolean'?<input type="checkbox" aria-label={f.label} checked={value} disabled={!!reason} onChange={e=>field(f.key,e.target.checked)}/>
        :<input type="number" aria-label={f.label} min={range?.[0]} max={range?.[1]} value={Number(value)} onChange={e=>field(f.key,Number(e.target.value))}/>}
      {reason&&<small>{reason}</small>}
    </label>;
  };
  return <><main className="menu-page xz-settings" inert={guide}><section className="menu-panel">
    <BackButton onClick={onBack}/><p className="menu-path">本地模式 ＞ 血战到底 ＞ 比赛信息</p><h1>血战到底 · 比赛信息</h1>
    <button onClick={()=>setGuide(true)}>比赛规则</button>
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
    <h2>基本设置</h2><div className="settings-grid"><label>预设<select aria-label="血战规则预设" value={r.preset} onChange={e=>update(presetRules(e.target.value as Preset))}>{Object.entries(PRESETS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      {RULE_FIELDS.filter(f=>(basic as readonly string[]).includes(f.key)).map(renderField)}</div>
    <p>底分按积分计；自摸附加单位随“加底／加番”切换。</p>
    <details className="xz-rule-group"><summary>高级规则</summary>
      <div className="settings-grid">{RULE_FIELDS.filter(f=>!(basic as readonly string[]).includes(f.key)).map(renderField)}</div>
      <h3>番型与番值</h3><div className="settings-grid">{(Object.keys(PATTERNS) as Pattern[]).map(id=>{
        const label=PATTERNS[id][0], value=r.patterns[id];
        const reason=id==='robKong'&&!r.robKong?'未开启抢补杠':['kongDiscard','lastDiscard','earth'].includes(id)&&r.selfDrawOnly?'仅自摸时不适用':null;
        return <label key={id}>{label}<input aria-label={`启用${label}`} type="checkbox" disabled={!!reason} checked={value.enabled} onChange={e=>update({...r,patterns:{...r.patterns,[id]:{...value,enabled:e.target.checked}}})}/>
          {value.enabled&&<input aria-label={`${label}番值`} type="number" min="0" max="3" disabled={!!reason} value={value.fan} onChange={e=>update({...r,patterns:{...r.patterns,[id]:{...value,fan:Number(e.target.value)}}})}/>}
          <small>{reason??(id==='root'?'每根番值':'番值0–3')}{id==='sevenPairs'?'；关闭会关闭特殊七对胡形':''}</small></label>;
      })}</div>
    </details>
    <TimeControlSettings mode="xuezhan" value={config.time} onChange={time => setConfig(c => ({ ...c, time }))} />
    <div className="settings-grid">{(['exchange', 'missing'] as const).filter(k => k === 'exchange' ? !!r.exchange : r.missing === 'declared').map(key => { const time = config.time.preparation![key], label = key === 'exchange' ? '换牌' : '定缺'; return <label key={key}>{label}独立时限（秒）<select aria-label={`${label}时限类型`} value={time.kind} onChange={e => setConfig(c => ({ ...c, time: { ...c.time, preparation: { ...c.time.preparation!, [key]: e.target.value === 'unlimited' ? { kind: 'unlimited' } : { kind: 'fixed', durationMs: key === 'exchange' ? 30000 : 10000 } } } }))}><option value="fixed">限时</option><option value="unlimited">不限时</option></select>{time.kind === 'fixed' && <input aria-label={`${label}秒数`} type="number" min="1" max="3600" value={time.durationMs / 1000} onChange={e => setConfig(c => ({ ...c, time: { ...c.time, preparation: { ...c.time.preparation!, [key]: { kind: 'fixed', durationMs: Number(e.target.value) * 1000 } } } }))} />}</label>; })}</div>
    <section className="xz-rule-group"><h2>AI</h2><div className="settings-grid">{config.ai.map((ai, index) => <label key={ai.playerId}>电脑 {ai.playerId}<select aria-label={`电脑${ai.playerId}难度`} value={ai.difficulty} onChange={e => setConfig(c => ({ ...c, ai: c.ai.map((a, i) => i === index ? { ...a, difficulty: e.target.value as AIPlayerSetting['difficulty'] } : a) }))}>{AI_DIFFICULTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select><select aria-label={`电脑${ai.playerId}个性`} value={ai.personality} onChange={e => setConfig(c => ({ ...c, ai: c.ai.map((a, i) => i === index ? { ...a, personality: e.target.value as AIPlayerSetting['personality'] } : a) }))}>{AI_PERSONALITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}
      </div></section><details className="xz-rule-group"><summary>个人自动与辅助偏好</summary><div className="settings-grid">{Object.entries({ autoWin: '初始自动和牌', suppressCalls: '初始不碰杠', autoTsumogiri: '初始自动摸切', legalHelp: '合法牌辅助', waitsHelp: '听牌辅助', fanHelp: '番数辅助', spectator: '胡后公开观战' }).map(([key, label]) => <label key={key}>{label}<input type="checkbox" disabled={key === 'fanHelp' && !config.preferences.waitsHelp} checked={config.preferences[key as keyof typeof config.preferences]} onChange={e => setConfig(c => ({ ...c, preferences: { ...c.preferences, [key]: e.target.checked } }))} />{key === 'fanHelp' && !config.preferences.waitsHelp && <small>开启听牌辅助后显示对应番数。</small>}</label>)}</div></details>
    <button className="xz-primary" disabled={!!error || starting} onClick={() => { try { const validated = validateConfig({ ...config, ruleId: ruleId(r) }); setStarting(true); localStorage.setItem(DRAFT, JSON.stringify(validated)); onStart(validated); } catch (e) { setStarting(false); setNotice(String(e)); } }}>开始血战比赛</button>
  </section></main>{guide&&<XuezhanRulesGuide config={config} context="draft" onBack={()=>setGuide(false)}/>}</>;
}
