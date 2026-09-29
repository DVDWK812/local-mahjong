import { defaultRuleConfig } from '../score/rules/RuleConfig';
import { defaultTimeControl, snapshotTimeControl, type TimeControlConfig } from '../timeControl/config';
import type { AIPlayerSetting } from '../../components/MatchSettings';

export const SANMA_RULE_VERSION = 'sanma-riichi-v1' as const;
export type SanmaLength = 'east-only' | 'hanchan';
export type TsumoPolicy = 'loss' | 'split_missing_share_ceil100';
/** These are project defaults, not a claim of platform/universal sanma compatibility. */
export const SANMA_RULES = Object.freeze({
  ...defaultRuleConfig, abortOnFourWinds: false, abortOnFourRiichi: false,
  playerCount: 3, tileCount: 108, northIsGuest: true, chi: false, minimumHan: 1,
  doraSatisfiesYaku: false, northBreaksMenzen: false, northInterruptsIppatsuOnCommit: true,
  robNorth: 'any-legal-ron', northDrawRinshan: true, northDrawHaitei: false,
  reserveSize: 14, replacementQueueSize: 4, maxReplacements: 8, maxKans: 4,
  wallContract: 'fixed-ten-indicators-rolling-four-replacements-v1',
  kanDoraTiming: 'on-commit-before-replacement', fourKansAbortTiming: 'after-replacement-discard-ron',
  riichiAnkan: 'drawn-tile-and-identical-waits', liability: 'daisangen-daisuushii-component-full-ron',
  nagashi: 'closed-unclaimed-terminals-simultaneous-tsumo',
  ronHonba: 200, tsumoHonbaEach: 100, notenPool: 2000, riichiDeposit: 1000,
  doubleRon: true, doubleRonExtras: 'nearest-only', agariYame: true, tenpaiYame: true,
  extraWinds: 1, extraTargetPriority: 'after-settlement-before-repeat', extraCap: 'end-on-rotation-past-third',
  bankruptcyBelow: 0, leftoverSticks: 'first', tieBreak: 'initial-seat-order', uma: [20, 0, -20],
} as const);
export interface SanmaConfig {
  mode: 'sanma'; schemaVersion: 1; ruleVersion: typeof SANMA_RULE_VERSION;
  rules: typeof SANMA_RULES; length: SanmaLength; tsumoPolicy: TsumoPolicy;
  startingPoints: number; targetPoints: number; returnPoints: number;
  initialDealer: 0 | 1 | 2; names: [string, string, string]; ai: AIPlayerSetting[];
  time: TimeControlConfig;
}
export function createSanmaConfig(length: SanmaLength = 'east-only', tsumoPolicy: TsumoPolicy = 'loss'): SanmaConfig {
  return snapshotSanmaConfig({ mode: 'sanma', schemaVersion: 1, ruleVersion: SANMA_RULE_VERSION, rules: SANMA_RULES,
    length, tsumoPolicy, startingPoints: 35000, targetPoints: 40000, returnPoints: 40000, initialDealer: 0,
    names: ['你', '电脑一', '电脑二'], ai: [1, 2].map(playerId => ({ playerId: playerId as 1 | 2, difficulty: 'shintentai', personality: 'balanced' })),
    time: defaultTimeControl('sanma') });
}
export function stableSanmaJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSanmaJson).join(',')}]`;
  return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableSanmaJson(v)}`).join(',')}}`;
}
export function sanmaFingerprint(value: unknown): string {
  let n = 2166136261;
  for (const ch of stableSanmaJson(value)) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return (n >>> 0).toString(16).padStart(8, '0');
}
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
}
export function snapshotSanmaConfig(input: unknown): SanmaConfig {
  const c = input as SanmaConfig;
  if (!c || c.mode !== 'sanma' || c.schemaVersion !== 1 || c.ruleVersion !== SANMA_RULE_VERSION
    || stableSanmaJson(c.rules) !== stableSanmaJson(SANMA_RULES)) throw new Error('三人规则快照或版本不兼容');
  if (!['east-only', 'hanchan'].includes(c.length) || !['loss', 'split_missing_share_ceil100'].includes(c.tsumoPolicy)) throw new Error('三人比赛配置无效');
  for (const key of ['startingPoints', 'targetPoints', 'returnPoints'] as const) if (!Number.isSafeInteger(c[key]) || c[key] < 1000 || c[key] > 1000000 || c[key] % 100) throw new Error('点数必须是 1000～1000000 内的百点整数');
  if (![0, 1, 2].includes(c.initialDealer) || !Array.isArray(c.names) || c.names.length !== 3 || c.names.some(n => typeof n !== 'string' || !n.trim())) throw new Error('三人身份配置无效');
  if (!Array.isArray(c.ai) || c.ai.length !== 2 || c.ai.some((a, i) => a.playerId !== i + 1 || !['chikukon', 'shintentai', 'upper', 'kishin'].includes(a.difficulty) || !['balanced', 'defensive', 'aggressive'].includes(a.personality))) throw new Error('三人 AI 配置无效');
  return deepFreeze({ ...structuredClone(c), time: snapshotTimeControl(c.time, 'sanma') });
}
