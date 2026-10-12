import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { inspectXzReport } from '../game/xuezhan/report';
import { XuezhanConfigTools } from './XuezhanConfigTools';
import buildStamp from 'virtual:xz-build';
import { ModeResultsStorage } from '../game/testMode/resultsStorage';
import { loadXzScenario, runXzCase, xzCases, type XzTestCase } from '../game/xuezhan/scenarios';
import { fingerprint, PRESETS } from '../game/xuezhan/config';
import { parseXzSave, replayXz, saveXz } from '../game/xuezhan/persistence';
import { XuezhanScreen, downloadXz } from './XuezhanScreen';
import type { XzState } from '../game/xuezhan/types';
interface Result { caseVersion: number; ruleId: string; caseHash: string; code: typeof buildStamp; batch: string; at: string; execution: 'browser'; automatic: '未运行' | '运行中' | '通过' | '失败' | '阻塞' | '跳过'; manual: '待复核' | '通过' | '失败' | '阻塞' | '不适用'; notes: string; error?: string; evidence?: ReturnType<typeof saveXz> }
export function XuezhanTestTab({ tabs, onSessionChange }: { tabs?: ReactNode; onSessionChange?: (active: boolean) => void }) {
  const cases = useMemo(xzCases, []), store = useMemo(() => new ModeResultsStorage<Result>(localStorage, 'xuezhan', 1), []);
  const [results, setResults] = useState(() => store.load()), [group, setGroup] = useState('全部'), [keyword, setKeyword] = useState(''), [type, setType] = useState('全部'), [status, setStatus] = useState('全部'), [risk, setRisk] = useState('全部'), [preset, setPreset] = useState('全部');
  const [session, setSession] = useState<{ test?: XzTestCase; state: XzState; key: number } | null>(null), [busy, setBusy] = useState(false), [importText, setImportText] = useState(''), [error, setError] = useState('');
  useEffect(() => { onSessionChange?.(!!session); return () => onSessionChange?.(false); }, [!!session, onSessionChange]);
  const stale = (t: XzTestCase, r?: Result) => !!r && (r.caseVersion !== t.version || r.ruleId !== t.scenario.config.ruleId || r.caseHash !== fingerprint(t.scenario) || r.code.fingerprint !== buildStamp.fingerprint);
  const filtered = cases.filter(t => (group === '全部' || t.group === group) && (type === '全部' || t.type === type) && (risk === '全部' || t.risk === risk) && (preset === '全部' || t.scenario.config.rules.preset === preset) && (status === '全部' || (stale(t, results[t.id]) ? '需复验' : results[t.id]?.automatic ?? '未运行') === status) && `${t.id}${t.scenario.name}${t.keywords.join('')}`.includes(keyword));
  const blank = (t: XzTestCase): Result => ({ caseVersion: t.version, ruleId: t.scenario.config.ruleId, caseHash: fingerprint(t.scenario), code: buildStamp, batch: '', at: new Date().toISOString(), execution: 'browser', automatic: '未运行', manual: t.type === 'automatic' ? '不适用' : '待复核', notes: '' });
  const persist = (next: Record<string, Result>) => { setResults(next); try { store.save(next); } catch (e) { setError(`结果写入失败：${e}`); } };
  const run = async (selected: XzTestCase[]) => {
    setBusy(true); const batch = `xz-${Date.now()}`, next = { ...results };
    try {
      for (const t of selected.filter(t => t.type !== 'visual')) {
        const entry = stale(t, next[t.id]) ? blank(t) : next[t.id] ?? blank(t);
        next[t.id] = { ...entry, batch, at: new Date().toISOString(), automatic: '运行中' }; setResults({ ...next });
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const result = runXzCase(t);
        next[t.id] = { ...next[t.id], automatic: result.passed ? '通过' : '失败', error: result.error, evidence: saveXz(result.state) };
      }
      persist(next);
    } finally { setBusy(false); }
  };
  if (session) return <div className="xz-test-session"><div className="xz-test-controls"><button onClick={() => setSession(null)}>返回血战用例</button><button onClick={() => session.test && setSession({ test: session.test, state: loadXzScenario(session.test.scenario), key: session.key + 1 })}>重置固定场景</button><span>隔离测试 · {session.test?.scenario.name ?? '导入复现'}</span></div><XuezhanScreen key={session.key} config={session.state.config} initialState={session.state} isolated onExit={() => setSession(null)} /></div>;
  return <>{tabs}<main className="xz-tests"><h1>血战到底 · 测试者模式</h1><p>自动与人工结果独立。当前代码 {buildStamp.commit.slice(0, 12)} / {buildStamp.fingerprint.slice(0, 16)}。快照 {buildStamp.snapshotId ?? '工作区'} · {buildStamp.buildMode}。自动通过不能替代真人复核。</p>
    <div className="xz-toolbar"><input aria-label="搜索血战用例" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="搜索 ID、功能、关键词" />
      <select aria-label="用例分组" value={group} onChange={e => setGroup(e.target.value)}>{['全部', ...new Set(cases.map(t => t.group))].map(v => <option key={v}>{v}</option>)}</select>
      <select aria-label="用例类型" value={type} onChange={e => setType(e.target.value)}><option>全部</option><option value="automatic">自动</option><option value="hybrid">混合</option><option value="visual">视觉</option></select>
      <select aria-label="用例状态" value={status} onChange={e => setStatus(e.target.value)}>{['全部', '未运行', '通过', '失败', '阻塞', '需复验'].map(v => <option key={v}>{v}</option>)}</select>
      <select aria-label="用例风险" value={risk} onChange={e => setRisk(e.target.value)}>{['全部', '高', '中'].map(v => <option key={v}>{v}</option>)}</select>
      <select aria-label="用例预设" value={preset} onChange={e => setPreset(e.target.value)}><option>全部</option>{Object.entries(PRESETS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <button disabled={busy} onClick={() => void run(cases)}>运行全部自动部分</button><button disabled={busy} onClick={() => void run(filtered)}>运行当前分组与筛选</button><button disabled={busy} onClick={() => void run(cases.filter(t => results[t.id]?.automatic === '失败'))}>重跑失败项</button><button onClick={() => downloadXz('血战测试报告.json', { mode: 'xuezhan', schemaVersion: 1, code: buildStamp, results })}>导出报告</button></div>
    {error && <p role="alert">{error}</p>}<div className="xz-test-grid">{filtered.map(t => { const r = results[t.id], invalid = stale(t, r); return <article key={t.id}><h2>{t.scenario.name}</h2><code>{t.id} · 用例v{t.version} · {t.scenario.config.ruleId}</code><p>{t.scenario.description}</p><span className="xz-test-status">自动：{invalid ? '需复验' : r?.automatic ?? '未运行'} · 人工：{invalid ? '需复验' : r?.manual ?? '待复核'}</span><p>{r?.error}</p>
      <details><summary>前置条件、步骤、预期与人工检查</summary><p>固定种子 {t.scenario.seed}，四座108张有效初始牌，生产创建入口与动作序列。</p><ol>{t.steps.map(v => <li key={v}>{v}</li>)}</ol><ul>{t.expectedResults.map(v => <li key={v}>{v}</li>)}{t.manualChecks.map(v => <li key={v}>{v}</li>)}</ul></details>
      <button disabled={busy} onClick={() => setSession({ test: t, state: loadXzScenario(t.scenario), key: Date.now() })}>加载真实场景</button>{t.type !== 'visual' && <button disabled={busy} onClick={() => void run([t])}>运行自动部分</button>}
      <label>人工复核（仅测试者填写）<select aria-label={`${t.id}人工复核`} value={invalid ? '待复核' : r?.manual ?? '待复核'} onChange={e => persist({ ...results, [t.id]: { ...(invalid ? blank(t) : r ?? blank(t)), manual: e.target.value as Result['manual'], at: new Date().toISOString() } })}>{['待复核', '通过', '失败', '阻塞', '不适用'].map(v => <option key={v}>{v}</option>)}</select></label>
      <textarea aria-label={`${t.id}复核备注`} placeholder="实际步骤、期望/实际、截图路径或备注" value={r?.notes ?? ''} onChange={e => persist({ ...results, [t.id]: { ...(r ?? blank(t)), notes: e.target.value } })} />
      {r?.evidence && <><button disabled={invalid} onClick={() => { try { setSession({ test: t, state: replayXz(r.evidence!), key: Date.now() }); } catch (e) { setError(String(e)); } }}>加载自动结果</button><button onClick={() => downloadXz(`${t.id}-复现.json`, r.evidence)}>导出动作、规则与账本复现</button></>}</article>; })}</div>
    <XuezhanConfigTools/><details><summary>回读测试报告（只读，不覆盖验收记录）</summary><textarea aria-label="血战报告JSON" onChange={e => setImportText(e.target.value)} /><button onClick={() => { try { const report = inspectXzReport(importText); setError(`报告校验通过：${report.cases} 个用例，代码 ${report.fingerprint}，快照 ${report.snapshotId ?? '未记录'}；人工记录未写入。`); } catch (e) { setError(String(e)); } }}>校验报告</button></details><details><summary>导入失败复现（隔离验证）</summary><textarea aria-label="血战失败复现JSON" value={importText} onChange={e => setImportText(e.target.value)} /><button onClick={() => { try { const saved = parseXzSave(importText); setSession({ state: replayXz(saved), key: Date.now() }); } catch (e) { setError(String(e)); } }}>验证并加载复现</button></details>
  </main></>;
}
