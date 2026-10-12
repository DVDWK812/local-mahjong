import { describe, it, expect } from 'vitest';
import { MatchRuntime } from '../timeControl/matchRuntime';
import { SanmaTestClock } from '../sanma/runtime';
import { gbPolicy } from './runtime';
import { GB_SCENARIOS } from './scenarios';
import { participantId, applyGb, defaultGbAction } from './engine';
import { GbReadingPause } from './readingPause';

function setup(){ const root=GB_SCENARIOS.find(s=>s.id==='single-seed')!.make(); const clock=new SanmaTestClock(); const runtime=new MatchRuntime(root,gbPolicy,root.config.time,clock); runtime.activate();return {root,clock,runtime,reading:new GbReadingPause(runtime)}; }
describe('国标阅读保护只拥有本次权威暂停',()=>{
 it('冻结真人额度、AI准备命令及超时，关闭同决策续行不赠Bank',()=>{const {root,clock,runtime,reading}=setup();clock.advance(2200);const id=participantId(0),d=runtime.decision(id)!,budget=runtime.budgetView(id)!;
  const pending=runtime.preparePolicyCommand(id,s=>applyGb(s,0,defaultGbAction(s,0)!))!;reading.acquire('rules-guide');clock.advance(120000);pending.commit();
  expect(runtime.state).toBe(root);expect(runtime.budgetView(id)?.baseMs).toBe(budget.baseMs);expect(runtime.budgetView(id)?.bankMs).toBe(budget.bankMs);expect(runtime.audit).toHaveLength(0);
  reading.release('rules-guide');expect(runtime.decision(id)?.id).toBe(d.id);expect(runtime.budgetView(id)?.baseMs).toBe(budget.baseMs);expect(runtime.budgetView(id)?.bankMs).toBe(budget.bankMs);pending.commit();expect(runtime.state.sequence).toBe(1);expect(runtime.audit[0].baseUsedMs).toBe(2200);expect(runtime.audit[0].bankUsedMs).toBe(0);runtime.dispose();
 });
 it('进入前已有暂停，重复打开/关闭不能解除它',()=>{const{clock,runtime,reading}=setup();runtime.pause();const save=runtime.snapshot();reading.acquire('rules-guide');reading.acquire('rules-guide');reading.release('wrong-owner');clock.advance(10000);reading.release('rules-guide');expect(runtime.paused).toBe(true);expect(runtime.snapshot().clock).toEqual(save.clock);runtime.dispose();});
 it('两个原因只释放自身；未就绪和只读回放不得激活比赛',()=>{const{runtime,reading}=setup();reading.acquire('rules-guide');reading.acquire('analysis');reading.release('rules-guide');expect(runtime.paused).toBe(true);reading.release('analysis');expect(runtime.paused).toBe(false);reading.acquire('rules-guide');reading.release('rules-guide',false);expect(runtime.paused).toBe(true);runtime.dispose();});
});
