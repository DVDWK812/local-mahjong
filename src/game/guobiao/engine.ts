import { getTileRank, getTileSuit } from '../tileUtils';
import type { PlayerId, Tile, TileId } from '../types';
import { createGbConfig, snapshotGbConfig, type GbConfig } from './config';
import { GB_SEATS, FLOWER_IDS, type GbAction, type GbEvent, type GbGroup, type GbPayment, type GbResponse, type GbScore, type GbState, type GbTile } from './types';
import { scoreGb } from './scoring';
export const participantId=(id:PlayerId)=>`guobiao:${id}`;
const seatOrders: PlayerId[][]=[[0,1,2,3],[1,0,3,2],[2,3,1,0],[3,2,0,1]];
export const gbSeatWind=(s:GbState,id:PlayerId)=>((s.seats.indexOf(id)-s.seats.indexOf(s.dealer)+4)%4) as 0|1|2|3;
export const gbRoundWind=(s:GbState)=>Math.floor((s.handNumber-1)/4) as 0|1|2|3;
export const gbRemaining=(s:GbState)=>Math.max(0,s.wall.tail-s.wall.head+1);
export const regular=(s:GbState,index:number):Tile=>{ const tile=s.wall.tiles[index]; if(!tile||tile.kind!=='regular') throw new Error('国标结构区域含花牌或无效牌'); return tile; };
export const nextGbSeat=(s:GbState,id:PlayerId)=>s.seats[(s.seats.indexOf(id)+1)%4];
export function makeGbWall(seed:number,hand:number):GbState['wall'] {
  const tiles:GbTile[]=[];
  for(let id=0;id<34;id++) for(let copy=0;copy<4;copy++) tiles.push({kind:'regular',id:id as TileId,suit:getTileSuit(id as TileId),rank:getTileRank(id as TileId),red:false,instanceId:`gb:${seed}:${hand}:${id}:${copy}`});
  for(const flower of FLOWER_IDS) tiles.push({kind:'flower',flower,instanceId:`gb:${seed}:${hand}:flower:${flower}`});
  let n=(seed^Math.imul(hand,0x9e3779b9))>>>0;
  const random=()=>{n+=0x6d2b79f5; let t=n; t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
  const order=tiles.map((_,i)=>i); for(let i=143;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  return{tiles,order,head:0,tail:143};
}
function event(s:GbState,data:Omit<GbEvent,'id'|'hand'>):GbEvent {const e={...data,id:s.events.length+1,hand:s.handNumber};s.events.push(e);return e;}
function take(s:GbState,source:'head'|'tail'):number|null {if(!gbRemaining(s))return null;return source==='head'?s.wall.order[s.wall.head++]:s.wall.order[s.wall.tail--];}
function drawResult(s:GbState){const e=event(s,{type:'settlement'});s.phase='ended';s.result={kind:'draw',deltas:[0,0,0,0],payments:[],eventId:e.id};s.response=null;s.completed=s.config.length==='single'||s.handNumber===16;}
/** Atomic system transition: bounded by eight unique flower instances and the monotone wall cursors. */
function draw(s:GbState,id:PlayerId,source:'live'|'flower'|'kong') {
  const p=s.players[id]; let actual=source;
  while(true){const index=take(s,actual==='live'?'head':'tail'); if(index===null){drawResult(s);return;}
    const tile=s.wall.tiles[index];
    if(tile.kind==='flower'){p.flowers.push(index);event(s,{type:'flower',actor:id,tile:index,source:actual});actual='flower';continue;}
    p.hand.push(index);p.drawn=index;p.source=actual;s.lastDrawWasLast=gbRemaining(s)===0;
    event(s,{type:'draw',actor:id,tile:index,source:actual});return;
  }
}
function deal(s:GbState){
  // Three rounds of four tiles, then one each and the dealer's fourteenth. Wall randomization replaces physical dice cutting.
  for(let r=0;r<3;r++) for(let n=0;n<4;n++){const id=s.seats[(s.seats.indexOf(s.dealer)+n)%4];for(let k=0;k<4;k++)s.players[id].hand.push(take(s,'head')!);}
  for(let n=0;n<4;n++){const id=s.seats[(s.seats.indexOf(s.dealer)+n)%4];s.players[id].hand.push(take(s,'head')!);}
  const extra=take(s,'head')!;s.players[s.dealer].hand.push(extra);s.players[s.dealer].drawn=extra;
  event(s,{type:'deal'});
  for(let n=0;n<4;n++){
    const id=s.seats[(s.seats.indexOf(s.dealer)+n)%4],p=s.players[id];
    const flowers=p.hand.filter(i=>s.wall.tiles[i].kind==='flower');p.hand=p.hand.filter(i=>s.wall.tiles[i].kind==='regular');
    for(const index of flowers){p.flowers.push(index);event(s,{type:'flower',actor:id,tile:index,source:'initial'});
      const previous=p.drawn;draw(s,id,'flower');if(s.phase==='ended')return;
      if(index!==extra) p.drawn=previous;
    }
    if(id!==s.dealer)p.drawn=null;
    p.source='initial';
  }
  s.current=s.dealer;s.phase='turn';s.canSelfKong=true;s.lastDrawWasLast=false;
}
export function createGb(config:GbConfig=createGbConfig(),seed=1):GbState {
  const c=snapshotGbConfig(config),s:GbState={mode:'guobiao',config:c,seed:seed>>>0,handNumber:1,sequence:0,turn:0,seats:[0,1,2,3],dealer:0,current:0,phase:'turn',
    wall:makeGbWall(seed,1),players:GB_SEATS.map(id=>({id,participantId:participantId(id),name:c.names[id],score:0,hand:[],drawn:null,source:null,flowers:[],melds:[],river:[]})),
    events:[],commands:[],response:null,result:null,ledger:[],completed:false,lastDrawWasLast:false,canSelfKong:true};deal(s);assertGbConservation(s);return s;
}
export const gbGroups=(s:GbState,id:PlayerId):GbGroup[]=>s.players[id].melds.map(m=>({kind:m.kind==='chi'?'chi':m.kind==='pon'?'pon':'kan',
  ids:m.tiles.map(i=>regular(s,i).id),opened:m.kind!=='ankan',fixed:true}));
export function publicGbIndexes(s:GbState):number[]{return[...new Set(s.players.flatMap(p=>[...p.flowers,...p.river.filter(r=>!r.claimed).map(r=>r.index),...p.melds.filter(m=>m.kind!=='ankan'||s.phase==='ended').flatMap(m=>m.tiles)]))];}
export function scoreGbPlayer(s:GbState,id:PlayerId,index:number,from:PlayerId|null):GbScore {
  const p=s.players[id],tile=regular(s,index),concealed=p.hand.filter(i=>from!==null||i!==index).map(i=>regular(s,i).id);
  return scoreGb({concealed,melds:gbGroups(s,id),winningTile:tile.id,selfDraw:from===null,seatWind:gbSeatWind(s,id),roundWind:gbRoundWind(s),flowers:p.flowers.length,
    source:from===null?p.source??'live':s.response?.kind==='kakan'?'robbed-kong':'discard',lastWall:from===null?s.lastDrawWasLast:s.response?.lastWall??false,
    visibleOtherCopies:publicGbIndexes(s).filter(i=>i!==index&&s.wall.tiles[i].kind==='regular'&&regular(s,i).id===tile.id).length});
}
const same=(a:GbAction,b:GbAction)=>JSON.stringify(a)===JSON.stringify(b);
function responseCandidates(s:GbState,id:PlayerId,r:GbResponse):GbAction[]{
  const p=s.players[id],tile=regular(s,r.tile),matches=p.hand.filter(i=>regular(s,i).id===tile.id),a:GbAction[]=[];
  // During construction the score context includes the pending transaction.
  if(scoreGbPlayer({...s,response:r},id,r.tile,r.from).canHu)a.push({type:'hu'});
  if(r.kind==='discard'&&gbRemaining(s)>0){
    if(matches.length>=2)a.push({type:'pon',tile:tile.id});
    if(matches.length>=3&&gbRemaining(s)>0)a.push({type:'minkan',tile:tile.id});
    if(id===nextGbSeat(s,r.from)&&tile.id<27) for(let start=Math.max(Math.floor(tile.id/9)*9,tile.id-2);start<=tile.id&&start%9<=6;start++){
      const wanted=[start,start+1,start+2].filter(n=>n!==tile.id),used=wanted.map(n=>p.hand.find(i=>regular(s,i).id===n));
      if(used.every(i=>i!==undefined))a.push({type:'chi',tiles:used.map(i=>regular(s,i!).instanceId) as [string,string]});
    }
  }
  return a.length?[...a,{type:'pass'}]:[];
}
export function legalGbActions(s:GbState,id:PlayerId):GbAction[]{
  if(s.phase==='ended')return !s.completed&&id===0?[{type:'next'}]:[];
  if(s.phase==='response')return s.response!.eligible.includes(id)&&!s.response!.choices[id]?s.response!.candidates[id]??[]:[];
  if(s.current!==id)return[];
  const p=s.players[id],a:GbAction[]=p.hand.map(i=>({type:'discard',tile:regular(s,i).instanceId}));
  if(p.drawn!==null&&scoreGbPlayer(s,id,p.drawn,null).canHu)a.unshift({type:'hu'});
  if(s.canSelfKong&&gbRemaining(s)>0){
    for(const tile of [...new Set(p.hand.map(i=>regular(s,i).id))])if(p.hand.filter(i=>regular(s,i).id===tile).length===4)a.push({type:'ankan',tile});
    for(const m of p.melds)if(m.kind==='pon'&&p.hand.some(i=>regular(s,i).id===regular(s,m.tiles[0]).id))a.push({type:'kakan',tile:regular(s,m.tiles[0]).id});
  }
  return a;
}
function openResponse(s:GbState,from:PlayerId,tile:number,kind:GbResponse['kind'],meldIndex?:number){
  const r:GbResponse={id:s.sequence,from,tile,kind,eligible:[],choices:{},candidates:{},meldIndex,lastWall:s.lastDrawWasLast};
  for(let n=1;n<4;n++){const id=s.seats[(s.seats.indexOf(from)+n)%4],a=responseCandidates(s,id,r);if(a.length){r.eligible.push(id);r.candidates[id]=a;}}
  s.response=r;s.phase='response';if(!r.eligible.length)resolve(s);
}
export function gbPayments(winner:PlayerId,from:PlayerId|null,F:number,eventId:number,hand:number):{payments:GbPayment[];deltas:number[]}{
  if(!Number.isSafeInteger(F)||F<8)throw new Error('国标支付必须来自合法至少八番的结果');
  const payments:GbPayment[]=[],deltas=[0,0,0,0];
  for(const payer of GB_SEATS)if(payer!==winner){for(const[reason,amount]of[['base',8],['fan',from===null||payer===from?F:0]] as const){
    if(!amount)continue;payments.push({id:`gb:${hand}:${eventId}:${payer}:${reason}`,eventId,payer:participantId(payer),payee:participantId(winner),reason,amount});deltas[payer]-=amount;deltas[winner]+=amount;
  }}return{payments,deltas};
}
function win(s:GbState,id:PlayerId,index:number,from:PlayerId|null){
  const score=scoreGbPlayer(s,id,index,from);if(!score.canHu)throw new Error('国标和牌资格未成立');
  if(from!==null){if(s.response?.kind==='kakan'){s.players[from].hand=s.players[from].hand.filter(i=>i!==index);s.players[from].drawn=null;s.players[from].source=null;}
    else {const river=s.players[from].river.find(r=>r.index===index)!;river.claimed=true;}
    s.players[id].hand.push(index);
  }
  const e=event(s,{type:'settlement',actor:id,tile:index}),payment=gbPayments(id,from,score.totalFan,e.id,s.handNumber);
  s.players.forEach(p=>p.score+=payment.deltas[p.id]);s.ledger.push(...payment.payments);
  s.result={kind:'win',winner:id,from,score,tile:index,...payment,eventId:e.id};s.phase='ended';s.response=null;s.completed=s.config.length==='single'||s.handNumber===16;
}
function commitKakan(s:GbState,r:GbResponse){const p=s.players[r.from],m=p.melds[r.meldIndex!];p.hand=p.hand.filter(i=>i!==r.tile);m.tiles.push(r.tile);m.kind='kakan';
  p.drawn=null;event(s,{type:'kan',actor:r.from,tile:r.tile});s.phase='turn';s.current=r.from;s.response=null;s.canSelfKong=true;draw(s,r.from,'kong');}
function resolve(s:GbState){
  const r=s.response!;if(r.eligible.some(id=>!r.choices[id]))return;
  const rank=(a:GbAction)=>a.type==='hu'?3:a.type==='pon'||a.type==='minkan'?2:a.type==='chi'?1:0;
  const picked=r.eligible.map(id=>({id,a:r.choices[id]!})).sort((a,b)=>rank(b.a)-rank(a.a))[0];
  if(!picked||!rank(picked.a)){
    if(r.kind==='kakan'){commitKakan(s,r);return;}
    s.response=null;s.current=nextGbSeat(s,r.from);s.phase='turn';s.canSelfKong=true;s.turn++;draw(s,s.current,'live');return;
  }
  const{id,a}=picked;if(a.type==='hu'){win(s,id,r.tile,r.from);return;}
  const p=s.players[id],tile=regular(s,r.tile),used=a.type==='chi'?a.tiles.map(t=>p.hand.find(i=>regular(s,i).instanceId===t)!):p.hand.filter(i=>regular(s,i).id===tile.id).slice(0,a.type==='minkan'?3:2);
  p.hand=p.hand.filter(i=>!used.includes(i));s.players[r.from].river.find(v=>v.index===r.tile)!.claimed=true;
  p.melds.push({kind:a.type as 'chi'|'pon'|'minkan',tiles:[...used,r.tile].sort((x,y)=>regular(s,x).id-regular(s,y).id),from:r.from,called:r.tile});
  p.drawn=null;p.source=null;s.current=id;s.phase='turn';s.response=null;s.canSelfKong=false;s.lastDrawWasLast=false;s.turn++;
  event(s,{type:a.type==='chi'?'chi':a.type==='pon'?'pon':'kan',actor:id,tile:r.tile});if(a.type==='minkan'){s.canSelfKong=true;draw(s,id,'kong');}
}
export function applyGb(s:GbState,id:PlayerId,action:GbAction,expectedSequence=s.sequence,commandId=`${s.sequence}:${id}:${JSON.stringify(action)}`):GbState{
  if(expectedSequence!==s.sequence||s.commands.some(c=>c.id===commandId)||!legalGbActions(s,id).some(a=>same(a,action)))return s;
  const n=structuredClone(s);n.sequence++;n.commands.push({id:commandId,sequence:s.sequence,actor:id,action:structuredClone(action)});
  const p=n.players[id];
  if(action.type==='next'){
    n.handNumber++;n.seats=[...seatOrders[Math.floor((n.handNumber-1)/4)]];n.dealer=n.seats[(n.handNumber-1)%4];n.current=n.dealer;
    n.wall=makeGbWall(n.seed,n.handNumber);n.result=null;n.response=null;n.phase='turn';n.turn=0;
    n.players.forEach(p=>{p.hand=[];p.drawn=null;p.flowers=[];p.melds=[];p.river=[];p.source=null;});deal(n);
  }else if(n.phase==='response'){n.response!.choices[id]=action;event(n,{type:'response',actor:id});resolve(n);}
  else if(action.type==='hu')win(n,id,p.drawn!,null);
  else if(action.type==='discard'){
    const index=p.hand.find(i=>regular(n,i).instanceId===action.tile)!;p.hand=p.hand.filter(i=>i!==index);p.river.push({index,claimed:false,tsumogiri:index===p.drawn});p.drawn=null;p.source=null;
    event(n,{type:'discard',actor:id,tile:index});openResponse(n,id,index,'discard');
  }else if(action.type==='ankan'){
    const used=p.hand.filter(i=>regular(n,i).id===action.tile);p.hand=p.hand.filter(i=>!used.includes(i));p.melds.push({kind:'ankan',tiles:used,from:id,called:null});p.drawn=null;
    event(n,{type:'kan',actor:id,tile:used[0]});draw(n,id,'kong');
  }else if(action.type==='kakan'){
    const index=p.hand.find(i=>regular(n,i).id===action.tile)!;event(n,{type:'kan-declared',actor:id,tile:index});openResponse(n,id,index,'kakan',p.melds.findIndex(m=>m.kind==='pon'&&regular(n,m.tiles[0]).id===action.tile));
  }
  assertGbConservation(n);return n;
}
export function defaultGbAction(s:GbState,id:PlayerId):GbAction|undefined{
  const a=legalGbActions(s,id);if(s.phase==='response')return a.find(a=>a.type==='pass');
  const p=s.players[id];return p.drawn===null?a.find(a=>a.type==='discard'):a.find(a=>a.type==='discard'&&a.tile===regular(s,p.drawn!).instanceId);
}
export function assertGbConservation(s:GbState){
  const held=[...s.wall.order.slice(s.wall.head,s.wall.tail+1),...s.players.flatMap(p=>[...p.hand,...p.flowers,...p.melds.flatMap(m=>m.tiles),...p.river.filter(r=>!r.claimed).map(r=>r.index)])];
  if(s.wall.tiles.length!==144||s.wall.order.length!==144||new Set(s.wall.order).size!==144||!Number.isInteger(s.wall.head)||!Number.isInteger(s.wall.tail)||s.wall.head<0||s.wall.tail>143||s.wall.head>s.wall.tail+1
    ||held.length!==144||new Set(held).size!==144||held.some(i=>!Number.isInteger(i)||i<0||i>=144)||new Set(s.wall.tiles.map(t=>t.instanceId)).size!==144)throw new Error('国标144张牌实例不守恒');
  if(GB_SEATS.some(id=>s.wall.tiles.filter(t=>t.kind==='flower'&&t.flower===FLOWER_IDS[id]).length!==1)
    ||FLOWER_IDS.some(f=>s.wall.tiles.filter(t=>t.kind==='flower'&&t.flower===f).length!==1)
    ||Array.from({length:34},(_,id)=>s.wall.tiles.filter(t=>t.kind==='regular'&&t.id===id).length).some(n=>n!==4))throw new Error('国标牌库种类或数量无效');
  if(s.players.reduce((n,p)=>n+p.score,0)!==0)throw new Error('国标积分不守恒');
  for(const p of s.players){p.hand.forEach(i=>regular(s,i));p.melds.forEach(m=>m.tiles.forEach(i=>regular(s,i)));if(p.flowers.some(i=>s.wall.tiles[i].kind!=='flower'))throw new Error('花牌归属区混入常规牌');
    if(p.drawn!==null&&!p.hand.includes(p.drawn))throw new Error('摸入牌不属于本人的手牌');
    const fourteen=s.phase==='ended'?s.result?.winner===p.id:p.id===s.current&&(s.phase==='turn'||s.response?.kind==='kakan');
    if(p.hand.length+p.melds.length*3!==(fourteen?14:13))throw new Error('国标手牌结构张数无效');
    for(const m of p.melds){const ids=m.tiles.map(i=>regular(s,i).id);if(ids.length!==(m.kind==='chi'||m.kind==='pon'?3:4)
      ||(m.kind==='chi'?ids[0]>=27||ids[0]%9>6||ids.some((id,i)=>id!==ids[0]+i):ids.some(id=>id!==ids[0])))throw new Error('国标副露结构无效');}}
  if(new Set(s.ledger.map(p=>p.id)).size!==s.ledger.length)throw new Error('国标支付重复');
}
