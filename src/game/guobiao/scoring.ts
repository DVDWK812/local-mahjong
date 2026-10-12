import type { TileId } from '../types';
import { GB_FAN_VERSION, GB_RULES_VERSION } from './config';
import { decomposeGb } from './shapes';
import type { GbGroup, GbScore, GbShape } from './types';
import { GB_FAN_CATALOG, gbFanDefinition, type GbFanId } from './fanCatalog';
import { Hand } from './vendor/jan/hand';
import { Janpai } from './vendor/jan/janpai';
import type { JanpaiID } from './vendor/jan/janpai-id';
import { Mentsu } from './vendor/jan/mentsu';
import { sortMentsuList } from './vendor/jan/mentsu-util';
import { CompletePattern } from './vendor/jan/complete-pattern';
import { CompleteInfo } from './vendor/jan/complete-info';
import { COMPLETE_TYPE } from './vendor/jan/complete-type';
import { WIND } from './vendor/jan/wind';
import McrUtil from './vendor/jan/mcr-util';
import { MCR_YAKU, type McrYaku } from './vendor/jan/mcr-yaku';

export interface GbScoringInput { concealed: TileId[]; melds: GbGroup[]; winningTile: TileId; selfDraw: boolean;
  seatWind: 0 | 1 | 2 | 3; roundWind: 0 | 1 | 2 | 3; flowers: number;
  source: 'live' | 'initial' | 'flower' | 'kong' | 'discard' | 'robbed-kong'; lastWall: boolean; visibleOtherCopies: number }
const HONORS = ['東','南','西','北','白','發','中'];
export const janTile = (id: TileId) => new Janpai((id < 27 ? `${id % 9 + 1}${['m','p','s'][Math.floor(id / 9)]}` : HONORS[id - 27]) as JanpaiID);
const yakuId = (y: McrYaku): GbFanId => Object.keys(MCR_YAKU).find(k => MCR_YAKU[k as GbFanId] === y) as GbFanId;
const sum = (ys: McrYaku[]) => ys.reduce((n,y) => n + y.point, 0);
const unique = (ys: McrYaku[]) => [...new Set(ys)];
function asMentsu(g: GbGroup, ronGroup: boolean): Mentsu {
  const head = janTile(g.ids[0]);
  return g.kind === 'chi' ? Mentsu.createChowMentsu(head, !g.opened)
    : g.kind === 'knitted' ? Mentsu.createKnittedChowMentsu(head)
    : g.kind === 'kan' ? Mentsu.createKongMentsu(head, !g.opened)
    : Mentsu.createPungMentsu(head, !g.opened && !ronGroup);
}
/** All candidate group combinations are searched. Already-used groups cannot be reused for the same fan;
 * a fresh group can connect once to an established combination. This is separate from global exclusions. */
type FanEvidence = Map<McrYaku,number[][]>;
function associated(groups: Mentsu[], chow: boolean, shape:GbShape, evidence:FanEvidence): McrYaku[] {
  if (groups.length < 2) return [];
  const pair: (groups: Mentsu[]) => McrYaku | undefined = chow ? McrUtil._twoChowsYaku : McrUtil._twoPungsYaku;
  const triple: (groups: Mentsu[]) => McrYaku | undefined = chow ? McrUtil._threeChowsYaku : McrUtil._threePungsYaku;
  let best: McrYaku[] = [],bestGroups:number[][]=[];
  const shapeIndex=(g:Mentsu)=>{const candidates=shape.groups.flatMap((s,i)=>s.ids.length===g.janpaiList.length&&s.ids.every((id,j)=>janTile(id).id===g.janpaiList[j].id)?[i]:[]);return candidates[groups.filter(h=>h.head.id===g.head.id&&h.janpaiList.length===g.janpaiList.length).indexOf(g)];};
  for (let a = 0; a < groups.length; a++) for (let b = a+1; b < groups.length; b++) for (let c = b+1; c < groups.length; c++) {
    const ys = [groups[a], groups[b], groups[c]];
    const high = triple.call(McrUtil, ys);
    if (!high) continue;
    let extra: McrYaku | undefined,extraGroups:number[]=[];
    groups.forEach((g,i) => { if (![a,b,c].includes(i)) for (const h of ys) {
      const ordered = [g,h]; sortMentsuList(ordered); const p = pair.call(McrUtil, ordered);
      if (p && (!extra || p.point > extra.point)){extra = p;extraGroups=[shapeIndex(g),shapeIndex(h)];}
    } });
    const result = [high, ...(extra ? [extra] : [])]; if (sum(result) > sum(best)){best = result;bestGroups=[ys.map(shapeIndex),...(extra?[extraGroups]:[])];}
  }
  const record=()=>{best.forEach((y,i)=>evidence.set(y,[...(evidence.get(y)??[]),bestGroups[i]]));return best;};
  if (best.length) return record();
  const edges: { a: number; b: number; fan: McrYaku }[] = [];
  for (let a=0;a<groups.length;a++) for (let b=a+1;b<groups.length;b++) {
    const ordered=[groups[a],groups[b]];sortMentsuList(ordered);const fan = pair.call(McrUtil,ordered); if (fan) edges.push({a,b,fan});
  }
  for (let mask=0;mask<2**edges.length;mask++) {
    const picked = edges.filter((_,i)=>!!(mask & 1<<i)), parent=groups.map((_,i)=>i);
    const root=(i:number):number=>parent[i]===i ? i : root(parent[i]);
    if (picked.some((e,i)=>{ if (root(e.a)===root(e.b)) return true;
      if (picked.slice(0,i).some(p=>p.fan===e.fan && [p.a,p.b].some(v=>v===e.a || v===e.b))) return true;
      parent[root(e.a)]=root(e.b); return false; })) continue;
    const result=picked.map(e=>e.fan); if(sum(result)>sum(best)){best=result;bestGroups=picked.map(e=>[shapeIndex(groups[e.a]),shapeIndex(groups[e.b])]);}
  }
  return record();
}
function kongFans(p: CompletePattern): McrYaku[] {
  const n=p.kongCount, dark=p.darkKongCount;
  const bonus=dark===2 ? [MCR_YAKU.TWO_CONCEALED_KONGS] : dark===1 ? [MCR_YAKU.CONCEALED_KONG] : [];
  if(n===4) return [MCR_YAKU.FOUR_KONGS,...bonus];
  if(n===3) return [MCR_YAKU.THREE_KONGS,...bonus];
  if(n===2) return dark===2 ? bonus : dark===1 ? [MCR_YAKU.TWO_MELDED_KONGS,...bonus] : [MCR_YAKU.TWO_MELDED_KONGS];
  return n===1 ? dark===1 ? bonus : [MCR_YAKU.MELDED_KONG] : [];
}
function waitFan(shape: GbShape, input: GbScoringInput, waits: number): McrYaku | undefined {
  if (waits!==1) return;
  if (shape.winGroup===shape.groups.length) return MCR_YAKU.SINGLE_WAIT;
  const g=shape.groups[shape.winGroup]; if(g?.kind!=='chi') return;
  if(g.ids[1]===input.winningTile) return MCR_YAKU.CLOSED_WAIT;
  if(g.ids[0]%9===0 && input.winningTile===g.ids[2] || g.ids[0]%9===6 && input.winningTile===g.ids[0]) return MCR_YAKU.EDGE_WAIT;
}
function patternFans(shape: GbShape, p: CompletePattern, input: GbScoringInput, waits: number,evidence:FanEvidence): McrYaku[] {
  const ys: McrYaku[]=[...McrUtil._honorTilesYakuList(p,new CompleteInfo(janTile(input.winningTile),false,
    Object.values(WIND)[input.roundWind],Object.values(WIND)[input.seatWind])), ...kongFans(p)];
  const concealed=McrUtil._concealedPungsYaku(p); if(concealed && !(p.darkKongCount>=2 && concealed===MCR_YAKU.TWO_CONCEALED_PUNGS)) ys.push(concealed);
  const outside=McrUtil._allInvolvedYaku(p); if(outside) ys.push(outside);
  if(McrUtil._allChows(p)) ys.push(MCR_YAKU.ALL_CHOWS);
  const chow=[...p.chowList], pung=[...p.pungList]; sortMentsuList(chow); sortMentsuList(pung);
  if(p.knittedChowList.length===3) ys.push(MCR_YAKU.KNITTED_STRAIGHT);
  else if(chow.length===4 && McrUtil._pureTerminalChows(chow,p.head)) ys.push(MCR_YAKU.PURE_TERMINAL_CHOWS);
  else if(chow.length===4 && p.head.five && !p.head.ji && chow.every(g=>g.head.suit!==p.head.suit)
    && new Set(chow.map(g=>g.head.suit)).size===2 && chow.every(g=>g.head.number===1||g.head.number===7)
    && new Set(chow.map(g=>g.head.id)).size===4) ys.push(MCR_YAKU.THREE_SUITED_TERMINAL_CHOWS);
  else if(chow.length===4) {
    const high=McrUtil._yakuListWithFourChows(chow,p.head).find(y=>y===MCR_YAKU.QUADRUPLE_CHOW||y===MCR_YAKU.FOUR_PURE_SHIFTED_CHOWS);
    ys.push(...(high ? [high] : associated(chow,true,shape,evidence)));
  } else ys.push(...associated(chow,true,shape,evidence));
  if(pung.length===4) {
    ys.push(McrUtil._allEvenPungs(p) ? MCR_YAKU.ALL_EVEN_PUNGS : MCR_YAKU.ALL_PUNGS);
    const high=McrUtil._yakuListWithFourPungs(pung).find(y=>y===MCR_YAKU.FOUR_PURE_SHIFTED_PUNGS);
    ys.push(...(high ? [high] : associated(pung,false,shape,evidence)));
  } else ys.push(...associated(pung,false,shape,evidence));
  ys.push(...McrUtil._pungsOfTerminalsOrHonors(p));
  const wait=waitFan(shape,input,waits); if(wait) ys.push(wait);
  return ys;
}
function participatingGroups(id:GbFanId,shape:GbShape,input:GbScoringInput,selected:McrYaku[]):number[]{
 const group=(test:(g:GbGroup,i:number)=>boolean)=>shape.groups.flatMap((g,i)=>test(g,i)?[i]:[]);
 if(['SELF_DRAWN','LAST_TILE','LAST_TILE_DRAW','LAST_TILE_CLAIM','ROBBING_THE_KONG','OUT_WITH_REPLACEMENT_TILE'].includes(id))return[];
 if(['SINGLE_WAIT','CLOSED_WAIT','EDGE_WAIT'].includes(id))return[shape.winGroup];
 if(id==='KNITTED_STRAIGHT')return group(g=>g.kind==='knitted');
 if(['DRAGON_PUNG','TWO_DRAGON_PUNGS','BIG_THREE_DRAGONS','LITTLE_THREE_DRAGONS'].includes(id))return group(g=>g.kind!=='chi'&&g.kind!=='knitted'&&g.ids[0]>=31);
 if(id==='PREVALENT_WIND'||id==='SEAT_WIND')return group(g=>g.kind!=='chi'&&g.kind!=='knitted'&&g.ids[0]===27+(id==='SEAT_WIND'?input.seatWind:input.roundWind));
 if(['BIG_THREE_WINDS','BIG_FOUR_WINDS','LITTLE_FOUR_WINDS'].includes(id))return group(g=>g.kind!=='chi'&&g.kind!=='knitted'&&g.ids[0]>=27&&g.ids[0]<=30);
 if(id.includes('CONCEALED_PUNGS'))return group((g,i)=>g.kind!=='chi'&&g.kind!=='knitted'&&!g.opened&&(input.selfDraw||i!==shape.winGroup));
 if(id.includes('KONG'))return group(g=>g.kind==='kan'&&(!id.includes('CONCEALED')||!g.opened));
 if(id==='PUNG_OF_TERMINALS_OR_HONORS')return group(g=>g.kind!=='chi'&&g.kind!=='knitted'&&(g.ids[0]>=27&&g.ids[0]<=30&&g.ids[0]!==27+input.seatWind&&g.ids[0]!==27+input.roundWind&&!selected.includes(MCR_YAKU.BIG_THREE_WINDS)||g.ids[0]<27&&(g.ids[0]%9===0||g.ids[0]%9===8)));
 return shape.groups.map((_,i)=>i);
}
export function scoreGb(input: GbScoringInput): GbScore {
  const empty: GbScore={handShapeValid:false,canHu:false,nonFlowerFan:0,flowerFan:0,totalFan:0,fanItems:[],excludedItems:[],decomposition:null,rulesVersion:GB_RULES_VERSION,fanTableVersion:GB_FAN_VERSION};
  if(!Number.isInteger(input.flowers)||input.flowers<0||input.flowers>8||input.concealed.length!==13-input.melds.length*3
    || ![input.seatWind,input.roundWind].every(n=>Number.isInteger(n)&&n>=0&&n<4)
    || !Number.isInteger(input.visibleOtherCopies)||input.visibleOtherCopies<0||input.visibleOtherCopies>3
    || input.selfDraw && ['discard','robbed-kong'].includes(input.source)
    || !input.selfDraw && !['discard','robbed-kong'].includes(input.source)) return empty;
  const ids=[...input.concealed,input.winningTile], shapes=decomposeGb(ids,input.melds,input.winningTile); if(!shapes.length) return empty;
  const sorted=input.concealed.slice().sort((a,b)=>a-b),completeIds=ids.slice().sort((a,b)=>a-b);
  const hand=new Hand(sorted.map(janTile)); input.melds.forEach(g=>hand.fix(asMentsu(g,false)));
  const type=input.source==='robbed-kong' ? COMPLETE_TYPE.ROBBING_A_KONG : input.selfDraw ? input.source==='kong'
    ? input.lastWall ? COMPLETE_TYPE.FINAL_DRAW_AND_WIN_ON_KONG : COMPLETE_TYPE.WIN_ON_KONG
    : input.lastWall ? COMPLETE_TYPE.FINAL_DRAW : COMPLETE_TYPE.DRAW : input.lastWall ? COMPLETE_TYPE.FINAL_DISCARD : COMPLETE_TYPE.DISCARD;
  const info=new CompleteInfo(janTile(input.winningTile),input.visibleOtherCopies===3,Object.values(WIND)[input.roundWind],Object.values(WIND)[input.seatWind],type);
  const all=ids.map(janTile).concat(input.melds.flatMap(g=>g.ids.map(janTile)));
  const common:McrYaku[]=[...McrUtil._fullChowsYakuList(hand,info.janpai),...McrUtil._limitedNumberYakuList(all),...McrUtil._beingWholeYakuList(hand,info)];
  const honor=all.every(t=>t.ji); if(honor) common.push(MCR_YAKU.ALL_HONORS);
  const terminals=McrUtil._terminalsOrHonorsYaku(all); if(terminals) common.push(terminals);
  const waits=Array.from({length:34},(_,i)=>i as TileId).filter(id=>decomposeGb([...input.concealed,id],input.melds,id).length).length;
  let best=empty;
  for(const shape of shapes) {
    const evidence:FanEvidence=new Map();
    let raw:McrYaku[];
    if(shape.kind==='unconnected') raw=[...McrUtil._brokenYakuList(completeIds.map(janTile)),...McrUtil._beingWholeYakuList(hand,info)];
    else if(shape.kind==='orphans') raw=[MCR_YAKU.THIRTEEN_ORPHANS,...McrUtil._beingWholeYakuList(hand,info)];
    else {
      raw=[...common];
      if(shape.kind==='seven-pairs') raw.push(McrUtil._sevenPairsYaku(completeIds.map(janTile)));
      else raw.push(...patternFans(shape,new CompletePattern(shape.groups.map((g,i)=>asMentsu(g,!input.selfDraw&&i===shape.winGroup)),janTile(shape.pair!)),input,waits,evidence));
      McrUtil._specialYakuList(raw,hand,info.janpai);
    }
    const selected=McrUtil._removeExcludeYaku([...raw],info);
    // WMO2014: implicit all-pungs/all-chows excludes derived groups; special closed wins still add 不求人.
    for(const [high,lows] of [[MCR_YAKU.PURE_TERMINAL_CHOWS,[MCR_YAKU.PURE_DOUBLE_CHOW,MCR_YAKU.TWO_TERMINAL_CHOWS,MCR_YAKU.NO_HONORS]],
      [MCR_YAKU.THREE_SUITED_TERMINAL_CHOWS,[MCR_YAKU.MIXED_DOUBLE_CHOW,MCR_YAKU.TWO_TERMINAL_CHOWS,MCR_YAKU.NO_HONORS]],
      [MCR_YAKU.SEVEN_SHIFTED_PAIRS,[MCR_YAKU.SEVEN_PAIRS,MCR_YAKU.SINGLE_WAIT]],
      [MCR_YAKU.FOUR_KONGS,[MCR_YAKU.SINGLE_WAIT]]] as [McrYaku,McrYaku[]][]) if(selected.includes(high)) {
      for(let i=selected.length-1;i>=0;i--) if(lows.includes(selected[i])) selected.splice(i,1);
    }
    const value=sum(selected); if(best.handShapeValid&&value<=best.nonFlowerFan) continue;
    const items=unique(selected).map(y=>({id:yakuId(y),name:gbFanDefinition(yakuId(y)).name,value:y.point,count:selected.filter(v=>v===y).length,
      groups:[...new Set(evidence.has(y)?evidence.get(y)!.flat():participatingGroups(yakuId(y),shape,input,selected))]}));
    if(input.flowers) items.push({id:'FLOWER_TILES',name:'花牌',value:1,count:input.flowers,groups:[]});
    best={...empty,handShapeValid:true,canHu:value>=8,nonFlowerFan:value,flowerFan:input.flowers,totalFan:value>=8?value+input.flowers:value,
      fanItems:items,excludedItems:unique(raw).filter(y=>raw.filter(r=>r===y).length>selected.filter(r=>r===y).length).map(y=>({id:yakuId(y),name:gbFanDefinition(yakuId(y)).name,
        reason:`排除${raw.filter(r=>r===y).length-selected.filter(r=>r===y).length}次；包含关系按${gbFanDefinition(yakuId(y)).source}及已计番项处理`})),decomposition:shape};
  }
  return best;
}
export { GB_FAN_CATALOG };

