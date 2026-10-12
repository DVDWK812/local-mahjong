import { describe,it,expect } from 'vitest';
import { createTile } from '../tileUtils';
import type { TileId } from '../types';
import { BASIC_HAND, GUIDE_GOLDENS, GUIDE_EXAMPLE_RULES, PLAIN_HAND, XZ_PATTERN_GUIDE } from './guide';
import { PATTERNS, createConfig, presetRules } from './config';
import { scoreHand } from './scoring';
import { applyXz, createXzMatch } from './engine';
import { wallForHands } from './scenarios';
import { MatchRuntime } from '../timeControl/matchRuntime';
import { xzPolicy } from './runtime';
import type { Clock } from '../timeControl/decisionClock';
import { beginRulesReading } from '../../components/rulesGuide/readingSession';

const tiles=(ids:readonly number[])=>ids.map((id,i)=>({...createTile(id as TileId,i),red:false}));
describe('血战教程独立牌例与金样',()=>{
  it('16项无遗漏且所有完整牌例合法并包含对应奖励',()=>{
    expect(XZ_PATTERN_GUIDE.map(p=>p.id).sort()).toEqual(Object.keys(PATTERNS).sort());
    for(const p of XZ_PATTERN_GUIDE){
      const r=presetRules('declared');r.patterns[p.id].enabled=true;
      const ids=[...p.example.hand,p.example.winningTile].map(t=>t.id);
      const score=scoreHand(tiles(ids),p.example.melds??[],2,r,p.context);
      expect(score, p.id).not.toBeNull();expect(score!.patterns.some(x=>x.id===p.id),p.id).toBe(true);
    }
  });
  it('缺门反例和关闭七对的资格差异',()=>{
    expect(scoreHand(tiles(BASIC_HAND),[],2,GUIDE_EXAMPLE_RULES,{kind:'discard'})).toBeNull();
    const r=presetRules();r.patterns.sevenPairs.enabled=false;
    const p=XZ_PATTERN_GUIDE.find(p=>p.id==='sevenPairs')!;
    expect(scoreHand(tiles([...p.example.hand,p.example.winningTile].map(t=>t.id)),[],2,r,{kind:'discard'})).toBeNull();
    r.patterns.pure.enabled=false;
    expect(scoreHand(tiles(PLAIN_HAND),[],2,r,{kind:'discard'})?.fan).toBe(0);
  });
  it('固定算例精确校验0番2分、2番点炮4分和自摸5分',()=>{
    const expected=[{fan:0,cappedFan:0,base:1,payment:2},{fan:2,cappedFan:2,base:4,payment:4},{fan:2,cappedFan:2,base:4,payment:5}];
    GUIDE_GOLDENS.forEach((g,i)=>expect(scoreHand(tiles(g.hand),[],2,GUIDE_EXAMPLE_RULES,{kind:g.kind})).toMatchObject(expected[i]));
    expect(GUIDE_GOLDENS.map(g=>g.net)).toEqual([[6,-2,-2,-2],[0,4,-4,0],[0,10,-5,-5]]);
  });
  it('生产支付接口：首胡后自摸不向已胡者收款，累计净额精确金样',()=>{
    const rules=presetRules('dynamic');rules.firstDealer=0;const config=createConfig(rules);
    // B begins with a complete pure hand less its final 5m; it draws 5m after A wins.
    const b=[0,1,2,3,4,5,6,7,8,1,2,3,4];
    const wall=wallForHands([PLAIN_HAND,b,Array(4).fill(18).concat(Array(4).fill(19),Array(4).fill(20),21),Array(3).fill(21).concat(Array(4).fill(22),Array(4).fill(23),24,24)]);
    const next=wall.findIndex((t,i)=>i>=53&&t.id===4);expect(next).toBeGreaterThanOrEqual(53);[wall[53],wall[next]]=[wall[next],wall[53]];
    const state=createXzMatch(config,5,wall);
    const first=applyXz(state,0,{type:'win'});
    expect(first.players.map(p=>p.score)).toEqual([106,98,98,98]);
    const second=applyXz(first,1,{type:'win'});
    expect(second.players.map(p=>p.score)).toEqual([106,108,93,93]);
    expect(second.ledger.slice(-2).map(e=>[e.from,e.to,e.amount])).toEqual([[2,1,5],[3,1,5]]);
  });
});
class ReadingClock implements Clock {value=0;now=()=>this.value;schedule=()=>0;cancel=()=>{};}
describe('阅读不重建对局或补Bank',()=>{
  it.each([false,true])('进入前暂停=%s，返回保持预算、配置与动作',paused=>{
    const rules=presetRules('dynamic');rules.firstDealer=0;const config=createConfig(rules);
    const clock=new ReadingClock(),runtime=new MatchRuntime(createXzMatch(config,7),xzPolicy,config.time,clock,0);
    runtime.activate();clock.value=7000;
    if(paused)runtime.pause();
    const close=beginRulesReading(runtime), state=runtime.state, budget=runtime.budgetView('xuezhan:0');
    expect(runtime.paused).toBe(true);expect(budget).toMatchObject({bankMs:18000,baseMs:0});
    clock.value+=60000;close();close();
    expect(runtime.paused).toBe(paused);expect(runtime.state).toBe(state);
    expect(runtime.budgetView('xuezhan:0')?.bankMs).toBe(budget?.bankMs);
    expect(runtime.budgetView('xuezhan:0')?.baseMs).toBe(budget?.baseMs);
    config.rules.base=99;expect(runtime.state.config.rules.base).toBe(1);runtime.dispose();
  });
});
