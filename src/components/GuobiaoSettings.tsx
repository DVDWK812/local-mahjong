import { useCallback, useState } from 'react';
import { BackButton } from './BackButton';
import { TimeControlSettings } from './TimeControlSettings';
import { AI_DIFFICULTY_OPTIONS,AI_PERSONALITY_OPTIONS } from './MatchSettings';
import { createGbConfig,snapshotGbConfig,type GbConfig } from '../game/guobiao/config';
import { GB_SAVE_KEY,GB_HISTORY_KEY,parseGbSave,type GbSave } from '../game/guobiao/persistence';
import { GuobiaoRulesGuide } from './rulesGuide/GuobiaoRulesGuide';
export function GuobiaoSettings({onBack,onStart,onResume}:{onBack:()=>void;onStart:(c:GbConfig)=>void;onResume:(save:GbSave,replay?:boolean)=>void}){
  const[c,setC]=useState(createGbConfig),[error,setError]=useState('');
  const[rulesOpen,setRulesOpen]=useState(false);
  const closeRules=useCallback(()=>setRulesOpen(false),[]);
  const start=()=>{try{onStart(snapshotGbConfig(c));}catch(e){setError(String(e));}};
  const resume=(replay=false)=>{try{const raw=replay?JSON.parse(localStorage.getItem(GB_HISTORY_KEY)??'[]')[0]:localStorage.getItem(GB_SAVE_KEY);if(!raw)throw new Error('暂无国标存档或牌谱');onResume(parseGbSave(typeof raw==='string'?raw:JSON.stringify(raw)),replay);}catch(e){setError(String(e));}};
  return <><main className="menu-page"><section className="menu-panel menu-panel--wide"><BackButton onClick={onBack}/><p className="menu-path">本地模式 ＞ 国标麻将 ＞ 比赛设置</p><h1>国标麻将</h1><button onClick={()=>setRulesOpen(true)}>比赛规则</button>
    <section className="settings-block"><h2>比赛预设</h2><label className="settings-field">长度<select value={c.length} onChange={e=>setC({...c,length:e.target.value as GbConfig['length']})}><option value="sixteen">完整局：四圈十六盘</option><option value="single">单盘练习</option></select></label>
      <label><input type="checkbox" checked={c.hints} onChange={e=>setC({...c,hints:e.target.checked})}/>显示本人牌形与点和／自摸资格提示</label></section>
    <section className="settings-block"><h2>电脑设置</h2>{c.ai.map((a,i)=><div className="settings-grid" key={a.playerId}><label>{c.names[a.playerId]}难度<select value={a.difficulty} onChange={e=>setC({...c,ai:c.ai.map((v,n)=>n===i?{...v,difficulty:e.target.value as typeof a.difficulty}:v)})}>{AI_DIFFICULTY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><label>风格<select value={a.personality} onChange={e=>setC({...c,ai:c.ai.map((v,n)=>n===i?{...v,personality:e.target.value as typeof a.personality}:v)})}>{AI_PERSONALITY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label></div>)}</section>
    <TimeControlSettings mode="guobiao" value={c.time} onChange={time=>setC({...c,time})}/>
    {error&&<p role="alert">{error}</p>}<div className="settings-footer"><button onClick={()=>resume()}>恢复国标比赛</button><button onClick={()=>resume(true)}>查看最近国标牌谱</button><button onClick={start}>开始游戏</button></div>
  </section></main>{rulesOpen&&<GuobiaoRulesGuide config={c} onBack={closeRules}/>}</>;
}
