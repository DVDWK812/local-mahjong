import { describe,it,expect } from 'vitest';
import { createGb,applyGb,legalGbActions,defaultGbAction,assertGbConservation,gbPayments,gbRemaining } from './engine';
import { createGbConfig } from './config';
import { GB_SEATS } from './types';
describe('GB 权威流程与守恒',()=>{
  it('144唯一实例、136普通无赤牌+8花，固定seed确定',()=>{const s=createGb(undefined,42);expect(s.wall.tiles).toHaveLength(144);expect(s.wall.tiles.filter(t=>t.kind==='flower')).toHaveLength(8);expect(s.wall.tiles.filter(t=>t.kind==='regular'&&t.red)).toHaveLength(0);expect(createGb(undefined,42)).toEqual(s);assertGbConservation(s);});
  it('真实开局补花，花从结构中移出',()=>{for(let seed=1;seed<30;seed++){const s=createGb(undefined,seed);assertGbConservation(s);expect(s.players.map(p=>p.hand.length)).toEqual([14,13,13,13]);expect(gbRemaining(s)).toBe(91-s.players.reduce((n,p)=>n+p.flowers.length,0));}});
  it('固定支付F10与零和',()=>{expect(gbPayments(0,1,10,7,1).deltas).toEqual([34,-18,-8,-8]);expect(gbPayments(0,null,10,7,1).deltas).toEqual([54,-18,-18,-18]);});
  it('过期和重复输入无效果',()=>{const s=createGb(undefined,9),a=defaultGbAction(s,0)!;const n=applyGb(s,0,a,0,'id');expect(n).not.toBe(s);expect(applyGb(n,0,a,0,'id')).toBe(n);expect(applyGb(s,1,a)).toBe(s);});
  for(const length of ['single','sixteen'] as const)for(const seed of [1,7,42])it(`${length}/${seed}确定性全场守恒和终局`,()=>{
    let s=createGb(createGbConfig(length),seed),steps=0;
    while(!s.completed&&steps++<5000){const id=GB_SEATS.find(id=>legalGbActions(s,id).length)!;const legal=legalGbActions(s,id);
      const action=legal.find(a=>a.type==='hu')??defaultGbAction(s,id)??legal.find(a=>a.type==='next')!;const next=applyGb(s,id,action);expect(next).not.toBe(s);s=next;assertGbConservation(s);
    }expect(s.completed).toBe(true);expect(s.handNumber).toBe(length==='single'?1:16);expect(steps).toBeLessThan(5000);
  });
});
