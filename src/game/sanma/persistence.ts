import type { RuntimeSave } from '../timeControl/matchRuntime';
import { snapshotTimeControl } from '../timeControl/config';
import { DecisionClock } from '../timeControl/decisionClock';
import { sanmaPolicy } from './runtime';
import { applySanma, createSanma } from './engine';
import { assertSanma } from './invariants';
import { sanmaFingerprint, snapshotSanmaConfig, stableSanmaJson } from './config';
import type { SanmaState } from './types';

export const SANMA_SAVE_KEY = 'local-mahjong.sanma.saved.v1';
export const SANMA_HISTORY_KEY = 'local-mahjong.sanma.history.v1';
export const SANMA_TEST_KEY = 'local-mahjong.sanma.test.v1';
export interface SanmaSave { mode: 'sanma'; schemaVersion: 1; isolated: boolean; initial: SanmaState; state: SanmaState; runtime?: RuntimeSave; fingerprint: string }
export function saveSanma(s: SanmaState, runtime?: RuntimeSave, initial = createSanma(s.config, s.seed), isolated = false): SanmaSave {
  assertSanma(s); assertSanma(initial);
  return { mode: 'sanma', schemaVersion: 1, isolated, initial, state: s, ...(runtime ? { runtime } : {}), fingerprint: sanmaFingerprint(s) };
}
export function parseSanmaSave(raw: string): SanmaSave {
  const value = JSON.parse(raw) as SanmaSave;
  if (!value || value.mode !== 'sanma' || value.schemaVersion !== 1 || typeof value.isolated !== 'boolean') throw new Error('不支持的三人存档版本');
  value.state.config = snapshotSanmaConfig(value.state.config); value.initial.config = snapshotSanmaConfig(value.initial.config);
  assertSanma(value.state); assertSanma(value.initial);
  if (value.fingerprint !== sanmaFingerprint(value.state) || stableSanmaJson(value.initial.config) !== stableSanmaJson(value.state.config)) throw new Error('三人存档校验失败');
  if (!value.isolated && sanmaFingerprint(value.initial) !== sanmaFingerprint(createSanma(value.state.config, value.state.seed))) throw new Error('正式三人存档的初始牌局无效');
  if (value.runtime) {
    if (value.runtime.schemaVersion !== 1 || stableSanmaJson(snapshotTimeControl(value.runtime.config, 'sanma')) !== stableSanmaJson(value.state.config.time)) throw new Error('存档时间配置与比赛不一致');
    if (value.runtime.clock.handId !== `sanma:${value.state.seed}:${value.state.roundSerial}`) throw new Error('存档时钟所属小局不一致');
    const clock = new DecisionClock(value.state.config.time); clock.restore(value.runtime.clock);
    const participants = ['sanma:0', 'sanma:1', 'sanma:2'], specs = sanmaPolicy.decisions(value.state);
    const saved = value.runtime.clock.decisions;
    if (saved.length !== specs.length || new Set(saved.map(d => d.participantId)).size !== saved.length || saved.some(d => !specs.some(s => s.participantId === d.participantId && s.key === d.key && s.budgetId === d.budgetId && s.kind === d.kind))
      || Object.keys(value.runtime.clock.banks).some(id => !participants.includes(id)) || Object.keys(value.runtime.preferences).some(id => !participants.includes(id))) throw new Error('存档包含过期或错误席位决策');
    const turn = value.state.config.time.turn;
    const validBudget = (b: { baseMs: number | null; bankMs: number }) => turn.kind === 'unlimited' ? b.baseMs === null : b.baseMs !== null && b.baseMs <= turn.decisionBaseMs && b.bankMs <= turn.bankPerHandMs;
    if (saved.some(d => d.openingMs !== 0 || !validBudget(d)) || Object.entries(value.runtime.clock.suspended).some(([key, b]) => !new RegExp(`^${value.state.roundSerial}:t${value.state.turn}:[012]$`).test(key) || !validBudget(b))
      || Object.values(value.runtime.preferences).some(p => ['autoWin', 'suppressCalls', 'autoTsumogiri'].some(k => typeof p[k as keyof typeof p] !== 'boolean'))) throw new Error('存档计时预算或自动设置不合法');
  }
  replaySanma(value);
  return value;
}
export function replaySanma(save: SanmaSave, step = save.state.actions.length): SanmaState {
  let state = structuredClone(save.initial); state.config = snapshotSanmaConfig(state.config);
  if (!Number.isInteger(step) || step < state.actions.length || step > save.state.actions.length) throw new Error('回放位置无效');
  for (const record of save.state.actions.slice(state.actions.length, step)) {
    const next = applySanma(state, record.actor, record.action);
    if (next === state || next.sequence !== record.sequence) throw new Error(`三人回放第${record.sequence}步无法重建`);
    state = next;
  }
  assertSanma(state);
  if (step === save.state.actions.length && sanmaFingerprint(state) !== save.fingerprint) throw new Error('三人回放语义状态或账本不一致');
  return state;
}
export function writeSanmaSave(storage: Pick<Storage, 'setItem'>, save: SanmaSave): void {
  storage.setItem(save.isolated ? `${SANMA_TEST_KEY}.saved` : SANMA_SAVE_KEY, JSON.stringify(save));
}
export function downloadSanma(name: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
