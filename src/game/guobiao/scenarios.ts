import type { PlayerId,TileId } from '../types';
import { createGbConfig } from './config';
import { assertGbConservation,createGb,regular } from './engine';
import type { GbMeld,GbState } from './types';
export function parseGbTiles(text:string):TileId[]{const ids:TileId[]=[];for(const part of text.trim().split(/\s+/)){const suit=part[part.length-1];
  if('mps'.includes(suit)){for(const n of part.slice(0,-1))ids.push((Number(n)-1+'mps'.indexOf(suit)*9) as TileId);}
  else for(const ch of part)ids.push((27+'ESWNPFC'.indexOf(ch)) as TileId);
}return ids;}
export interface GbFixturePlayer {hand?:string;flowers?:number;melds?:{tiles:string;kind:GbMeld['kind']}[]}
/** Test-only injection allocates actual unique instances; all subsequent actions use the production authority. */
export function gbFixture(players:Partial<Record<PlayerId,GbFixturePlayer>>,current:PlayerId=0,seed=20261003):GbState{
 const s=createGb(createGbConfig('single'),seed),pool=s.wall.tiles.map((_,i)=>i);
 s.players.forEach(p=>{p.hand=[];p.flowers=[];p.melds=[];p.river=[];p.drawn=null;p.source=null;});
 const take=(id:TileId)=>{const at=pool.findIndex(i=>s.wall.tiles[i].kind==='regular'&&regular(s,i).id===id);if(at<0)throw new Error(`场景超过四张：${id}`);return pool.splice(at,1)[0];};
 for(const p of s.players){const spec=players[p.id];if(!spec)continue;
  for(const id of parseGbTiles(spec.hand??''))p.hand.push(take(id));
  for(const m of spec.melds??[]){const tiles=parseGbTiles(m.tiles).map(take);p.melds.push({kind:m.kind,tiles,from:m.kind==='ankan'?p.id:((p.id+3)%4) as PlayerId,called:m.kind==='ankan'?null:tiles[0]});}
  for(let n=0;n<(spec.flowers??0);n++){const at=pool.findIndex(i=>s.wall.tiles[i].kind==='flower');if(at<0)throw new Error('场景超过八花');p.flowers.push(pool.splice(at,1)[0]);}
 }
 for(const p of s.players)if(players[p.id]?.hand===undefined){const count=13+(p.id===current?1:0)-p.melds.length*3;
  for(let n=0;n<count;n++){const at=pool.findIndex(i=>s.wall.tiles[i].kind==='regular');p.hand.push(pool.splice(at,1)[0]);}}
 const held=s.players.flatMap(p=>[...p.hand,...p.flowers,...p.melds.flatMap(m=>m.tiles)]);
 s.wall.order=[...held,...s.wall.order.filter(i=>pool.includes(i))];s.wall.head=held.length;s.wall.tail=143;
 const lastRegular=s.wall.order.findIndex((i,pos)=>pos>=s.wall.head&&s.wall.tiles[i].kind==='regular');
 [s.wall.order[lastRegular],s.wall.order[143]]=[s.wall.order[143],s.wall.order[lastRegular]];
 s.current=current;s.dealer=0;s.players[current].drawn=s.players[current].hand[s.players[current].hand.length-1];s.players[current].source='live';
 s.events=[{id:1,hand:1,type:'deal'}];s.sequence=0;s.commands=[];s.response=null;s.result=null;s.phase='turn';s.canSelfKong=true;s.lastDrawWasLast=false;
 assertGbConservation(s);return s;
}
export const GB_SCENARIOS=[
 {id:'flowers-four-seats',name:'八种花牌四方向归属',description:'四家各两花，依次切换观察席检查八种身份、朝向与归属。',make:()=>gbFixture({0:{flowers:2},1:{flowers:2},2:{flowers:2},3:{flowers:2}})},
 {id:'flowers-eight',name:'八种花牌／四组副露',description:'玩家满八花；对家四组副露。检查归属、朝向及最大布局。',make:()=>gbFixture({0:{flowers:8},2:{hand:'5s',melds:[{tiles:'123m',kind:'chi'},{tiles:'789m',kind:'chi'},{tiles:'123p',kind:'chi'},{tiles:'789p',kind:'chi'}]}})},
 {id:'seven-plus-flower',name:'非花七番加一花',description:'点和七番不足；自摸加一达到八番。关闭提示不改变判定。',make:()=>gbFixture({0:{hand:'34m 678m WWW 55m 2m',flowers:1,melds:[{tiles:'789m',kind:'chi'}]}})},
 {id:'seven-ron',name:'七番加花点和门槛',description:'切换操作席到电脑一，弃2万；再切回你，七番加一花仍没有和按钮，等待其他响应或超时推进。',make:()=>gbFixture({0:{hand:'34m 678m WWW 55m',flowers:1,melds:[{tiles:'789m',kind:'chi'}]},1:{hand:'123456789p 66s 55s 2m'}},1)},
 {id:'chicken-ron',name:'无番和点和边界',description:'切换操作席到电脑一，弃4条；再切回你，结构无其他非花番按无番和8番允许和。自摸产生1番，不能改补无番和。',make:()=>gbFixture({0:{hand:'567p 789s 23s NN',melds:[{tiles:'123m',kind:'chi'}]},1:{hand:'123456789p 66m 55m 4s'}},1)},
 {id:'orphans-win',name:'十三幺自摸与支付',description:'点击和；查看非花92番、花分、基础支付和累计积分；保存及跳转回放。',make:()=>gbFixture({0:{hand:'19m 19p 19s ESWNPFC 1m',flowers:2}})},
 {id:'multiple-win',name:'同牌三家和响应',description:'玩家弃1万；三家十三幺均可和。按任意点击顺序提交，最近下家获胜。',make:()=>gbFixture({0:{hand:'222333444p 55s 66s 1m'},1:{hand:'19m 19p 19s ESWNPFC'},2:{hand:'19m 19p 19s ESWNPFC'},3:{hand:'19m 19p 19s ESWNPFC'}})},
 {id:'rob-kong',name:'加杠可中断事务',description:'玩家加1万杠；下家十三幺抢杠。响应结束前不补牌、不改原碰和账本。',make:()=>gbFixture({0:{hand:'123p 456p 789s E 1m',melds:[{tiles:'111m',kind:'pon'}]},1:{hand:'99m 19p 19s ESWNPFC'}})},
 {id:'chain-flower',name:'正常摸牌连续补花',description:'玩家摸切；下家先从墙头摸春，再从牌尾补夏和常规牌。',make:()=>{const s=gbFixture({});const spring=s.wall.tiles.findIndex(t=>t.kind==='flower'&&t.flower==='spring'),summer=s.wall.tiles.findIndex(t=>t.kind==='flower'&&t.flower==='summer');
  const remain=s.wall.order.slice(s.wall.head,s.wall.tail+1).filter(i=>i!==spring&&i!==summer);const regularIndex=remain.find(i=>s.wall.tiles[i].kind==='regular')!;
  s.wall.order=[...s.wall.order.slice(0,s.wall.head),spring,...remain.filter(i=>i!==regularIndex),regularIndex,summer];assertGbConservation(s);return s;}},
 {id:'single-seed',name:'固定种子单盘',description:'关闭完全控制运行真实AI，或单步；可检查计时与和／鸣／切组合。',make:()=>createGb(createGbConfig('single'),42)},
 {id:'sixteen-seed',name:'固定种子十六盘',description:'完整四圈；每盘结果后点击下一盘，圈间换位、分数和身份持续保持。',make:()=>createGb(createGbConfig('sixteen'),42)},
] as const;


