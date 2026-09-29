import { INFRA_V1_ENABLED, SELECTION_MINUTES, snapshotTimeControl, TIME_LIMITS, type MatchMode, type TimeControlConfig } from '../game/timeControl/config';
import { RuleHelpTooltip } from './RuleHelpTooltip';
import './matchClockHud.css';

export function TimeControlSettings({ mode, value, onChange }: { mode: MatchMode; value: TimeControlConfig; onChange: (value: TimeControlConfig) => void }) {
  if (!INFRA_V1_ENABLED[mode]) return null;
  let error = '';
  try { snapshotTimeControl(value, mode); } catch (e) { error = (e as Error).message; }
  const turn = value.turn;
  const selection = value.seventeenSelection;
  return <section className="settings-block" aria-label="时间控制">
    <h2 className="time-control-heading">时间控制 <RuleHelpTooltip description={'基础时间用完后才消耗本小局 Bank；未用完的基础时间不累存。比赛开始后配置只读。\n\n摸牌超时弃真实摸入牌；响应超时跳过；吃碰后按固定牌序选择合法弃牌。'} /></h2>
    <div className="settings-grid">
      <label className="settings-field">出牌计时<select aria-label="出牌计时" value={turn.kind} onChange={e => onChange({ ...value, turn: e.target.value === 'unlimited' ? { kind: 'unlimited' } : { kind: 'banked', decisionBaseMs: 5000, bankPerHandMs: 20000 } })}>
        <option value="banked">限时</option><option value="unlimited">不限时</option>
      </select></label>
      {turn.kind === 'banked' && <>
        <label className="settings-field">响应基础时间（秒）<input aria-label="响应基础时间（秒）" type="number" min="0.001" max={TIME_LIMITS.baseMaxMs / 1000} step="1" value={Number.isFinite(turn.decisionBaseMs) ? turn.decisionBaseMs / 1000 : ''} onChange={e => onChange({ ...value, turn: { ...turn, decisionBaseMs: e.target.value === '' ? NaN : Number(e.target.value) * 1000 } })} /></label>
        <label className="settings-field">小局累计额外响应时间（秒）<input aria-label="小局累计额外响应时间（秒）" type="number" min="0" max={TIME_LIMITS.bankMaxMs / 1000} step="1" value={Number.isFinite(turn.bankPerHandMs) ? turn.bankPerHandMs / 1000 : ''} onChange={e => onChange({ ...value, turn: { ...turn, bankPerHandMs: e.target.value === '' ? NaN : Number(e.target.value) * 1000 } })} /></label>
      </>}
      {mode === 'seventeen' && <label className="settings-field">选牌计时<select aria-label="选牌计时" value={selection?.kind === 'fixed' ? selection.durationMs : 120000} onChange={e => onChange({ ...value, seventeenSelection: { kind: 'fixed', durationMs: Number(e.target.value) } })}>
        {SELECTION_MINUTES.map(minutes => <option key={minutes} value={minutes * 60000}>{minutes}分钟</option>)}
      </select></label>}
    </div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
