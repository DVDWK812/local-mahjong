// Browser QA only: existing validated fixtures, official engine actions, real renderer/consumer/backend.
// This isolated page does not mount TestMode or alter App Replay/Test audio policy or persisted games.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Board} from '/src/components/Board';
import {SeventeenStepsScreen} from '/src/components/SeventeenStepsScreen';
import {createSeventeenPresentationFixture} from '/src/dev/seventeenPresentationFixtures';
import {getRulePreset} from '/src/game/match/matchRules';
import {getBuiltInTestScenarios,getChiihouExampleScenario} from '/src/game/testMode/builtInScenarios';
import {loadTestScenarioState} from '/src/game/testMode/scenario';
import {applyOfficialTestModeAction} from '/src/game/testMode/actions';
import {AudioManager} from '/src/audio/AudioManager';
import {AudioPresentationConsumer} from '/src/audio/AudioPresentationConsumer';
import {MusicLibrary} from '/src/audio/musicLibrary';
import {DEFAULT_AUDIO_SETTINGS} from '/src/audio/audioSettings';
import {createDefaultAudioBackend} from '/src/audio/audioBackend';
import {presentationAudioCues} from '/src/presentation/PresentationAudioCue';
import {presentationEventBus} from '/src/presentation/PresentationEventBus';
import '/src/styles/tokens.css'; import '/src/styles.css';
window.qaLog=[];
const log=(type,data)=>window.qaLog.push({type,t:performance.now(),...data});
const backend=createDefaultAudioBackend(); const create=backend.createPlayback.bind(backend);
backend.createPlayback=asset=>{log('backend',{id:asset.id,src:asset.src,channel:asset.channel}); const h=create(asset),play=h.play.bind(h); h.play=()=>play().then(()=>log('play-ok',{id:asset.id}),error=>{log('play-error',{id:asset.id,error:String(error)});throw error});return h;};
const music=new MusicLibrary(); await music.initialize();
const audio=new AudioManager(DEFAULT_AUDIO_SETTINGS,backend); audio.setMusicLibrary(music);
const connect=presentationAudioCues.connect.bind(presentationAudioCues);
presentationAudioCues.connect=sink=>connect(cue=>{log('cue',{kind:cue.kind,event:cue.event,phase:cue.phase,progress:cue.progress});sink(cue)});
const consumer=new AudioPresentationConsumer(audio);
presentationEventBus.subscribe(event=>log('event',{event}));
window.addEventListener('pagehide',()=>{consumer.dispose();audio.dispose();music.dispose()},{once:true});
const scenarios=[...getBuiltInTestScenarios(),getChiihouExampleScenario()];
function Four({scenario}) {
 const [state,setState]=useState(()=>loadTestScenarioState(scenario));
 const [control,setControl]=useState(state.currentPlayer);
 const action=a=>setState(s=>applyOfficialTestModeAction(s,a));
 return <><Board gameState={state} controlledPlayerId={control} tableBottomPlayerId={0} handAnimationsEnabled={true}
 onDiscard={(playerId,tileInstanceId)=>action({type:'discard',playerId,tileInstanceId})}
 onDeclareRiichi={(playerId,tileInstanceId)=>action({type:'riichi',playerId,tileInstanceId})}
 onTsumo={playerId=>action({type:'tsumo',playerId})} onRon={playerId=>action({type:'ron',playerId})}
 onPassRon={playerId=>action({type:'pass-ron',playerId})} onPon={playerId=>action({type:'pon',playerId})}
 onChi={(playerId,optionIndex)=>action({type:'chi',playerId,optionIndex})}
 onKan={(playerId,kanType,tileId)=>action({type:'kan',playerId,kanType,tileId})}
 onChankanRon={playerId=>action({type:'chankan-ron',playerId})} onPassChankan={playerId=>action({type:'pass-chankan',playerId})}
 onPassCall={()=>action({type:'pass-call'})} onSkipDrawActions={()=>{}} onDeclareKyuushuKyuuhai={()=>{}} onReset={()=>{}} />
 <div style={{position:'fixed',top:42,left:0,zIndex:9999,background:'white'}}>
 <select aria-label="控制玩家" value={control} onChange={e=>setControl(Number(e.target.value))}>{[0,1,2,3].map(id=><option key={id} value={id}>玩家{id+1}</option>)}</select>
 <button disabled={state.phase!=='draw'} onClick={()=>action({type:'draw'})}>正式摸牌</button>
 <button onClick={()=>action({type:'ai-next'})}>正式 AI 动作</button><span>{state.phase} / {state.currentPlayer}</span></div></>;
}
function Harness(){
 const initial=new URLSearchParams(location.search).get('fixture')??scenarios[0].id;
 const [id,setId]=useState(initial);
 const seventeen=id.startsWith('17-') ? createSeventeenPresentationFixture(id.slice(3)) : null;
 return <><div style={{position:'fixed',top:0,left:0,zIndex:9999,background:'white'}}><label>隔离音效 QA 场景 <select value={id} aria-label="音效 QA 场景" onChange={e=>{audio.stopSfx();setId(e.target.value)}}>{scenarios.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}{['ron','last-turn','initial'].map(s=><option key={s} value={'17-'+s}>17步 {s}</option>)}</select></label></div>
 {seventeen ? <SeventeenStepsScreen key={id} initialState={seventeen} matchConfig={seventeen.matchConfig} ruleConfig={getRulePreset('east-round')} onBack={()=>location.href='/'} /> : <Four key={id} scenario={scenarios.find(s=>s.id===id)} />}</>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);
