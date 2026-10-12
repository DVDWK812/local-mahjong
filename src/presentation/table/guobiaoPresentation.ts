import type { PlayerId,PlayerState,TileId } from '../../game/types';
import { WIND_ORDER,sortTiles } from '../../game/tileUtils';
import { gbRemaining,gbSeatWind,gbRoundWind,legalGbActions,regular,nextGbSeat,scoreGbPlayer } from '../../game/guobiao/engine';
import type { GbState } from '../../game/guobiao/types';
import type { LocalHandPresentation,TableInteractionActions } from './TablePresentationContract';
import type { OccupiedTableSceneState } from '../../presentation3d/sceneState/tableSceneTypes';
import type { Table3DSeat } from '../../presentation3d/coordinates/seatTransforms';
import { buildSeatSceneState } from '../../presentation3d/sceneState/buildTableSceneState';
import { presentationEventBus } from '../PresentationEventBus';
import { decomposeGb } from '../../game/guobiao/shapes';
import { observeGb } from '../../game/guobiao/ai';
import { scoreGb } from '../../game/guobiao/scoring';
export const gbHudPosition=(seat:Table3DSeat)=>({bottom:'south',right:'east',top:'north',left:'west'} as const)[seat];
export function presentGb(s:GbState,viewer:PlayerId=0,selected:string|null=null){
  const order:PlayerId[]=[viewer];for(let i=1;i<4;i++)order.push(nextGbSeat(s,order[i-1]));
  const mapping=order.map((id,i)=>({id,seat:(['bottom','right','top','left'] as const)[i]}));
  // Opponents expose counts only; placeholder identities never enter scene tiles or playable projection.
  const players:PlayerState[]=s.players.map(p=>({id:p.id,name:p.name,score:p.score,seatWind:WIND_ORDER[gbSeatWind(s,p.id)],
    hand:p.id===viewer||s.result?.winner===p.id?p.hand.map(i=>regular(s,i)).sort(sortTiles):[],drawnTile:p.id===viewer&&p.drawn!==null?regular(s,p.drawn):null,
    river:p.river.map(r=>({...regular(s,r.index),claimed:r.claimed,isTsumogiri:r.tsumogiri})),calls:p.melds.map(m=>({
      type:m.kind==='chi'?'chi':m.kind==='pon'?'pon':'kan',tiles:m.kind==='ankan'&&p.id!==viewer&&s.phase!=='ended'?[]:m.tiles.map(i=>regular(s,i)),opened:m.kind!=='ankan',from:m.from,
      kanType:m.kind==='chi'||m.kind==='pon'?undefined:m.kind,calledTile:m.called===null?undefined:regular(s,m.called)})),riichi:false,riichiState:null}));
  const legal=legalGbActions(s,viewer),playable=legal.flatMap(a=>a.type==='discard'?[a.tile]:[]),p=players[viewer];
  const hand:LocalHandPresentation={playerId:viewer,tiles:p.hand.map(tile=>({tile,drawn:tile.instanceId===p.drawnTile?.instanceId,selected:tile.instanceId===selected,playable:playable.includes(tile.instanceId),riichiCandidate:false})),
    canDiscard:playable.length>0,playableTileInstanceIds:playable,selectedTileInstanceId:selected,drawnTileInstanceId:p.drawnTile?.instanceId??null,riichiCandidateInstanceIds:[],kuikaeForbiddenTileIds:[]};
  const scene:OccupiedTableSceneState={wall:[],deadWall:[],doraIndicators:[],seats:Object.fromEntries(mapping.map(m=>{
    const safePlayer={...players[m.id],calls:players[m.id].calls.filter(c=>c.tiles.length)};
    const base=buildSeatSceneState(safePlayer,m.seat,m.id===viewer||s.result?.winner===m.id,false,[]);
    let visibleMeldIndex=0;
    const melds=s.players[m.id].melds.map((meld,index)=>meld.kind==='ankan'&&m.id!==viewer&&s.phase!=='ended'
      ? {key:`concealed-kan-${m.id}-${index}`,callType:'ankan' as const,tiles:[0,1,2,3].map(i=>({key:`concealed-kan-${m.id}-${index}-${i}`,faceState:'face-down' as const,orientation:'upright' as const,called:false,stacked:false}))}
      : base.melds[visibleMeldIndex++]);
    const hiddenHand=s.players[m.id].hand.map((_,i)=>({key:`hidden-hand-${m.id}-${i}`,faceState:'face-down' as const,orientation:'upright' as const,drawn:s.players[m.id].drawn!==null&&i===s.players[m.id].hand.length-1}));
    return[m.seat,{...base,melds,hand:m.id!==viewer&&s.result?.winner!==m.id?hiddenHand:base.hand,
      flowers:s.players[m.id].flowers.map(i=>{const t=s.wall.tiles[i];if(t.kind!=='flower')throw new Error('花牌投影无效');return{key:t.instanceId,flower:t.flower};})}];
  }))};
  return{mapping,players,player:p,hand,legal,scene,remaining:gbRemaining(s),roundWind:WIND_ORDER[gbRoundWind(s)]};
}
export const gbInteraction=(selectTile:(id:string|null)=>void,discard:(id:string)=>void):TableInteractionActions=>({selectTile,discard});
/** Hints have precisely the same safe observation as AI and score separate ron/tsumo contexts. */
export function gbWaitHints(s:GbState,viewer:PlayerId){
  const o=observeGb(s,viewer);if(o.hand.length!==13-o.melds.length*3)return[];
  return Array.from({length:34},(_,id)=>id as TileId).filter(id=>decomposeGb([...o.hand.map(t=>t.id),id],o.melds,id).length).map(id=>{
    const common={concealed:o.hand.map(t=>t.id),melds:o.melds,winningTile:id,seatWind:o.seatWind,roundWind:o.roundWind,flowers:o.flowers,lastWall:false,visibleOtherCopies:o.visible.filter(t=>t.id===id).length};
    return{id,remaining:Math.max(0,4-common.visibleOtherCopies),ron:scoreGb({...common,selfDraw:false,source:'discard'}),tsumo:scoreGb({...common,selfDraw:true,source:'live'})};
  });
}
export function publishGbTransition(before:GbState,after:GbState,session:string){
  if(before.handNumber!==after.handNumber)return;
  for(const e of after.events.slice(before.events.length)){
    const eventId=`${session}:committed:${e.hand}:${e.id}`;
    if(e.type==='settlement'&&after.result){
      presentationEventBus.publish({type:'guobiao_settled',outcome:after.result.kind==='draw'?'draw':after.result.from===null?'tsumo':'ron',playerId:after.result.winner},`${eventId}:voice`);
    }
    if(e.actor===undefined)continue;const id=e.actor;
    if(e.type==='draw')presentationEventBus.publish({type:'tile_drawn',playerId:id});
    if(e.type==='discard'&&e.tile!==undefined){const tile=regular(after,e.tile),p=after.players[id];presentationEventBus.publish({type:'tile_discarded',mode:'guobiao',playerId:id,tile,riverIndex:p.river.findIndex(r=>r.index===e.tile),isRiichiDiscard:false,
      handHistory:{preDiscardHand:before.players[id].hand.map(i=>regular(before,i)).sort(sortTiles),drawnTile:before.players[id].drawn===null?null:regular(before,before.players[id].drawn!),discardedTile:tile,finalHand:p.hand.map(i=>regular(after,i)).sort(sortTiles),isTsumogiri:e.tile===before.players[id].drawn}},eventId);}
    if(e.type==='chi'||e.type==='pon'||e.type==='kan'){const m=after.players[id].melds.find(m=>e.tile!==undefined&&m.tiles.includes(e.tile));presentationEventBus.publish({type:'meld_declared',mode:'guobiao',playerId:id,meldType:e.type==='kan'?'kan':e.type,kanType:m?.kind==='chi'||m?.kind==='pon'?undefined:m?.kind},eventId);}
    if(e.type==='settlement'&&after.result?.kind==='win')presentationEventBus.publish({type:'win_declared',playerId:id,winType:after.result.from===null?'tsumo':'ron'});
  }
}
