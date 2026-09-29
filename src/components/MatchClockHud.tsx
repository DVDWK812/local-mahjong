import { useEffect, useReducer, useState } from 'react';
import type { MatchRuntime, AutoPreferences } from '../game/timeControl/matchRuntime';
import './matchClockHud.css';

export function MatchClockHud<S>({ runtime, participantId }: { runtime: MatchRuntime<S>; participantId: string }) {
  const [expanded, setExpanded] = useState(true);
  const [, redraw] = useReducer(n => n + 1, 0);
  useEffect(() => runtime.subscribe(redraw), [runtime]);
  // Projection only: this interval cannot advance state or submit a command.
  useEffect(() => { const timer = window.setInterval(redraw, 100); return () => window.clearInterval(timer); }, [runtime]);
  const decision = runtime.decision(participantId);
  const view = runtime.budgetView(participantId);
  const preferences = runtime.preference(participantId);
  const seconds = (ms: number | null) => ms === null ? '∞' : `${Math.ceil(ms / 1000)}s`;
  const labels: Array<[keyof AutoPreferences, string, string]> = [['autoWin', '自动和牌', '和'], ['suppressCalls', runtime.policy.mode === 'xuezhan' || runtime.policy.mode === 'sanma' ? '不碰杠' : '不吃碰杠', '鸣'], ['autoTsumogiri', '自动摸切', '切']];
  return <aside className={`match-clock-hud ${expanded ? 'match-clock-hud--expanded' : 'match-clock-hud--collapsed'}`} aria-label="比赛计时与自动操作" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
    <button className="match-clock-hud__toggle" type="button" aria-label={expanded ? '收起自动操作' : '展开自动操作'} aria-expanded={expanded} onClick={() => setExpanded(v => !v)}><span aria-hidden="true">{expanded ? '‹' : '›'}</span></button>
    {expanded && <><div className="match-clock-hud__buttons">
      {labels.map(([key, label, short]) => {
        const disabled = runtime.policy.mode === 'seventeen' && key !== 'autoWin';
        const reason = key === 'autoTsumogiri' ? '17步没有摸牌，候选池不支持自动代打' : '17步没有吃碰杠';
        return <button key={key} type="button" aria-label={label} aria-pressed={preferences[key]} disabled={disabled || !!runtime.error}
          title={disabled ? reason : runtime.policy.mode === 'sanma' && key === 'autoTsumogiri' ? '自动弃出真实摸入牌，包括北；不会自动拔北' : runtime.policy.mode === 'sanma' && key === 'suppressCalls' ? '禁止碰和所有杠，仍可和牌与拔北' : key === 'suppressCalls' ? '开启后禁止吃、碰和所有杠，仍可和牌' : label}
          onClick={() => runtime.setPreference(participantId, key, !preferences[key])}>{short}{preferences[key] && <span className="match-clock-hud__mark" aria-hidden="true">{key === 'suppressCalls' ? '⊘' : '✓'}</span>}</button>;
      })}
    </div>
    {runtime.error ? <span className="match-clock-hud__time" role="alert" aria-label={runtime.error} title={runtime.error}>!</span>
      : view?.status === 'open' && <div className="match-clock-hud__time" role="timer" aria-live="off" aria-label={runtime.paused ? '计时已暂停' : decision?.kind === 'selection' ? '选牌剩余时间' : '响应剩余时间'} title={decision?.kind === 'selection' ? '选牌剩余时间' : '前者为当前基础时间，后者为本局累计额外时间'}>
        <span>{seconds(view.baseMs)}</span>{decision?.kind !== 'selection' && <span>{seconds(view.bankMs)}</span>}
      </div>}
    </>}
  </aside>;
}
