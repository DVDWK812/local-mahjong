import type { RuntimeSave } from '../timeControl/matchRuntime';
import { validateConfig, fingerprint, stableJson, type XzConfig } from './config';
import { applyXz, assertXzInvariants, createXzMatch, participantId, SEATS } from './engine';
import type { RecordedAction, XzState } from './types';
import type { Tile } from '../types';
import { snapshotTimeControl } from '../timeControl/config';
import { xzPolicy } from './runtime';
export const XZ_SAVE_KEY = 'local-mahjong.xuezhan.save.v1';
export interface XzSave { mode: 'xuezhan'; schemaVersion: 1; config: XzConfig; seed: number; initialWall?: Tile[]; actions: RecordedAction[]; digest: string; runtime?: RuntimeSave; accounting?: Pick<XzState, 'wins' | 'ledger' | 'results'> }
export function stateDigest(s: XzState): string { return fingerprint({ players: s.players, wall: s.wall, phase: s.phase, response: s.response, wins: s.wins, ledger: s.ledger, results: s.results, declarations: s.declarations, drafts: s.drafts }); }
export function saveXz(s: XzState, runtime?: RuntimeSave): XzSave { return { mode: 'xuezhan', schemaVersion: 1, config: s.config, seed: s.seed, ...(s.initialWall ? { initialWall: s.initialWall } : {}), actions: s.actions, digest: stateDigest(s), accounting: { wins: s.wins, ledger: s.ledger, results: s.results }, ...(runtime ? { runtime } : {}) }; }
export function replayXz(save: XzSave, steps = save.actions.length): XzState {
  if (!save || save.mode !== 'xuezhan' || save.schemaVersion !== 1 || !Array.isArray(save.actions) || save.actions.length > 100000) throw new Error('不支持或损坏的血战存档');
  let state = createXzMatch(validateConfig(save.config), save.seed, save.initialWall);
  for (const record of save.actions.slice(0, steps)) {
    if (record.seq !== state.sequence + 1 || record.hand !== state.handNumber) throw new Error('回放动作顺序损坏');
    const next = applyXz(state, record.seat, record.action);
    if (next === state) throw new Error(`回放第 ${record.seq} 步动作非法`);
    state = next;
  }
  assertXzInvariants(state);
  if (steps === save.actions.length && stateDigest(state) !== save.digest) throw new Error('血战存档摘要不一致');
  if (steps === save.actions.length && save.accounting && stableJson(save.accounting) !== stableJson({ wins: state.wins, ledger: state.ledger, results: state.results })) throw new Error('存档账本与权威回放不一致');
  if (steps === save.actions.length && save.runtime) {
    const rt = save.runtime;
    if (rt.schemaVersion !== 1 || stableJson(snapshotTimeControl(rt.config, 'xuezhan')) !== stableJson(state.config.time)) throw new Error('存档时间配置与比赛不一致');
    if (!rt.clock || rt.clock.schemaVersion !== 1 || rt.clock.handId !== xzPolicy.handId(state)) throw new Error('存档时钟不属于当前小局');
    const specs = xzPolicy.decisions(state);
    if (!Array.isArray(rt.clock.decisions) || rt.clock.decisions.some(d => !specs.some(spec => spec.participantId === d.participantId && spec.key === d.key) || d.baseMs !== null && (!Number.isFinite(d.baseMs) || d.baseMs < 0) || !Number.isFinite(d.bankMs) || d.bankMs < 0)) throw new Error('存档决策预算损坏');
    if (!rt.preferences || !Array.isArray(rt.audit)) throw new Error('存档自动操作数据损坏');
    const ids = SEATS.map(participantId), turn = state.config.time.turn;
    const maxBank = turn.kind === 'banked' ? turn.bankPerHandMs : 0;
    const validAmount = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
    if (Object.entries(rt.preferences).some(([id, value]) => !ids.includes(id) || !value || ['autoWin', 'autoTsumogiri', 'suppressCalls'].some(k => typeof value[k as keyof typeof value] !== 'boolean'))) throw new Error('存档自动操作偏好无效');
    if (!rt.clock.banks || Object.entries(rt.clock.banks).some(([id, v]) => !ids.includes(id) || !validAmount(v, maxBank))) throw new Error('存档Bank预算无效');
    if (new Set(rt.clock.decisions.map(d => d.participantId)).size !== rt.clock.decisions.length || rt.clock.decisions.length !== specs.length) throw new Error('存档决策缺失或重复');
    for (const d of rt.clock.decisions) {
      const spec = specs.find(v => v.participantId === d.participantId)!;
      const limit = spec.preparation ? state.config.time.preparation![spec.preparation] : turn;
      const max = limit.kind === 'unlimited' ? null : limit.kind === 'fixed' ? limit.durationMs : limit.decisionBaseMs;
      if (d.kind !== spec.kind || d.budgetId !== spec.budgetId || !validAmount(d.openingMs, 1000) || !validAmount(d.bankMs, spec.preparation ? 0 : maxBank) || (max === null ? d.baseMs !== null : !validAmount(d.baseMs, max))) throw new Error('存档决策类型或剩余预算无效');
    }
    if (!rt.clock.suspended || Object.entries(rt.clock.suspended).some(([key, v]) => !SEATS.some(seat => key === `${state.handNumber}:${seat}`) || !validAmount(v.bankMs, maxBank) || (turn.kind === 'unlimited' ? v.baseMs !== null : !validAmount(v.baseMs, turn.decisionBaseMs)))) throw new Error('存档挂起预算无效');
  }
  return state;
}
export function parseXzSave(raw: string): XzSave {
  if (raw.length > 8000000) throw new Error('存档超过 8 MB 限制');
  const value = JSON.parse(raw) as XzSave; replayXz(value); return value;
}
export function writeXzSave(storage: Pick<Storage, 'setItem'>, s: XzState, runtime?: RuntimeSave): void { storage.setItem(XZ_SAVE_KEY, stableJson(saveXz(s, runtime))); }
