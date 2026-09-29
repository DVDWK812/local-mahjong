import type { AIPlayerSetting } from '../../components/MatchSettings';
import { defaultTimeControl, snapshotTimeControl, type TimeControlConfig } from '../timeControl/config';

export const XZ_VERSION = 1;
export const PRESETS = { declared: '定缺基础', 'declared-exchange': '定缺换三张', dynamic: '自由基础', 'dynamic-exchange': '自由换三张' } as const;
export type Preset = keyof typeof PRESETS;
export const PATTERNS = {
  allTriplets: ['大对子', '普通拆分的四组面子均为刻子或杠', 1, true],
  pure: ['清一色', '手牌、副露及胡牌来源仅一种花色', 2, true],
  sevenPairs: ['七对', '无副露，四张同牌可计两对；与普通拆分互斥', 2, true],
  root: ['根', '完整牌型每种四张计一根，派生名称不重复加番', 1, true],
  kongDraw: ['杠上花', '成功杠补牌后直接自摸', 1, true],
  kongDiscard: ['杠上炮', '成功杠补牌后直接弃牌被胡', 1, true],
  robKong: ['抢杠奖励', '抢补杠胡；允许抢杠与奖励分别配置', 1, true],
  lastDraw: ['海底自摸', '最后一张实体墙牌自摸', 1, false],
  lastDiscard: ['海底炮', '最后一张墙牌的直接弃牌被胡', 1, false],
  concealed: ['门清', '允许暗杠，不允许碰、直杠、补杠', 1, false],
  middle: ['中张', '完整牌型没有一或九', 1, false],
  singlePair: ['金钩钓', '四个已宣告面子（含暗杠）及最后将牌', 1, false],
  jiang: ['将对', '普通四面子加将，全部为二、五、八', 2, false],
  terminals: ['带幺九', '同一普通拆分每组面子与将均含一或九', 2, false],
  heaven: ['天胡', '准备结束后庄家首次弃牌前起手自摸', 3, false],
  earth: ['地胡', '无人碰杠前，闲家胡庄家的第一张弃牌', 3, false],
} as const;
export type Pattern = keyof typeof PATTERNS;
export interface XzRules {
  schemaVersion: 1; ruleVersion: 1; preset: Preset; presetVersion: 1;
  rounds: number; startingScore: number; bankruptcy: boolean; firstDealer: number; dealerPolicy: 'rotate' | 'first-win'; drawDealer: 'stay' | 'rotate';
  exchange: 0 | 3 | 4; direction: 'random' | 'clockwise' | 'counterclockwise' | 'opposite';
  missing: 'declared' | 'dynamic'; unclearedCalls: boolean;
  selfDrawOnly: boolean; multiWin: boolean; passWin: 'off' | 'until-draw' | 'higher'; robKong: boolean;
  base: number; cap: 0 | 2 | 3 | 4 | 5 | 6; selfDraw: 'none' | 'base' | 'fan'; selfDrawExtra: number; extraAfterCap: boolean;
  patterns: Record<Pattern, { enabled: boolean; fan: number }>;
  kongPay: boolean; directPay: 'source' | 'active'; directRate: number; addedRate: number; concealedRate: number;
  directResponsibility: boolean; transfer: boolean; transferSplit: 'nearest' | 'equal';
  pig: boolean; pigPenalty: 'cap' | 'fixed'; pigRate: number; pigIncludesWon: boolean;
  readyPay: boolean; readyPolicy: 'structural' | 'public'; pigAlsoReady: boolean; refund: 'off' | 'not-ready' | 'all-unwon';
}
export interface XzPreferences { autoWin: boolean; suppressCalls: boolean; autoTsumogiri: boolean; legalHelp: boolean; waitsHelp: boolean; fanHelp: boolean; spectator: boolean }
export interface XzConfig { mode: 'xuezhan'; rules: XzRules; ruleId: string; time: TimeControlConfig; ai: AIPlayerSetting[]; preferences: XzPreferences }
export const defaultPreferences = (): XzPreferences => ({ autoWin: false, suppressCalls: false, autoTsumogiri: false, legalHelp: true, waitsHelp: true, fanHelp: true, spectator: true });
export function presetRules(preset: Preset = 'declared-exchange'): XzRules {
  return { schemaVersion: 1, ruleVersion: 1, preset, presetVersion: 1, rounds: 4, startingScore: 100, bankruptcy: false, firstDealer: -1, dealerPolicy: 'rotate', drawDealer: 'rotate',
    exchange: preset.endsWith('exchange') ? 3 : 0, direction: 'random', missing: preset.startsWith('dynamic') ? 'dynamic' : 'declared', unclearedCalls: false,
    selfDrawOnly: false, multiWin: true, passWin: 'until-draw', robKong: true, base: 1, cap: 3, selfDraw: 'base', selfDrawExtra: 1, extraAfterCap: false,
    patterns: Object.fromEntries(Object.entries(PATTERNS).map(([id, [, , fan, enabled]]) => [id, { enabled, fan }])) as XzRules['patterns'],
    kongPay: true, directPay: 'source', directRate: 2, addedRate: 1, concealedRate: 2, directResponsibility: false, transfer: false, transferSplit: 'nearest',
    pig: true, pigPenalty: 'cap', pigRate: 8, pigIncludesWon: true, readyPay: true, readyPolicy: 'structural', pigAlsoReady: false, refund: 'not-ready' };
}
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
}
export function fingerprint(value: unknown): string {
  let a = 2166136261, b = 5381;
  for (const c of stableJson(value)) { a = Math.imul(a ^ c.charCodeAt(0), 16777619); b = Math.imul(b, 33) ^ c.charCodeAt(0); }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}
export function ruleId(r: XzRules): string { const { preset: _p, presetVersion: _v, ...semantic } = r; return `xz1-${fingerprint(semantic)}`; }
const enums: Partial<Record<keyof XzRules, readonly unknown[]>> = {
  preset: Object.keys(PRESETS), dealerPolicy: ['rotate', 'first-win'], drawDealer: ['stay', 'rotate'], exchange: [0, 3, 4], direction: ['random', 'clockwise', 'counterclockwise', 'opposite'],
  missing: ['declared', 'dynamic'], passWin: ['off', 'until-draw', 'higher'], cap: [0, 2, 3, 4, 5, 6], selfDraw: ['none', 'base', 'fan'], directPay: ['source', 'active'],
  transferSplit: ['nearest', 'equal'], pigPenalty: ['cap', 'fixed'], readyPolicy: ['structural', 'public'], refund: ['off', 'not-ready', 'all-unwon'],
};
export const RANGES: Partial<Record<keyof XzRules, readonly [number, number]>> = { rounds: [1, 64], startingScore: [0, 1000000], firstDealer: [-1, 3], base: [1, 100], selfDrawExtra: [0, 3], directRate: [0, 16], addedRate: [0, 16], concealedRate: [0, 16], pigRate: [1, 1024] };
export function validateRules(input: unknown): XzRules {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('血战规则必须是对象');
  const r = input as XzRules, defaults = presetRules();
  for (const k of Object.keys(r)) if (!(k in defaults)) throw new Error(`未知规则字段：${k}`);
  for (const [k, d] of Object.entries(defaults)) {
    const key = k as keyof XzRules, v = r[key];
    if (typeof v !== typeof d || v === null) throw new Error(`规则字段无效：${k}`);
    if (k.endsWith('Version') && v !== 1) throw new Error(`不支持的规则版本：${k}`);
    if (enums[key] && !enums[key]!.includes(v)) throw new Error(`规则枚举无效：${k}`);
    const range = RANGES[key];
    if (range && (!Number.isSafeInteger(v) || (v as number) < range[0] || (v as number) > range[1])) throw new Error(`${k} 必须为 ${range[0]}～${range[1]} 的整数`);
  }
  if (Object.keys(r.patterns).length !== Object.keys(PATTERNS).length) throw new Error('番型注册不完整');
  for (const k of Object.keys(PATTERNS) as Pattern[]) {
    const p = r.patterns[k];
    if (!p || typeof p.enabled !== 'boolean' || !Number.isInteger(p.fan) || p.fan < 0 || p.fan > 3) throw new Error(`番型无效：${k}`);
  }
  if (!r.kongPay && (r.transfer || r.refund !== 'off')) throw new Error('关闭杠分时必须关闭呼叫转移和退税');
  if (r.selfDrawOnly && (r.multiWin || r.passWin !== 'off' || r.robKong)) throw new Error('仅自摸时必须关闭多响、过手胡和抢补杠');
  if (r.pig && r.pigPenalty === 'cap' && r.cap === 0) throw new Error('不封顶时花猪须选择有限固定罚额');
  // Conservative upper bound, including four declared kongs and every enabled reward.
  const maxFan = Object.entries(r.patterns).reduce((n, [k, p]) => n + (p.enabled ? p.fan * (k === 'root' ? 4 : 1) : 0), 0) + r.selfDrawExtra;
  if (!Number.isSafeInteger(r.base * 2 ** (r.cap ? r.cap + r.selfDrawExtra : maxFan) * 4 * 108 * r.rounds)) throw new Error('计分配置可能超出安全整数范围，请降低番值或设置封顶');
  return structuredClone(r);
}
export function createConfig(rules = presetRules()): XzConfig {
  const r = validateRules(rules);
  return { mode: 'xuezhan', rules: r, ruleId: ruleId(r), time: defaultTimeControl('xuezhan'),
    ai: [1, 2, 3].map(playerId => ({ playerId: playerId as 1 | 2 | 3, difficulty: 'shintentai', personality: 'balanced' })), preferences: defaultPreferences() };
}
export function validateConfig(value: unknown): XzConfig {
  const c = value as XzConfig;
  if (!c || c.mode !== 'xuezhan') throw new Error('不是血战比赛配置');
  const rules = validateRules(c.rules);
  if (c.ruleId !== ruleId(rules)) throw new Error('规则标识与快照不一致');
  if (!Array.isArray(c.ai) || c.ai.length !== 3 || c.ai.some((a, i) => a.playerId !== i + 1 || !['chikukon', 'shintentai', 'upper', 'kishin'].includes(a.difficulty) || !['balanced', 'defensive', 'aggressive'].includes(a.personality))) throw new Error('AI 配置无效');
  if (!c.preferences || Object.keys(defaultPreferences()).some(k => typeof c.preferences[k as keyof XzPreferences] !== 'boolean')) throw new Error('偏好配置无效');
  return { ...structuredClone(c), rules, time: snapshotTimeControl(c.time, 'xuezhan') };
}
