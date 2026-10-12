import { DecisionClock } from '../timeControl/decisionClock';
import type { RuntimeSave } from '../timeControl/matchRuntime';
import { snapshotGbConfig } from './config';
import { applyGb, assertGbConservation, createGb } from './engine';
import { gbPolicy } from './runtime';
import type { GbState } from './types';
import { sanmaFingerprint, stableSanmaJson } from '../sanma/config';
export const GB_SAVE_KEY='local-mahjong.guobiao.save.v1';
export const GB_TEST_KEY='local-mahjong.guobiao.test.v1';
export const GB_HISTORY_KEY='local-mahjong.guobiao.history.v1';
export interface GbSave { mode:'guobiao';schemaVersion:1;initial:GbState;state:GbState;runtime?:RuntimeSave;fingerprint:string;isolated:boolean }
export function saveGb(state:GbState,runtime?:RuntimeSave,initial=createGb(state.config,state.seed),isolated=false):GbSave{
  assertGbConservation(state);return{mode:'guobiao',schemaVersion:1,initial:structuredClone(initial),state:structuredClone(state),runtime:runtime?structuredClone(runtime):undefined,fingerprint:sanmaFingerprint(state),isolated};
}
export function replayGb(save:GbSave,step=save.state.commands.length):GbState{
  let s=structuredClone(save.initial);s.config=snapshotGbConfig(s.config);
  if(!Number.isInteger(step)||step<s.commands.length||step>save.state.commands.length)throw new Error('国标回放位置无效');
  for(const c of save.state.commands.slice(s.commands.length,step)){const next=applyGb(s,c.actor,c.action,c.sequence,c.id);if(next===s)throw new Error(`国标回放命令${c.id}无法重建`);s=next;}
  assertGbConservation(s);if(step===save.state.commands.length&&sanmaFingerprint(s)!==save.fingerprint)throw new Error('国标回放状态、事件或账本不一致');return s;
}
export function parseGbSave(raw:string):GbSave{
  const v=JSON.parse(raw) as GbSave;if(!v||v.mode!=='guobiao'||v.schemaVersion!==1||typeof v.isolated!=='boolean')throw new Error('不支持的国标存档版本');
  v.state.config=snapshotGbConfig(v.state.config);v.initial.config=snapshotGbConfig(v.initial.config);assertGbConservation(v.state);assertGbConservation(v.initial);
  if(v.fingerprint!==sanmaFingerprint(v.state)||stableSanmaJson(v.initial.config)!==stableSanmaJson(v.state.config))throw new Error('国标存档校验失败');
  if(!v.isolated&&sanmaFingerprint(v.initial)!==sanmaFingerprint(createGb(v.state.config,v.state.seed)))throw new Error('正式国标存档初始状态无效');
  if(v.runtime){const r=v.runtime;if(r.schemaVersion!==1||stableSanmaJson(r.config)!==stableSanmaJson(v.state.config.time)||r.clock.handId!==gbPolicy.handId(v.state))throw new Error('国标时钟版本或归属不一致');
    const clock=new DecisionClock(v.state.config.time);clock.restore(r.clock);
    const specs=gbPolicy.decisions(v.state);if(r.clock.decisions.length!==specs.length||new Set(r.clock.decisions.map(d=>d.key)).size!==specs.length||new Set(r.clock.decisions.map(d=>d.participantId)).size!==specs.length||r.clock.decisions.some(d=>!specs.some(s=>s.key===d.key&&s.participantId===d.participantId&&s.budgetId===d.budgetId&&s.kind===d.kind)))throw new Error('国标存档决策已过期');
    const participants=v.state.players.map(p=>p.participantId),turn=v.state.config.time.turn;
    const valid=(b:{baseMs:number|null;bankMs:number})=>turn.kind==='unlimited'?b.baseMs===null:b.baseMs!==null&&b.baseMs<=turn.decisionBaseMs&&b.bankMs<=turn.bankPerHandMs;
    if(Object.entries(r.clock.banks).some(([id,bank])=>!participants.includes(id)||typeof bank!=='number'||!Number.isFinite(bank)||bank<0||bank>(turn.kind==='banked'?turn.bankPerHandMs:0))
      ||Object.keys(r.clock.suspended).some(key=>!participants.some((_,id)=>key===`${v.state.handNumber}:t${v.state.turn}:${id}`))
      ||Object.keys(r.preferences).some(id=>!participants.includes(id))||r.clock.decisions.some(d=>d.openingMs!==0||!valid(d))
      ||Object.values(r.clock.suspended).some(b=>!valid(b))||Object.values(r.preferences).some(p=>Object.values(p).some(b=>typeof b!=='boolean')))throw new Error('国标计时预算或自动设置无效');
  }replayGb(v);return v;
}
export function writeGbSave(storage:Pick<Storage,'setItem'>,save:GbSave){storage.setItem(save.isolated?GB_TEST_KEY:GB_SAVE_KEY,JSON.stringify(save));}
