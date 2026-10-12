import { describe,it,expect,vi } from 'vitest';
import type { ManagedVoicePlayback } from '../AudioManager';
import { VoiceDirector } from './VoiceDirector';
import { VoicePresentationRuntime } from './VoicePresentationRuntime';
import { PresentationEventBus,presentationEventBus } from '../../presentation/PresentationEventBus';
import { voiceEventFromPresentation } from './voiceEvents';
import { publishGbTransition } from '../../presentation/table/guobiaoPresentation';
import { applyGb,defaultGbAction,participantId } from '../../game/guobiao/engine';
import { GB_SCENARIOS } from '../../game/guobiao/scenarios';
import { MatchRuntime } from '../../game/timeControl/matchRuntime';
import { gbPolicy } from '../../game/guobiao/runtime';
import { SanmaTestClock } from '../../game/sanma/runtime';
import { DEFAULT_AUDIO_SETTINGS } from '../audioSettings';
import { NO_VOICE_PACK_ID } from './voicePreferences';

function setup(scope:'all'|'self'='all',enabled=true){const stopped=vi.fn(),play=vi.fn().mockResolvedValue(undefined),files:string[]=[];
 const playback:ManagedVoicePlayback={stop:stopped,handle:{play,pause:vi.fn(),setVolume:vi.fn(),onEnded:()=>()=>{},dispose:vi.fn()}};
 const repo={listPacks:()=>['xiaozhang','yaya-001'].map(id=>({id,name:id,locale:'zh-CN',path:id})),getAudioForKey:(pack:string,key:string)=>`/${pack}/${key}.mp3`,getVoiceLine:(pack:string,key:string)=>({line:pack==='yaya-001'&&key==='action.ron'?'荣和':'和',tts_text:''}) as ReturnType<import('./VoicePackRepository').VoicePackRepository['getVoiceLine']>};
 const director=new VoiceDirector(repo,{createVoicePlayback:(_id,url)=>{files.push(url);return playback;}},{...DEFAULT_AUDIO_SETTINGS,voiceEnabled:enabled,discardVoiceEnabled:true,discardVoiceScope:scope,voicePackBySeat:['xiaozhang','yaya-001','xiaozhang',NO_VOICE_PACK_ID]});director.setActorSeatContext({playerIds:[0,1,2,3],playerCount:4});return {director,files,play,stopped};}
const scene=(id:string)=>GB_SCENARIOS.find(s=>s.id===id)!.make();
describe('国标公开语义进入既有单一Director',()=>{
 it('34种弃牌与all/self，重复事件只播一次；不读管理页选择',()=>{const {director,files}=setup();const bus=new PresentationEventBus();for(let id=0;id<34;id++){const e=bus.publish({type:'tile_discarded',mode:'guobiao',playerId:0,tile:{id:id as import('../../game/types').TileId,red:false},riverIndex:0,isRiichiDiscard:false});const cue=voiceEventFromPresentation(e)!;expect(director.play(cue)).toBe('played');expect(director.play(cue)).toBe('ignored');}expect(files).toHaveLength(34);
  const self=setup('self');const e=voiceEventFromPresentation(bus.publish({type:'tile_discarded',mode:'guobiao',playerId:1,tile:{id:0,red:false},riverIndex:0,isRiichiDiscard:false}))!;expect(self.director.play(e)).toBe('disabled');expect(self.files).toEqual([]);director.stop();});
 it('不播暗摸，不套日麻和牌序列；只播放最终国标自摸/流局',()=>{const {director,files}=setup();const rt=new VoicePresentationRuntime(director,presentationEventBus);rt.start();const before=scene('orphans-win'),after=applyGb(before,0,{type:'hu'});publishGbTransition(before,after,'gb-voice-test');publishGbTransition(before,after,'gb-voice-test');expect(files).toEqual(['/xiaozhang/action.tsumo.mp3']);presentationEventBus.publish({type:'tile_drawn',playerId:1});expect(files).toHaveLength(1);director.stop();presentationEventBus.publish({type:'guobiao_settled',outcome:'draw'});expect(files[files.length-1]).toBe('/xiaozhang/game.draw.mp3');rt.dispose();director.stop();});
 it('自动摸切和超时实际提交均得到报牌；恢复同态没有旧事件',()=>{const{director,files}=setup();const rt=new VoicePresentationRuntime(director);rt.start();const root=scene('single-seed'),clock=new SanmaTestClock(),match=new MatchRuntime(root,gbPolicy,root.config.time,clock);match.activate();match.setPreference(participantId(0),'autoTsumogiri',true);publishGbTransition(root,match.state,'auto');expect(files.some(f=>f.includes('/tile.'))).toBe(true);const count=files.length;publishGbTransition(match.state,match.state,'restored');expect(files).toHaveLength(count);match.dispose();rt.dispose();director.stop();
  const timeout=setup(),r=scene('single-seed'),c=new SanmaTestClock(),m=new MatchRuntime(r,gbPolicy,r.config.time,c),voice=new VoicePresentationRuntime(timeout.director);voice.start();m.activate();c.advance(25001);publishGbTransition(r,m.state,'timeout');expect(timeout.files.some(f=>f.includes('/tile.'))).toBe(true);voice.dispose();m.dispose();timeout.director.stop();});
 it('角色按participant而非换圈的风位；静音、禁用角色、缺文件与不匹配安全跳过',()=>{const{director,files}=setup();const bus=new PresentationEventBus();const e=voiceEventFromPresentation(bus.publish({type:'guobiao_settled',outcome:'ron',playerId:1}))!;expect(director.play(e)).toBe('missing');expect(director.lastMissingVoice?.reason).toContain('台词不匹配');expect(files).toEqual([]);const riichi={...e,eventId:'riichi-ron',mode:undefined};expect(director.play(riichi)).toBe('played');expect(files[files.length-1]).toContain('yaya-001');director.stop();
  const disabled=setup('all',false);expect(disabled.director.play({...e,key:'action.tsumo'})).toBe('disabled');expect(disabled.files).toEqual([]);
  const actor3=voiceEventFromPresentation(bus.publish({type:'guobiao_settled',outcome:'tsumo',playerId:3}))!;expect(director.play(actor3)).toBe('missing');});
 it('低优先级报牌被和牌抢占，旧事件在runtime stop/start后不重播',()=>{const{director,files,stopped}=setup();const bus=new PresentationEventBus(),rt=new VoicePresentationRuntime(director,bus);rt.start();const discard=bus.publish({type:'tile_discarded',mode:'guobiao',playerId:0,tile:{id:0,red:false},riverIndex:0,isRiichiDiscard:false},'discard-fixed');bus.publish({type:'guobiao_settled',outcome:'tsumo',playerId:0});expect(stopped).toHaveBeenCalled();rt.stop();rt.start();director.play(voiceEventFromPresentation(discard)!);expect(files).toHaveLength(2);rt.dispose();director.stop();});
});
