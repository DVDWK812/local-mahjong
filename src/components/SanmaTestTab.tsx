import { sanmaEvidenceStale } from '../game/sanma/evidence';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import buildStamp from 'virtual:xz-build';
import { ModeResultsStorage } from '../game/testMode/resultsStorage';
import { createSanmaConfig, sanmaFingerprint, SANMA_RULE_VERSION, type SanmaLength, type TsumoPolicy } from '../game/sanma/config';
import { SANMA_CASES, loadSanmaCase, runSanmaCase, type SanmaCase } from '../game/sanma/scenarios';
import { createSanma } from '../game/sanma/engine';
import { downloadSanma, parseSanmaSave, saveSanma, type SanmaSave } from '../game/sanma/persistence';
import type { SanmaState } from '../game/sanma/types';
import { SanmaScreen } from './SanmaScreen';
import './sanma.css';

interface Result { caseId: string; caseVersion: number; ruleVersion: string; fingerprint: string; code: typeof buildStamp; seed: number; length: SanmaLength; policy: TsumoPolicy;
  automatic: '未运行' | '通过' | '不通过'; manual: '待核查' | '通过' | '不通过'; notes: string; at: string; expected?: string[]; actual?: unknown; error?: string; evidence?: SanmaSave }
export function SanmaTestTab({ tabs, onExit, onSessionChange, onVoiceStop }: { onVoiceStop?: () => void; tabs?: ReactNode; onExit: () => void; onSessionChange?: (active: boolean) => void }) {
  const store = useMemo(() => new ModeResultsStorage<Result>(localStorage, 'sanma', 1), []), [results, setResults] = useState(() => store.load());
  const [length, setLength] = useState<SanmaLength>('east-only'), [policy, setPolicy] = useState<TsumoPolicy>('loss'), [seed, setSeed] = useState(100), [category, setCategory] = useState('全部'), [query, setQuery] = useState('');
  const [session, setSession] = useState<{ key: number; state: SanmaState; case?: SanmaCase; saved?: SanmaSave } | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [importText, setImportText] = useState('');
  const config = useMemo(() => createSanmaConfig(length, policy), [length, policy]);
  useEffect(() => { onSessionChange?.(!!session); return () => onSessionChange?.(false); }, [!!session, onSessionChange]);
  const fingerprint = (t: SanmaCase) => sanmaFingerprint({ ...t, run: undefined, seed, config: { ...config, ...t.config } });
  const stale = (t: SanmaCase, r?: Result) => sanmaEvidenceStale(r, { code: buildStamp.fingerprint, ruleVersion: SANMA_RULE_VERSION, fingerprint: fingerprint(t) });
  const blank = (t: SanmaCase): Result => ({ caseId: t.caseId, caseVersion: t.version, ruleVersion: SANMA_RULE_VERSION, fingerprint: fingerprint(t), code: buildStamp, seed,
    length: t.config?.length ?? length, policy: t.config?.tsumoPolicy ?? policy, automatic: '未运行', manual: '待核查', notes: '', at: new Date().toISOString() });
  const persist = (next: Record<string, Result>) => { setResults(next); try { store.save(next); } catch (e) { setMessage(`核查记录保存失败：${e}`); } };
  const load = (t?: SanmaCase) => { try { const state = t ? loadSanmaCase(t, config, seed) : createSanma(config, seed); setSession({ key: (session?.key ?? 0) + 1, state, case: t }); setMessage(''); } catch (e) { setMessage(String(e)); } };
  const run = async (cases: SanmaCase[]) => {
    setBusy(true); const next = { ...results };
    try {
      for (const t of cases) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const base = stale(t, next[t.caseId]) ? blank(t) : next[t.caseId] ?? blank(t);
        try {
          const result = runSanmaCase(t, config, seed);
          next[t.caseId] = { ...base, at: new Date().toISOString(), automatic: result.passed ? '通过' : '不通过', expected: result.expected, actual: result.actual, error: result.error,
            evidence: saveSanma(result.state, undefined, result.initial, true) };
        } catch (e) { next[t.caseId] = { ...base, automatic: '不通过', error: String(e) }; }
      }
      persist(next);
    } finally { setBusy(false); }
  };
  const editManual = (t: SanmaCase, patch: Partial<Pick<Result, 'manual' | 'notes'>>) => persist({ ...results, [t.caseId]: { ...(stale(t, results[t.caseId]) ? blank(t) : results[t.caseId] ?? blank(t)), ...patch, at: new Date().toISOString() } });
  const exportReport = () => downloadSanma('三人测试诊断.json', { ruleVersion: SANMA_RULE_VERSION, code: buildStamp, at: new Date().toISOString(), length, policy, seed, results });
  if (session) {
    const t = session.case, result = t ? results[t.caseId] : undefined;
    return <><SanmaScreen onVoiceStop={onVoiceStop} key={session.key} config={session.state.config} initialState={session.state} saved={session.saved} isolated onExit={() => setSession(null)} />
      <details className="sanma-case-banner"><summary>展开／收起场景核查</summary><strong>{t?.caseId ?? '自由测试'} · {t?.name ?? '真实三人自由对局'}</strong><p>种子{session.state.seed} · {session.state.config.length === 'east-only' ? '三人东' : '三人南'} · {session.state.config.tsumoPolicy === 'loss' ? '有损' : '无损'}</p>
        <details open><summary>操作与预期</summary>{t?.steps.map(step => <p key={step}>{step}</p>)}{t?.expected.map(expected => <p key={expected}>预期：{expected}</p>)}{t?.manualFocus.map(focus => <p key={focus}>人工重点：{focus}</p>)}<p>先暂停；勾选完全控制关闭 AI；关闭自动操作清除当前观察席的自动设置（换席后分别关闭）。暂停时单步推进一次后仍暂停。测试时钟＋5秒会主动触发权威超时。听感核查请在本人浏览器移除 mute=1 后重新加载，并在声音设置取消静音；自动验证始终静音。</p></details>
        <button onClick={() => load(t)}>同seed重置场景</button><button onClick={() => setSession(null)}>返回三人测试Tab</button>{t && <><button disabled={busy} onClick={() => void run([t])}>运行当前场景自动检查</button><p>自动：{stale(t, result) ? '需复验' : result?.automatic ?? '未运行'}</p><p>{result?.error}</p>
          <label>人工核查<select aria-label={`${t.caseId}人工核查`} value={stale(t, result) ? '待核查' : result?.manual ?? '待核查'} onChange={e => editManual(t, { manual: e.target.value as Result['manual'] })}>{['待核查', '通过', '不通过'].map(v => <option key={v}>{v}</option>)}</select></label><textarea aria-label={`${t.caseId}人工备注`} value={result?.notes ?? ''} onChange={e => editManual(t, { notes: e.target.value })} /></>}
        <button onClick={exportReport}>导出诊断报告</button>
      </details></>;
  }
  const filtered = SANMA_CASES.filter(t => (category === '全部' || t.category === category) && `${t.caseId}${t.name}${t.description}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="sanma-test">{tabs}<header className="sanma-test-toolbar"><h1>三人立直麻将</h1><button onClick={onExit}>返回主菜单</button></header><p>正式规则、权威计时与三席3D共同运行。自动断言和人工核查分别记录；测试使用独立存储，默认完全控制及注入测试时钟。</p>
    <div className="sanma-test-toolbar"><label>比赛长度<select aria-label="三人测试比赛长度" value={length} onChange={e => setLength(e.target.value as SanmaLength)}><option value="east-only">三人东</option><option value="hanchan">三人南</option></select></label>
      <label>支付策略<select aria-label="三人测试支付策略" value={policy} onChange={e => setPolicy(e.target.value as TsumoPolicy)}><option value="loss">有自摸损</option><option value="split_missing_share_ceil100">无自摸损</option></select></label><label>固定seed<input aria-label="三人测试seed" type="number" min="0" max="4294967295" value={seed} onChange={e => setSeed(Number(e.target.value))} /></label>
      <button onClick={() => load()}>开始自由测试对局</button><button disabled={busy} onClick={() => void run(filtered)}>运行筛选场景自动检查</button><button onClick={exportReport}>导出诊断报告</button>
    </div><p>带有固定支付或长度的金样场景采用卡片指定配置；其他场景采用上方选择。</p>
    <div className="sanma-test-toolbar"><label>场景分类<select value={category} onChange={e => setCategory(e.target.value)}><option>全部</option>{[...new Set(SANMA_CASES.map(t => t.category))].map(v => <option key={v}>{v}</option>)}</select></label><input aria-label="搜索三人场景" placeholder="caseId、名称或规则" value={query} onChange={e => setQuery(e.target.value)} /><span>{filtered.length}个场景 · 规则{SANMA_RULE_VERSION} · 工作区{buildStamp.fingerprint.slice(0, 12)}</span></div>
    {message && <p role="alert">{message}</p>}<div className="sanma-test-grid">{filtered.map(t => {
      const r = results[t.caseId], invalid = stale(t, r);
      return <article key={t.caseId}><h2>{t.name}</h2><code>{t.caseId} · v{t.version}</code><p>{t.description}</p><p>自动：{invalid ? '需复验' : r?.automatic ?? '未运行'} · 人工：{invalid ? '待核查（版本变化）' : r?.manual ?? '待核查'}</p>{r?.error && <p role="alert">{r.error}</p>}
        <details><summary>前置条件、操作步骤与观察重点</summary><p>{t.preconditions}</p><ol>{t.steps.map(v => <li key={v}>{v}</li>)}</ol><ul>{[...t.expected, ...t.manualFocus].map(v => <li key={v}>{v}</li>)}</ul></details>
        <button onClick={() => load(t)}>加载 {t.caseId}</button><button disabled={busy} onClick={() => void run([t])}>自动检查</button>
        <label>人工核查<select aria-label={`${t.caseId}人工核查`} value={invalid ? '待核查' : r?.manual ?? '待核查'} onChange={e => editManual(t, { manual: e.target.value as Result['manual'] })}>{['待核查', '通过', '不通过'].map(v => <option key={v}>{v}</option>)}</select></label><textarea aria-label={`${t.caseId}人工备注`} placeholder="人工观察、复现步骤、截图位置" value={r?.notes ?? ''} onChange={e => editManual(t, { notes: e.target.value })} />
      </article>;
    })}</div><details><summary>导入三人存档或失败复现（测试隔离）</summary><textarea aria-label="三人存档JSON" value={importText} onChange={e => setImportText(e.target.value)} /><button onClick={() => { try { const saved = parseSanmaSave(importText); setSession({ state: saved.state, saved: { ...saved, isolated: true }, key: Date.now() }); } catch (e) { setMessage(String(e)); } }}>验证并加载</button></details>
  </main>;
}
