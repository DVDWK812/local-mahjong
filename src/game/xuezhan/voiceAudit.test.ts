import { describe,it,expect } from 'vitest';
import { xzCases,loadXzScenario } from './scenarios';
import { applyXz,defaultAction } from './engine';
import { publishXzTransition } from '../../presentation/table/xuezhanPresentation';
import { presentationEventBus,type PresentationEvent } from '../../presentation/PresentationEventBus';
import { voiceEventFromPresentation } from '../../audio/voice/voiceEvents';
import type { Seat,XzState } from './types';
function capture(before:XzState,after:XzState) {
 const events:PresentationEvent[]=[];const stop=presentationEventBus.subscribe(e=>events.push(e));
 try{publishXzTransition(before,after);}finally{stop();}return events;
}
describe('血战语音现状审计（不接新事件）',()=>{
 it('首胡只产生后续摸牌，不误送日麻结算或整场结束',()=>{
  const before=loadXzScenario(xzCases().find(c=>c.id==='XZ-FIRST')!.scenario);
  const after=applyXz(before,0,{type:'win'});expect(after.wins).toHaveLength(1);expect(after.phase).not.toBe('ended');
  const events=capture(before,after);expect(events.map(e=>e.type)).toEqual(['tile_drawn']);
  expect(events.map(voiceEventFromPresentation).filter(Boolean)).toEqual([]);
 });
 it('三响结算目前没有胡牌播报，不能误称已去重完成播报',()=>{
  let state=loadXzScenario(xzCases().find(c=>c.id==='XZ-TRIPLE')!.scenario);const events:PresentationEvent[]=[];
  for(const seat of [1,2,3] as Seat[]){const next=applyXz(state,seat,{type:'win'});events.push(...capture(state,next));state=next;}
  expect(state.wins).toHaveLength(1);expect(state.wins[0].winners).toEqual([1,2,3]);expect(events).toEqual([]);
 });
 it('准备阶段的未公开定缺和换牌不会进入语音通道',()=>{
  let state=loadXzScenario(xzCases().find(c=>c.id==='XZ-PRESET-2')!.scenario);
  for(let i=0;i<20&&state.phase!=='turn';i++)for(const seat of [0,1,2,3] as Seat[]){const action=defaultAction(state,seat);if(!action)continue;const next=applyXz(state,seat,action);expect(capture(state,next).map(voiceEventFromPresentation).filter(Boolean)).toEqual([]);state=next;}
  expect(state.phase).toBe('turn');
 });
});
