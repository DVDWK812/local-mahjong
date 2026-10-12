import {useEffect,useState,type ReactNode} from 'react';
import {GB_SCENARIOS} from '../game/guobiao/scenarios';
import type {GbState} from '../game/guobiao/types';
import {GB_TEST_KEY,parseGbSave,type GbSave} from '../game/guobiao/persistence';
import {GuobiaoScreen} from './GuobiaoScreen';
export function GuobiaoTestTab({tabs,onExit,onSessionChange,onVoiceStop,onAudio}:{tabs:ReactNode;onExit:()=>void;onSessionChange?:(active:boolean)=>void;onVoiceStop?:()=>void;onAudio?:()=>void}){
 const[session,setSession]=useState<{id:string;state:GbState;saved?:GbSave}|null>(null);
 const[error,setError]=useState('');
 const restore=()=>{try{const raw=localStorage.getItem(GB_TEST_KEY);if(!raw)throw new Error('尚无国标测试存档');const saved=parseGbSave(raw);if(!saved.isolated)throw new Error('测试入口只能恢复隔离存档');setSession({id:'restored',state:saved.state,saved});setError('');}catch(e){setError(`恢复失败：${e instanceof Error?e.message:String(e)}`);}};
 useEffect(()=>{onSessionChange?.(!!session);return()=>onSessionChange?.(false);},[session,onSessionChange]);
 if(session)return <GuobiaoScreen key={session.id} config={session.state.config} initialState={session.state} saved={session.saved} isolated onVoiceStop={onVoiceStop} onAudio={onAudio} onExit={()=>setSession(null)}/>;
 return <main className="test-mode-library">{tabs}<header className="test-mode-heading"><span className="test-environment-badge">测试环境</span><div><h1>国标麻将测试</h1><p>场景使用正式合法动作与算番；保存隔离，不写入普通存档和牌谱。</p></div><button onClick={onExit}>返回主菜单</button></header><button onClick={restore}>恢复上次国标测试</button>{error&&<p role="alert">{error}</p>}<section className="test-mode-scenario-grid">{GB_SCENARIOS.map(c=><article className="test-mode-scenario-card" key={c.id}><h2>{c.name}</h2><p>{c.description}</p><p>测试过程尚未人工签收；完全控制可切换操作席。</p><button onClick={()=>setSession({id:c.id,state:c.make()})}>开始：{c.name}</button></article>)}</section></main>;
}

