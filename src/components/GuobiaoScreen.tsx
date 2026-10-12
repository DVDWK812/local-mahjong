import { useCallback,useEffect,useLayoutEffect,useMemo,useReducer,useRef,useState } from 'react';
import { MatchRuntime } from '../game/timeControl/matchRuntime';
import { gbPolicy } from '../game/guobiao/runtime';
import { SanmaTestClock } from '../game/sanma/runtime';
import { createGb,applyGb,legalGbActions,participantId,regular } from '../game/guobiao/engine';
import { chooseGbAction,observeGb } from '../game/guobiao/ai';
import { saveGb,writeGbSave,replayGb,GB_HISTORY_KEY,type GbSave } from '../game/guobiao/persistence';
import type { GbConfig } from '../game/guobiao/config';
import { GB_SEATS,type GbAction,type GbState } from '../game/guobiao/types';
import type { PlayerId } from '../game/types';
import { tileLabel,windLabel } from '../game/tileUtils';
import { presentGb,gbInteraction,gbHudPosition,publishGbTransition,gbWaitHints } from '../presentation/table/guobiaoPresentation';
import { runPacedAutomaticAction } from '../presentation/pacing/automaticActionPacing';
import { finishHandsForAuthoritativeInput } from '../presentation/handAnimation/HandAnimationController';
import { presentationPacingGate } from '../presentation/pacing/PresentationPacingGate';
import { FormalGameScreen } from './game/FormalGameScreen';
import { FormalTable3D } from '../presentation3d/FormalTable3D';
import { Table3DHudView,Table3DCentralHudView } from '../presentation3d/Table3DHud';
import { TableCenterView } from './game/TableCenter';
import { GameTopBarView } from './game/GameTopBar';
import { MatchClockHud } from './MatchClockHud';
import { SceneErrorBoundary } from '../presentation3d/session/SceneErrorBoundary';
import { DEFAULT_APPEARANCE_SETTINGS,type AppearanceSettings } from '../presentation/appearance/appearanceSettings';
import type { PlayerProfile } from '../profile/playerProfile';
import { GB_FLOWER_IMAGES,GB_FLOWER_NAMES } from '../game/guobiao/flowerAssets';
import { GuobiaoRulesGuide } from './rulesGuide/GuobiaoRulesGuide';
import { GbReadingPause } from '../game/guobiao/readingPause';
import type { LocalHandAnimation3DState } from '../presentation3d/animation/tableAnimation3D';
import './guobiao.css';
interface Props{config:GbConfig;saved?:GbSave;initialState?:GbState;isolated?:boolean;replayOnly?:boolean;onExit:()=>void;appearance?:AppearanceSettings;profile?:PlayerProfile;onAudio?:()=>void;onVoiceStop?:()=>void;seed?:number}
const labels:Record<GbAction['type'],string>={discard:'弃牌',chi:'吃',pon:'碰',minkan:'明杠',ankan:'暗杠',kakan:'加杠',hu:'和',pass:'过',next:'下一盘'};
export function GuobiaoScreen(props:Props){
  const[root]=useState(()=>props.saved?.initial??props.initialState??createGb(props.config,props.seed??Date.now()>>>0));
  const[clock]=useState(()=>props.isolated?new SanmaTestClock():undefined);
  const[runtime]=useState(()=>new MatchRuntime(props.saved?.state??root,gbPolicy,props.config.time,clock,0,props.saved?.runtime));
  const[readingPause]=useState(()=>new GbReadingPause(runtime));
  const[rulesOpen,setRulesOpen]=useState(false);
  const openRules=useCallback(()=>{readingPause.acquire('rules-guide');setRulesOpen(true);},[readingPause]);
  const closeRules=useCallback(()=>{setRulesOpen(false);readingPause.release('rules-guide',started.current&&!props.replayOnly);},[readingPause,props.replayOnly]);
  const[presentationSession]=useState(()=>`gb:${crypto.randomUUID()}`);
  const[,render]=useReducer(n=>n+1,0),[ready,setReady]=useState(false),[domReady,setDomReady]=useState(false),[viewer,setViewer]=useState<PlayerId>(0);
  const[selected,setSelected]=useState<string|null>(null),[fullControl,setFullControl]=useState(!!props.isolated),[details,setDetails]=useState(false);
  const[replayResultOpen,setReplayResultOpen]=useState(false);
  const[message,setMessage]=useState(''),[fallback,setFallback]=useState(()=>new URLSearchParams(location.search).get('table3d')==='0'),[resultVisible,setResultVisible]=useState(false);
  const[localAnimation,setLocalAnimation]=useState<LocalHandAnimation3DState|null>(null);
  const[replayStep,setReplayStep]=useState<number|null>(props.replayOnly?props.saved?.state.commands.length??0:null),[playing,setPlaying]=useState(false);
  const state=runtime.state,replay=replayStep!==null,archive=useMemo(()=>saveGb(state,undefined,root,!!props.isolated),[state,root,props.isolated]);
  const s=useMemo(()=>replay?replayGb(archive,replayStep!):state,[replay,replayStep,archive,state]);
  const view=useMemo(()=>presentGb(s,viewer,selected),[s,viewer,selected]),hints=useMemo(()=>s.config.hints?gbWaitHints(s,viewer):[],[s,viewer]);
  const handInputEnabled=ready&&domReady&&!replay&&!runtime.paused;
  const handPresentation=handInputEnabled?view.hand:{...view.hand,canDiscard:false,playableTileInstanceIds:[],tiles:view.hand.tiles.map(t=>({...t,playable:false}))};
  const appearance=props.appearance??DEFAULT_APPEARANCE_SETTINGS,session=`gb:${s.seed}:${s.handNumber}:${viewer}`;
  const previous=useRef(state),started=useRef(false),attached=useRef(0);
  useEffect(()=>runtime.subscribe(render),[runtime]);
  useEffect(()=>{const generation=++attached.current;runtime.resumeAfterRemount();return()=>{runtime.pause();finishHandsForAuthoritativeInput();queueMicrotask(()=>{if(attached.current===generation)runtime.dispose();});};},[runtime]);
  useEffect(()=>{if(ready&&domReady&&!props.replayOnly&&!started.current&&!rulesOpen){started.current=true;runtime.activate();}},[ready,domReady,runtime,props.replayOnly,rulesOpen]);
  useLayoutEffect(()=>{if(previous.current!==state){if(!replay)publishGbTransition(previous.current,state,presentationSession);previous.current=state;setSelected(null);}},[state,replay,presentationSession]);
  useEffect(()=>{if(replay)props.onVoiceStop?.();},[replay,props.onVoiceStop]);
  useEffect(()=>()=>props.onVoiceStop?.(),[props.onVoiceStop]);
  useEffect(()=>{if(!s.result){setResultVisible(false);return;}let active=true;void presentationPacingGate.waitUntilClear({timeoutMs:15000}).then(()=>{if(active)setResultVisible(true);});return()=>{active=false;};},[s.result]);
  const save=useCallback(()=>{if(props.replayOnly)return;if(!started.current){setMessage('牌桌尚未就绪，请稍后保存');return;}try{writeGbSave(localStorage,saveGb(runtime.state,runtime.snapshot(),root,!!props.isolated));setMessage('已保存国标比赛及剩余时间');}catch(e){setMessage(`保存失败：${e}`);}},[runtime,root,props.isolated,props.replayOnly]);
  useEffect(()=>{if(props.isolated||props.replayOnly)return;const unsub=runtime.subscribe(()=>{if(started.current)try{writeGbSave(localStorage,saveGb(runtime.state,runtime.snapshot(),root));}catch(e){setMessage(`自动保存失败：${e}`);}});window.addEventListener('beforeunload',save);return()=>{unsub();window.removeEventListener('beforeunload',save);};},[runtime,root,props.isolated,props.replayOnly,save]);
  useEffect(()=>{if(!state.completed||props.isolated||props.replayOnly)return;try{const list=JSON.parse(localStorage.getItem(GB_HISTORY_KEY)??'[]') as GbSave[];localStorage.setItem(GB_HISTORY_KEY,JSON.stringify([archive,...list.filter(v=>v.state.seed!==state.seed)].slice(0,12)));}catch(e){setMessage(`牌谱保存失败：${e}`);}},[state.completed,state.seed,archive,props.isolated,props.replayOnly]);
  const command=useCallback((id:PlayerId,a:GbAction)=>{if(replay)return;finishHandsForAuthoritativeInput();
    if(a.type==='next'){runtime.advance(current=>applyGb(current,id,a));return;}
    runtime.command(participantId(id),runtime.decision(participantId(id))?.id,current=>applyGb(current,id,a));
  },[runtime,replay]);
  useEffect(()=>{if(!ready||!domReady||replay||fullControl||runtime.paused)return;let cancelled=false;
    const prepared=GB_SEATS.filter(id=>id!==0&&legalGbActions(state,id).length).flatMap(id=>{const a=chooseGbAction(observeGb(state,id),state.config.ai[id-1]);if(!a)return[];const p=runtime.preparePolicyCommand(participantId(id),current=>applyGb(current,id,a));return p?[p]:[];});
    void runPacedAutomaticAction(()=>{if(!cancelled&&runtime.state===state&&!runtime.paused)prepared.forEach(p=>p.commit());},{isCancelled:()=>cancelled});
    return()=>{cancelled=true;prepared.forEach(p=>p.cancel());};
  },[state,runtime,ready,domReady,replay,fullControl,runtime.paused]);
  useEffect(()=>{if(!replay||!playing)return;if(replayStep!>=state.commands.length){setPlaying(false);return;}const t=setTimeout(()=>setReplayStep(n=>n!+1),650);return()=>clearTimeout(t);},[replay,playing,replayStep,state.commands.length]);
  useEffect(()=>{if(fallback)setReady(true);},[fallback]);
  const usable=useCallback(()=>setReady(true),[]),handReady=useCallback(()=>setDomReady(true),[]),interaction=gbInteraction(setSelected,tile=>command(viewer,{type:'discard',tile}));
  const available=view.legal.filter(a=>a.type!=='discard'&&a.type!=='next'),lastFlowers=s.events.slice(-10).filter(e=>e.type==='flower').map(e=>{const t=s.wall.tiles[e.tile!];return t.kind==='flower'?`${s.players[e.actor!].name}补${GB_FLOWER_NAMES[t.flower]}`:'';});
  const step=()=>{const paused=runtime.paused;if(paused)runtime.activate();const id=GB_SEATS.find(id=>legalGbActions(runtime.state,id).length);if(id!==undefined){const a=chooseGbAction(observeGb(runtime.state,id));if(a)command(id,a);}if(paused)runtime.pause();};
  const result=s.result;
  return <><FormalGameScreen data-gb-phase={s.phase} data-gb-sequence={s.sequence} data-gb-hand={s.handNumber}
    topBar={<GameTopBarView currentName={s.players[s.current].name} currentWind={view.players[s.current].seatWind} phaseLabel={runtime.paused?'已暂停':s.phase==='response'?'等待响应':s.phase==='ended'?'本盘结束':'打牌'} modeLabel={s.config.length==='single'?'国标·单盘练习':'国标·四圈十六盘'} analysisOpen={details} onOpenRulesGuide={openRules} onOpenAudioSettings={props.onAudio??(()=>undefined)} onToggleAnalysis={()=>setDetails(v=>!v)} onReturnMenu={()=>{if(!props.replayOnly)save();props.onExit();}} controls={props.replayOnly?null:<><button disabled={!ready||!domReady} onClick={()=>runtime.paused?runtime.activate():runtime.pause()}>{runtime.paused?'继续比赛':'暂停'}</button><button disabled={!ready||!domReady} onClick={save}>保存</button></>}/>} appearance={{settings:appearance}}
    table={fallback?<section className="gb-legacy" data-table-renderer="2.5d"><p>兼容模式</p>{view.mapping.filter(m=>m.id!==viewer).map(m=><p key={m.id}>{s.players[m.id].name}：手牌{s.players[m.id].hand.length}张，积分{s.players[m.id].score}，花{s.players[m.id].flowers.length}张</p>)}</section>:<SceneErrorBoundary fallback={null} onError={()=>{setFallback(true);setReady(true);}}><FormalTable3D sceneState={view.scene} animationsEnabled={!replay} animationSessionKey={session} animationTurn={s.sequence} onLocalHandAnimationChange={setLocalAnimation} appearanceSettings={appearance} onReady={usable} onUnavailable={()=>{setFallback(true);setReady(true);}}
      centralHud={<Table3DCentralHudView><TableCenterView scores={view.mapping.map(m=>({playerId:m.id,className:`center-score--${gbHudPosition(m.seat)}`,slot:m.seat,score:s.players[m.id].score,wind:view.players[m.id].seatWind,current:m.id===s.current,dealer:m.id===s.dealer}))} roundLabel={`${windLabel(view.roundWind)}圈${(s.handNumber-1)%4+1}盘`} remainingLabel={`剩余${view.remaining}张`}/></Table3DCentralHudView>}
      hud={<Table3DHudView players={view.mapping.map(m=>({position:gbHudPosition(m.seat),player:view.players[m.id],nickname:s.players[m.id].name,status:`花${s.players[m.id].flowers.length}`}))} playerProfile={props.profile}/>}/></SceneErrorBoundary>}
    localHand={{player:view.player,meldPlayer:{...view.player,calls:[]},isCurrent:s.current===viewer,canDiscard:handPresentation.canDiscard,presentation:handPresentation,interactionActions:interaction,onDiscard:(_,tile)=>command(viewer,{type:'discard',tile}),onPresentationReady:handReady,screenSpaceOverlay:true,doraGlowEnabled:false,localHandAnimation:localAnimation}}
    actionPrompt={<section className="gb-actions" aria-label="国标动作栏">{available.map((a,i)=><button key={i} disabled={replay||runtime.paused||!ready||!domReady} onClick={()=>command(viewer,a)}>{labels[a.type]}{'tile'in a&&typeof a.tile==='number'?` ${tileLabel(a.tile)}`:a.type==='chi'?` ${a.tiles.map(id=>tileLabel(regular(s,s.players[viewer].hand.find(i=>regular(s,i).instanceId===id)!))).join('、')}`:''}</button>)}</section>}
    tenpai={hints.length>0&&<p className="gb-waits">牌形听牌：{hints.map(h=><span key={h.id}>{tileLabel(h.id)}（可见推算余{h.remaining}）：点和{h.ron.nonFlowerFan}番{h.ron.canHu?'可和':'不足8番'}／自摸{h.tsumo.nonFlowerFan}番{h.tsumo.canHu?'可和':'不足8番'}； </span>)}条件番仅实际发生后计入</p>}
    details={details&&<section className="gb-details"><button onClick={()=>setDetails(false)}>关闭分析</button><h2>牌局分析</h2><p>本人公开花牌{s.players[viewer].flowers.length}张；剩余牌{view.remaining}张。点和与自摸资格见下方听牌提示；番种定义与完整教学请打开右上角规则说明。</p></section>}
    result={result&&resultVisible&&(!replay||replayResultOpen)&&<div className="gb-result-backdrop"><section className="gb-result" role="dialog" aria-label="国标结算"><h2>{result.kind==='draw'?'流局':`${s.players[result.winner!].name}${result.from===null?'自摸':'点和'}`}</h2>{result.score&&<><p>手牌{result.score.nonFlowerFan}番 ＋ 花牌{result.score.flowerFan}分 ＝ 合计{result.score.totalFan}番</p><p>每家基础支付8分，番值不等于赢家收入</p><div className="gb-fan-list">{result.score.fanItems.map(f=><p key={f.id}>{f.name} × {f.count}：{f.value*f.count}分</p>)}</div><details><summary>拆解与排除依据</summary><p>{result.score.decomposition?.groups.map((g,i)=>`${i+1}组：${g.ids.map(tileLabel).join("、")}（${g.opened?"明":"暗"}）`).join("；")}；将牌：{result.score.decomposition?.pair===undefined?"特殊牌形":tileLabel(result.score.decomposition.pair)}</p>{result.score.excludedItems.map(f=><p key={f.id}>{f.name}：{f.reason}</p>)}</details></>}
      <table><thead><tr><th>玩家</th><th>本盘净变化</th><th>累计积分</th></tr></thead><tbody>{s.players.map(p=><tr key={p.id}><td>{p.name}</td><td>{result.deltas[p.id]>=0?'+':''}{result.deltas[p.id]}</td><td>{p.score}</td></tr>)}</tbody></table><details><summary>支付账本</summary>{result.payments.map(p=><p key={p.id}>{s.players[Number(p.payer.split(':')[1])].name} → {s.players[Number(p.payee.split(':')[1])].name}：{p.amount}（{p.reason==='base'?'底分':'番分'}）</p>)}</details>
      {s.completed?<><h3>比赛结束</h3>{[...s.players].sort((a,b)=>b.score-a.score||a.id-b.id).map((p,i)=><p key={p.id}>{i+1}. {p.name}　{p.score}</p>)}<button onClick={props.onExit}>返回设置</button></>:<button onClick={()=>command(0,{type:'next'})}>下一盘</button>}{replay?<button onClick={()=>setReplayResultOpen(false)}>关闭结算</button>:<button onClick={()=>{runtime.pause();setReplayResultOpen(false);setReplayStep(state.commands.length);setResultVisible(false);}}>查看回放</button>}</section></div>}
  >
    <MatchClockHud runtime={runtime} participantId={participantId(viewer)}/><div className="gb-flower-summary" aria-label="四家花牌归属">{s.players.map(p=><details key={p.id}><summary>{p.name}：{p.flowers.length}花</summary>{p.flowers.map(i=>{const t=s.wall.tiles[i];return t.kind==='flower'?<img key={t.instanceId} src={GB_FLOWER_IMAGES[t.flower]} alt={`${p.name}的${GB_FLOWER_NAMES[t.flower]}`}/>:null;})}</details>)}</div>
    {lastFlowers.length>0&&<p className="gb-flower-feedback">{lastFlowers.join('，')}</p>}{message&&<p className="gb-message" role="status">{message}</p>}
    {props.isolated&&!replay&&<details className="gb-test-controls"><summary>国标测试控制</summary><label><input type="checkbox" checked={fullControl} onChange={e=>setFullControl(e.target.checked)}/>完全控制（关闭电脑）</label><label>操作席<select value={viewer} onChange={e=>setViewer(Number(e.target.value) as PlayerId)}>{s.players.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><button onClick={step}>单步推进</button><button onClick={()=>clock?.advance(5000)}>时钟＋5秒</button></details>}
    <details className="gb-replay-controls"><summary>国标回放</summary><button onClick={()=>{runtime.pause();setReplayStep(state.commands.length);}}>打开回放</button>{replay&&<><input aria-label="国标回放位置" type="range" min={root.commands.length} max={state.commands.length} value={replayStep!} onChange={e=>{setReplayResultOpen(false);setReplayStep(Number(e.target.value));}}/><span>{replayStep}/{state.commands.length}</span>{result&&<button onClick={()=>setReplayResultOpen(true)}>本步结算详情</button>}<button onClick={()=>setPlaying(v=>!v)}>{playing?'暂停回放':'顺序播放'}</button>{!props.replayOnly&&<button onClick={()=>{setPlaying(false);setReplayStep(null);runtime.activate();}}>返回实时牌局</button>}</>}</details>
  </FormalGameScreen>{rulesOpen&&<GuobiaoRulesGuide config={state.config} onBack={closeRules}/>}{fallback&&!ready&&<button onClick={usable}>进入兼容牌局</button>}</>;
}





