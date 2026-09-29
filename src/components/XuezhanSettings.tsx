import { useState } from 'react';
import { AI_DIFFICULTY_OPTIONS, AI_PERSONALITY_OPTIONS, type AIPlayerSetting } from './MatchSettings';
import { TimeControlSettings } from './TimeControlSettings';
import { createConfig, PATTERNS, PRESETS, presetRules, RANGES, ruleId, stableJson, validateConfig, type Pattern, type Preset, type XzConfig, type XzRules } from '../game/xuezhan/config';
import { disabledReason, RULE_FIELDS } from '../game/xuezhan/fields';
import { downloadXz } from './XuezhanScreen';
import { BackButton } from './BackButton';
import './xuezhan.css';
const DRAFT = 'local-mahjong.xuezhan.config.v1';
export function XuezhanSettings({ onBack, onStart, onResume, onAudio, onAppearance }: { onBack: () => void; onStart: (config: XzConfig) => void; onResume: () => void; onAudio: () => void; onAppearance: () => void }) {
  const [initial] = useState(() => { try { const saved = localStorage.getItem(DRAFT); return { config: saved ? validateConfig(JSON.parse(saved)) : createConfig(), notice: '' }; } catch (e) { return { config: createConfig(), notice: `已拒绝损坏或不兼容的自定义配置：${e}。当前展示新建比赛默认值，原记录保留。` }; } });
  const [config, setConfig] = useState<XzConfig>(initial.config);
  const [search, setSearch] = useState(''), [notice, setNotice] = useState(initial.notice), [importText, setImportText] = useState('');
  const [starting, setStarting] = useState(false);
  const r = config.rules, defaults = presetRules(r.preset);
  const changed = RULE_FIELDS.filter(f => stableJson(r[f.key]) !== stableJson(defaults[f.key])).map(f => f.label);
  if (stableJson(r.patterns) !== stableJson(defaults.patterns)) changed.push('番型');
  let error = ''; try { validateConfig({ ...config, ruleId: ruleId(r) }); } catch (e) { error = String((e as Error).message); }
  const update = (rules: XzRules) => setConfig(c => ({ ...c, rules, ruleId: ruleId(rules) }));
  const field = (key: keyof XzRules, value: unknown) => {
    const next = { ...r, [key]: value };
    const changes: string[] = [];
    if (key === 'selfDrawOnly' && value) { next.multiWin = false; next.passWin = 'off'; next.robKong = false; changes.push('已联动关闭多响、过手胡、抢补杠'); }
    if (key === 'kongPay' && !value) { next.transfer = false; next.refund = 'off'; changes.push('已联动关闭呼叫转移、退税'); }
    setNotice(changes.join('；')); update(next);
  };
  return <main className="menu-page xz-settings"><section className="menu-panel">
    <BackButton onClick={onBack} /><p className="menu-path">本地模式 ＞ 血战到底 ＞ 比赛信息</p><h1>血战到底 · 比赛信息</h1>
    <p>四人 · 108 张万筒条 · 不能吃 · 胡后退出行牌，四座保留 · 三家已胡或墙尽最后响应结束小局</p>
    <div className="xz-toolbar"><label>项目预设<select aria-label="血战规则预设" value={r.preset} onChange={e => update(presetRules(e.target.value as Preset))}>{Object.entries(PRESETS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <button onClick={() => update(presetRules(r.preset))}>恢复预设</button><button disabled={!!error} onClick={() => { try { localStorage.setItem(DRAFT, JSON.stringify(validateConfig({ ...config, ruleId: ruleId(r) }))); setNotice('已保存完整自定义配置与个人偏好'); } catch (e) { setNotice(String(e)); } }}>保存自定义</button>
      <button onClick={() => { try { onResume(); } catch (e) { setNotice(`无法恢复存档：${e}`); } }}>恢复存档</button><button disabled={!!error} onClick={() => downloadXz('血战配置.json', validateConfig({ ...config, ruleId: ruleId(r) }))}>导出配置</button><button onClick={onAudio}>声音设置</button><button onClick={onAppearance}>外观设置</button></div>
    <p>{changed.length ? `自定义，来源 ${PRESETS[r.preset]} v1；差异：${changed.join('、')}` : `使用 ${PRESETS[r.preset]} v1`}</p>
    <input aria-label="搜索血战规则" placeholder="搜索规则、说明、番型" value={search} onChange={e => setSearch(e.target.value)} />
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    {[...new Set(RULE_FIELDS.map(f => f.group))].map(group => <details key={group} open={search || ['比赛', '准备'].includes(group) ? true : undefined} className="xz-rule-group"><summary>{group}规则</summary><div className="settings-grid">
      {RULE_FIELDS.filter(f => f.group === group && `${f.label}${f.help}`.includes(search)).map(f => { const reason = disabledReason(f.key, r), value = r[f.key], range = RANGES[f.key]; return <label className="settings-field" key={f.key}>{f.label}
        {f.options ? <select aria-label={f.label} value={String(value)} disabled={!!reason} onChange={e => field(f.key, typeof value === 'number' ? Number(e.target.value) : e.target.value)}>{f.options.map(([v, label]) => <option key={String(v)} value={v}>{label}</option>)}</select>
          : typeof value === 'boolean' ? <input type="checkbox" aria-label={f.label} checked={value} disabled={!!reason} onChange={e => field(f.key, e.target.checked)} />
          : <input type="number" aria-label={f.label} disabled={!!reason} min={range?.[0]} max={range?.[1]} value={Number(value)} onChange={e => field(f.key, Number(e.target.value))} />}
        <small>{reason ?? f.help} 默认：{typeof defaults[f.key] === 'boolean' ? defaults[f.key] ? '开启' : '关闭' : f.options?.find(([v]) => v === defaults[f.key])?.[1] ?? String(defaults[f.key])}</small></label>; })}</div></details>)}
    <details open={search ? true : undefined} className="xz-rule-group"><summary>高级番型（受限 0–3 番）</summary><div className="settings-grid">{(Object.keys(PATTERNS) as Pattern[]).filter(id => PATTERNS[id].join('').includes(search)).map(id => {
      const [label, help] = PATTERNS[id], value = r.patterns[id];
      const reason = id === 'robKong' && !r.robKong ? '未开启抢补杠' : ['kongDiscard', 'lastDiscard', 'earth'].includes(id) && r.selfDrawOnly ? '仅自摸时不适用' : null;
      return <label key={id} className="settings-field">{label}<input aria-label={`启用${label}`} type="checkbox" disabled={!!reason} checked={value.enabled} onChange={e => update({ ...r, patterns: { ...r.patterns, [id]: { ...value, enabled: e.target.checked } } })} />
        <input aria-label={`${label}番值`} type="number" min="0" max="3" disabled={!value.enabled || !!reason} value={value.fan} onChange={e => update({ ...r, patterns: { ...r.patterns, [id]: { ...value, fan: Number(e.target.value) } } })} /><small>{reason ?? help}；默认 {defaults.patterns[id].enabled ? '开启' : '关闭'}，{defaults.patterns[id].fan}番。</small></label>;
    })}</div></details>
    <TimeControlSettings mode="xuezhan" value={config.time} onChange={time => setConfig(c => ({ ...c, time }))} />
    <div className="settings-grid">{(['exchange', 'missing'] as const).filter(k => k === 'exchange' ? !!r.exchange : r.missing === 'declared').map(key => { const time = config.time.preparation![key], label = key === 'exchange' ? '换牌' : '定缺'; return <label key={key}>{label}独立时限<select aria-label={`${label}时限类型`} value={time.kind} onChange={e => setConfig(c => ({ ...c, time: { ...c.time, preparation: { ...c.time.preparation!, [key]: e.target.value === 'unlimited' ? { kind: 'unlimited' } : { kind: 'fixed', durationMs: key === 'exchange' ? 30000 : 10000 } } } }))}><option value="fixed">限时</option><option value="unlimited">不限时</option></select>{time.kind === 'fixed' && <input aria-label={`${label}秒数`} type="number" min="1" max="3600" value={time.durationMs / 1000} onChange={e => setConfig(c => ({ ...c, time: { ...c.time, preparation: { ...c.time.preparation!, [key]: { kind: 'fixed', durationMs: Number(e.target.value) * 1000 } } } }))} />}</label>; })}</div>
    <details className="xz-rule-group"><summary>AI 与个人偏好</summary><div className="settings-grid">{config.ai.map((ai, index) => <label key={ai.playerId}>电脑 {ai.playerId}<select aria-label={`电脑${ai.playerId}难度`} value={ai.difficulty} onChange={e => setConfig(c => ({ ...c, ai: c.ai.map((a, i) => i === index ? { ...a, difficulty: e.target.value as AIPlayerSetting['difficulty'] } : a) }))}>{AI_DIFFICULTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select><select aria-label={`电脑${ai.playerId}个性`} value={ai.personality} onChange={e => setConfig(c => ({ ...c, ai: c.ai.map((a, i) => i === index ? { ...a, personality: e.target.value as AIPlayerSetting['personality'] } : a) }))}>{AI_PERSONALITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}
      {Object.entries({ autoWin: '初始自动和牌', suppressCalls: '初始不碰杠', autoTsumogiri: '初始自动摸切', legalHelp: '合法牌辅助', waitsHelp: '听牌辅助', fanHelp: '番数辅助', spectator: '胡后公开观战' }).map(([key, label]) => <label key={key}>{label}<input type="checkbox" disabled={key === 'fanHelp' && !config.preferences.waitsHelp} checked={config.preferences[key as keyof typeof config.preferences]} onChange={e => setConfig(c => ({ ...c, preferences: { ...c.preferences, [key]: e.target.checked } }))} />{key === 'fanHelp' && !config.preferences.waitsHelp && <small>开启听牌辅助后显示对应番数。</small>}</label>)}</div></details>
    <details><summary>只读规则摘要与 JSON 导入</summary><p>{r.rounds}局，底分{r.base}，{r.cap ? `${r.cap}番封顶` : '不封顶'}，{r.missing === 'declared' ? '定缺' : '自由打缺'}，{r.exchange ? `换${r.exchange}张` : '不换牌'}。规则标识 {ruleId(r)}</p><pre>{JSON.stringify(config, null, 2)}</pre><textarea aria-label="导入血战配置" value={importText} onChange={e => setImportText(e.target.value)} /><button onClick={() => { try { if (importText.length > 50000) throw new Error('配置超过大小限制'); setConfig(validateConfig(JSON.parse(importText))); setNotice('配置已验证并导入'); } catch (e) { setNotice(String(e)); } }}>验证导入</button></details>
    <button className="xz-primary" disabled={!!error || starting} onClick={() => { try { const validated = validateConfig({ ...config, ruleId: ruleId(r) }); setStarting(true); localStorage.setItem(DRAFT, JSON.stringify(validated)); onStart(validated); } catch (e) { setStarting(false); setNotice(String(e)); } }}>开始血战比赛</button>
  </section></main>;
}
