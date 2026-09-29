import { useState } from 'react';
import { BackButton } from './BackButton';
import { TimeControlSettings } from './TimeControlSettings';
import { createSanmaConfig, snapshotSanmaConfig, type SanmaConfig, type SanmaLength, type TsumoPolicy } from '../game/sanma/config';
import { parseSanmaSave, SANMA_HISTORY_KEY, SANMA_SAVE_KEY, type SanmaSave } from '../game/sanma/persistence';
import type { PlayerProfile } from '../profile/playerProfile';
import './sanma.css';

export function SanmaLengthMenu({ onBack, onChoose }: { onBack: () => void; onChoose: (length: SanmaLength) => void }) {
  return <main className="menu-page"><section className="menu-panel"><BackButton onClick={onBack} /><p className="menu-path">本地模式 ＞ 立直麻将 ＞ 三人间</p><h1>选择比赛长度</h1><div className="menu-actions">
    <button onClick={() => onChoose('east-only')}>三人东</button><button onClick={() => onChoose('hanchan')}>三人南</button>
  </div></section></main>;
}
export function SanmaSettings({ length, profile, onBack, onStart, onResume }: { length: SanmaLength; profile?: PlayerProfile; onBack: () => void; onStart: (config: SanmaConfig) => void; onResume: (save: SanmaSave, replay?: boolean) => void }) {
  const [config, setConfig] = useState(() => { const c = createSanmaConfig(length); return { ...c, names: [profile?.nickname || '你', '电脑一', '电脑二'] as [string, string, string] }; });
  const [error, setError] = useState(''), [history, setHistory] = useState<SanmaSave[] | null>(null);
  const title = length === 'east-only' ? '三人东' : '三人南';
  const load = () => { try { const raw = localStorage.getItem(SANMA_SAVE_KEY); if (!raw) throw new Error('暂无三人存档'); const save = parseSanmaSave(raw); if (save.isolated) throw new Error('测试存档不能进入正式比赛'); onResume(save); } catch (e) { setError(String(e)); } };
  return <main className="menu-page"><section className="menu-panel menu-panel--wide sanma-settings"><BackButton onClick={onBack} /><p className="menu-path">本地模式 ＞ 立直麻将 ＞ 三人间 ＞ {title}</p><h1>{title} · 赛前配置</h1>
    <p>一名真人与两名 AI，从东一开始。常规最终局为{length === 'east-only' ? '东三' : '南三'}，含连庄及{length === 'east-only' ? '南入' : '西入'}。</p>
    <div className="settings-grid">
      <label className="settings-field">自摸损<select aria-label="自摸损" value={config.tsumoPolicy} onChange={e => setConfig({ ...config, tsumoPolicy: e.target.value as TsumoPolicy })}><option value="loss">有（默认）</option><option value="split_missing_share_ceil100">无（均摊缺席份额，向上取百点）</option></select></label>
      {([['startingPoints', '起始点数'], ['targetPoints', '终局目标'], ['returnPoints', '成绩返还点']] as const).map(([key, label]) => <label className="settings-field" key={key}>{label}<input aria-label={label} type="number" step="100" min="1000" value={config[key]} onChange={e => setConfig({ ...config, [key]: Number(e.target.value) })} /></label>)}
    </div>
    <section className="sanma-player-settings"><h2>三名玩家</h2>{config.names.map((name, seat) => <div key={seat}><strong>{seat === 0 ? '真人' : `AI ${seat}`}</strong><input aria-label={`玩家${seat + 1}昵称`} value={name} onChange={e => setConfig({ ...config, names: config.names.map((n, i) => i === seat ? e.target.value : n) as SanmaConfig['names'] })} />
      {seat > 0 && <><label>难度<select aria-label={`AI ${seat}难度`} value={config.ai[seat - 1].difficulty} onChange={e => setConfig({ ...config, ai: config.ai.map((a, i) => i === seat - 1 ? { ...a, difficulty: e.target.value as typeof a.difficulty } : a) })}>{[['chikukon', '筑魂'], ['shintentai', '心天体'], ['upper', '上级'], ['kishin', '鬼神']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>风格<select aria-label={`AI ${seat}风格`} value={config.ai[seat - 1].personality} onChange={e => setConfig({ ...config, ai: config.ai.map((a, i) => i === seat - 1 ? { ...a, personality: e.target.value as typeof a.personality } : a) })}><option value="balanced">均衡</option><option value="defensive">防守</option><option value="aggressive">进攻</option></select></label></>}
    </div>)}</section>
    <TimeControlSettings mode="sanma" value={config.time} onChange={time => setConfig({ ...config, time })} />
    <details open><summary>三人规则摘要</summary><p>108张，移除二至八万；红五筒、红五索各一张。禁止吃，可碰杠。北为客风，可以保留、弃出或拔北；拔北不破门清。允许有役抢北及双响；拔北补牌计岭上。</p><p>一番起和，宝牌不能单独构成役。本场荣和200／自摸每家100；不听罚符总额2000。顺位分＋20／0／−20，默认头名奖励15点。到达终局目标后仍按末局规则判断。</p><p>自动摸切会弃出真实摸入的北，不会自动拔北。比赛开始后，时间及支付规则以本场快照为准。</p></details>
    {error && <p role="alert">{error}</p>}<div className="settings-footer"><button onClick={onBack}>返回</button><button onClick={load}>恢复三人存档</button><button onClick={() => { try { const rows = JSON.parse(localStorage.getItem(SANMA_HISTORY_KEY) ?? '[]') as unknown[]; setHistory(rows.map(v => parseSanmaSave(JSON.stringify(v)))); } catch (e) { setError(String(e)); } }}>三人牌谱</button><button onClick={() => { try { onStart(snapshotSanmaConfig(config)); } catch (e) { setError(String(e)); } }}>开始{title}</button></div>
    {history && <section><h2>三人牌谱</h2>{history.length ? history.map((save, i) => <button key={i} onClick={() => onResume(save, true)}>{save.state.config.length === 'east-only' ? '三人东' : '三人南'} · {save.state.config.tsumoPolicy === 'loss' ? '有损' : '无损'} · 种子{save.state.seed} · {save.state.actions.length}步</button>) : <p>完成比赛后自动保存牌谱，也可在对局中导出。</p>}</section>}
  </section></main>;
}
