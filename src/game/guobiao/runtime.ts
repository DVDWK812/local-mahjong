import type { ModePolicy } from '../timeControl/matchRuntime';
import { applyGb, defaultGbAction, legalGbActions, participantId } from './engine';
import { GB_SEATS, type GbState } from './types';
import type { PlayerId } from '../types';
const seatFor=(id:string)=>Number(id.split(':')[1]) as PlayerId;
export const gbPolicy:ModePolicy<GbState>={
  mode:'guobiao',handId:s=>`guobiao:${s.seed}:${s.handNumber}`,
  decisions:s=>s.phase==='ended'?[]:GB_SEATS.flatMap(id=>legalGbActions(s,id).length?[{
    key:`${s.handNumber}:${s.phase==='response'?`r${s.response!.id}`:`t${s.turn}`}:${id}`,participantId:participantId(id),
    kind:s.phase==='response'?'response' as const:'turn' as const,budgetId:`${s.handNumber}:t${s.turn}:${id}`,
  }]:[]),
  timeout:(s,d)=>{const id=seatFor(d.participantId),a=defaultGbAction(s,id);return a?applyGb(s,id,a):s;},
  automatic:(s,d,p)=>{const id=seatFor(d.participantId),legal=legalGbActions(s,id),win=legal.find(a=>a.type==='hu');
    if(p.autoWin&&win)return{state:applyGb(s,id,win),source:'auto-win'};
    if(p.suppressCalls&&!win&&s.phase==='response')return{state:applyGb(s,id,{type:'pass'}),source:'suppress-calls'};
    if(p.autoTsumogiri&&s.phase==='turn'){const a=defaultGbAction(s,id);if(a)return{state:applyGb(s,id,a),source:'auto-tsumogiri'};}
    return null;
  },
  suspend:(before,after,d)=>before.phase==='turn'&&before.current===seatFor(d.participantId)
    &&['ankan','kakan'].includes(after.commands[after.commands.length-1]?.action.type),
  isSuppressedCall:(before,after,id)=>before!==after&&after.commands[after.commands.length-1]?.actor===seatFor(id)
    &&['chi','pon','minkan','ankan','kakan'].includes(after.commands[after.commands.length-1]?.action.type),
};
