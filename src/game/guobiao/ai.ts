import type { AIPlayerSetting } from '../../components/MatchSettings';
import type { Tile,PlayerId } from '../types';
import { standardShanten, thirteenOrphansShanten } from '../shanten';
import { legalGbActions,gbGroups,gbRemaining,gbSeatWind,gbRoundWind,regular,publicGbIndexes } from './engine';
import { decomposeGb } from './shapes';
import { scoreGb } from './scoring';
import type { GbAction,GbGroup,GbState } from './types';
export interface GbAIObservation { actor:PlayerId;hand:Tile[];melds:GbGroup[];legal:GbAction[];visible:Tile[];
  remaining:number;seatWind:0|1|2|3;roundWind:0|1|2|3;flowers:number;seed:number;sequence:number;responseTile:Tile|null }
/** This boundary matches the existing mode adapter pattern: no opponent concealed identities or future wall. */
export function observeGb(s:GbState,actor:PlayerId):GbAIObservation{
  const hand=s.players[actor].hand.map(i=>({...regular(s,i)}));
  const visible=[...new Set([...s.players[actor].hand,...publicGbIndexes(s),...s.players[actor].melds.flatMap(m=>m.tiles)])].filter(i=>s.wall.tiles[i].kind==='regular').map(i=>({...regular(s,i)}));
  return{actor,hand,melds:gbGroups(s,actor),legal:structuredClone(legalGbActions(s,actor)),visible,remaining:gbRemaining(s),seatWind:gbSeatWind(s,actor),roundWind:gbRoundWind(s),flowers:s.players[actor].flowers.length,
    seed:s.seed,sequence:s.sequence,responseTile:s.response?{...regular(s,s.response.tile)}:null};
}
/** Eight-fan routes and actual payment reward supplement shape distance; 34 draws per discard is the hard budget. */
function value(hand:Tile[],melds:GbGroup[],o:GbAIObservation,setting:AIPlayerSetting):number{
  const counts=Array<number>(34).fill(0);hand.forEach(t=>counts[t.id]++);
  const distance=Math.min(standardShanten(hand, melds.length),melds.length===0?6-counts.reduce((n,c)=>n+Math.floor(c/2),0):Infinity,
    melds.length===0?thirteenOrphansShanten(hand):Infinity);
  const all=[...hand.map(t=>t.id),...melds.flatMap(g=>g.ids)],suits=[0,1,2].map(s=>all.filter(id=>id<27&&Math.floor(id/9)===s).length);
  // Reachable 24/6+honor paths, seven pairs, all-pungs and mixed triple chow. Calls can destroy some routes.
  const flush=Math.max(...suits)/Math.max(1,all.filter(id=>id<27).length),pairs=counts.filter(c=>c>=2).length;
  const pungs=counts.filter(c=>c>=3).length+melds.filter(m=>m.kind!=='chi').length;
  const honor=counts.slice(27).reduce((n,c,i)=>n+(c>=2&&(i>=4||i===o.roundWind||i===o.seatWind)?c:0),0);
  const strength={chikukon:0,shintentai:1,upper:2,kishin:3}[setting.difficulty];
  const attack=setting.personality==='aggressive'?1.5:setting.personality==='defensive'?0.65:1;
  let score=-distance*100+flush*(6+strength*3)*attack+pungs*2*attack+honor+(melds.length===0?pairs*1.5:0);
  if(strength>=2&&distance>0)for(let id=0;id<34;id++){
    const available=Math.max(0,4-o.visible.filter(t=>t.id===id).length);if(!available)continue;
    const next=[...hand,{id:id as Tile['id']} as Tile];if(standardShanten(next,melds.length)<distance)score+=available*(strength===3?1:0.7);
  }
  if(distance<=0&&strength>0)for(let id=0;id<34;id++){
    if(!decomposeGb([...hand.map(t=>t.id),id as Tile['id']],melds,id as Tile['id']).length)continue;
    const r=scoreGb({concealed:hand.map(t=>t.id),melds,winningTile:id as Tile['id'],selfDraw:true,seatWind:o.seatWind,roundWind:o.roundWind,flowers:o.flowers,source:'live',lastWall:false,visibleOtherCopies:0});
    const available=Math.max(0,4-o.visible.filter(t=>t.id===id).length);score+=available*(r.canHu?(r.totalFan+8)*3*0.12:r.nonFlowerFan*0.2);
  }
  if(setting.personality==='defensive'&&o.remaining<35)score-=all.filter(id=>o.visible.filter(t=>t.id===id).length>=3).length*6;
  return score;
}
const fallback:AIPlayerSetting={playerId:1,difficulty:'shintentai',personality:'balanced'};
export function chooseGbAction(o:GbAIObservation,setting:AIPlayerSetting=fallback):GbAction|undefined{
  const win=o.legal.find(a=>a.type==='hu');if(win)return win;const next=o.legal.find(a=>a.type==='next');if(next)return next;
  const discards=o.legal.filter((a):a is Extract<GbAction,{type:'discard'}>=>a.type==='discard');
  if(discards.length){const kong=o.legal.find(a=>a.type==='ankan'||a.type==='kakan');
    if(kong&&setting.difficulty!=='chikukon'&&setting.personality!=='defensive')return kong;
    const ranked=discards.map(a=>({a,value:value(o.hand.filter(t=>t.instanceId!==a.tile),o.melds,o,setting)})).sort((a,b)=>b.value-a.value||a.a.tile.localeCompare(b.a.tile));
    const top=setting.difficulty==='chikukon'?ranked.slice(0,Math.min(3,ranked.length)):ranked.filter(r=>r.value===ranked[0].value);
    return top[((o.seed^Math.imul(o.sequence+1,2654435761))>>>0)%top.length].a;
  }
  if(o.responseTile&&o.legal.some(a=>a.type==='pass')){
    const id=o.responseTile.id,baseline=value(o.hand,o.melds,o,setting),candidates:{a:GbAction;score:number}[]=[];
    for(const a of o.legal){if(!['chi','pon','minkan'].includes(a.type))continue;
      const removed=a.type==='chi'?o.hand.filter(t=>a.tiles.includes(t.instanceId)):o.hand.filter(t=>t.id===id).slice(0,a.type==='minkan'?3:2);
      const kept=o.hand.filter(t=>!removed.includes(t));const group:GbGroup={kind:a.type==='chi'?'chi':a.type==='minkan'?'kan':'pon',ids:[...removed.map(t=>t.id),id].sort((a,b)=>a-b),opened:true,fixed:true};
      const melds=[...o.melds,group];const values=a.type==='minkan'?[value(kept,melds,o,setting)]:kept.map(tile=>value(kept.filter(t=>t!==tile),melds,o,setting));
      candidates.push({a,score:Math.max(...values)-(setting.personality==='aggressive'?2:setting.personality==='defensive'?20:8)});
    }
    candidates.sort((a,b)=>b.score-a.score);if(candidates[0]?.score>baseline)return candidates[0].a;
    return o.legal.find(a=>a.type==='pass');
  }return o.legal[0];
}
