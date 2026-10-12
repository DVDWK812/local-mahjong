import {describe,it,expect} from 'vitest';
import {createGbConfig} from './config';
import {applyGb,assertGbConservation,createGb,legalGbActions} from './engine';
import {chooseGbAction,observeGb} from './ai';
import {GB_SEATS} from './types';
import type {AIPlayerSetting} from '../../components/MatchSettings';
import {gbFixture} from './scenarios';
describe('国标AI预算、合法性、难度人格和完整比赛',()=>{
 it('多档难度与人格为实际决策参数，固定种子确定性',()=>{const s=gbFixture({0:{hand:'123456789m 222p E F'}}),o=observeGb(s,0);o.remaining=20;
  const choices=new Set<string>();for(const difficulty of ['chikukon','shintentai','upper','kishin'] as const)for(const personality of ['balanced','aggressive','defensive'] as const){
   const setting:AIPlayerSetting={playerId:1,difficulty,personality};const a=chooseGbAction(o,setting);expect(o.legal).toContainEqual(a);expect(chooseGbAction(o,setting)).toEqual(a);choices.add(JSON.stringify(a));}
  expect(choices.size).toBeGreaterThan(1);
 });
 for(const length of ['single','sixteen'] as const)for(const seed of [3,42,2026])it(`${length} / seed ${seed} 真实AI E2E`,()=>{
  const config=createGbConfig(length);let s=createGb(config,seed),steps=0;const started=performance.now();
  while(!s.completed&&steps<10000){const actor=GB_SEATS.find(id=>legalGbActions(s,id).length);expect(actor).toBeDefined();const o=observeGb(s,actor!);
   const a=chooseGbAction(o,{playerId:1,difficulty:'shintentai',personality:['balanced','aggressive','defensive'][actor!%3] as AIPlayerSetting['personality']});expect(o.legal).toContainEqual(a);
   const next=applyGb(s,actor!,a!);expect(next).not.toBe(s);s=next;assertGbConservation(s);steps++;}
  expect(s.completed).toBe(true);expect(s.handNumber).toBe(length==='sixteen'?16:1);expect(steps).toBeLessThan(10000);expect(performance.now()-started).toBeLessThan(90000);
 },100000);
});
