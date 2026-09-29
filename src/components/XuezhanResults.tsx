import { useState } from 'react';
import type { XzState } from '../game/xuezhan/types';

/** Read-only view of authoritative wins and accounting; never derives legality. */
export function XuezhanResults({ state: s, onNext, onLedger, onExit }: { state: XzState; onNext: () => void; onLedger: () => void; onExit: () => void }) {
  const [open, setOpen] = useState(true);
  const ended = s.phase === 'ended';
  if (!ended && !s.wins.length) return null;
  return <section className={`xz-result${open ? '' : ' xz-result-collapsed'}`} aria-label="血战胡牌与结算信息">
    <div className="xz-result-heading"><strong>{ended ? s.completed ? '整场结果' : '小局结算' : '胡牌记录 · 继续观战'}</strong><button aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? '收起结果' : '展开结果'}</button></div>
    {open && <div className="xz-result-scroll" tabIndex={0} aria-label="血战结果明细（可滚动）">
      {ended && <p>{s.results[s.results.length - 1]?.reason === 'wall' ? '墙尽：退税 → 花猪 → 查叫已结清' : '三家已胡'}</p>}
      <table><thead><tr><th>玩家</th><th>状态</th><th>总分</th><th>本局</th></tr></thead><tbody>{s.players.map(p => <tr key={p.id}><th>{p.name}</th><td>{p.won !== null ? '已胡' : ended ? '未胡' : '行牌中'}</td><td>{p.score}</td><td>{p.score - s.handStartScores[p.id]}</td></tr>)}</tbody></table>
      {s.wins.map(w => <div key={w.id}><h3>{w.from === null ? '自摸' : `${s.players[w.from].name}放炮`} · {w.winners.length} 家胡牌</h3>{w.winners.map((id, i) => <details key={id} className="xz-winner"><summary>{s.players[id].name} · {w.scores[i].label} · {w.scores[i].fan}番 → 计{w.scores[i].cappedFan}番</summary><p>基础点 {w.scores[i].base}；单份胡分 {w.scores[i].payment}</p><p>{w.scores[i].patterns.map(p => `${p.name} ${p.fan}番`).join('、') || '无附加番型'}</p></details>)}</div>)}
    </div>}
    {open && <div className="xz-result-actions">{ended && !s.completed && <button onClick={onNext}>下一局</button>}<button onClick={onLedger}>查看逐笔账本</button>{ended && <button onClick={onExit}>返回</button>}</div>}
  </section>;
}
