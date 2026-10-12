import { defaultTimeControl, snapshotTimeControl, type TimeControlConfig } from '../timeControl/config';
import type { AIPlayerSetting } from '../../components/MatchSettings';

export const GB_RULES_VERSION = 'wmo-cn-2014-publication-v1' as const;
export const GB_FAN_VERSION = 'wmo-cn-2014-81-v1' as const;
export const GB_DIGITAL_VERSION = 'gb-local-digital-v1' as const;
export interface GbConfig {
  mode: 'guobiao'; schemaVersion: 1; rulesVersion: typeof GB_RULES_VERSION; fanTableVersion: typeof GB_FAN_VERSION;
  digitalPolicyVersion: typeof GB_DIGITAL_VERSION; length: 'single' | 'sixteen';
  names: [string, string, string, string]; ai: AIPlayerSetting[]; hints: boolean; time: TimeControlConfig;
}
export function createGbConfig(length: GbConfig['length'] = 'sixteen'): GbConfig {
  return { mode: 'guobiao', schemaVersion: 1, rulesVersion: GB_RULES_VERSION, fanTableVersion: GB_FAN_VERSION,
    digitalPolicyVersion: GB_DIGITAL_VERSION, length, names: ['你', '电脑一', '电脑二', '电脑三'],
    ai: [1, 2, 3].map(playerId => ({ playerId: playerId as 1 | 2 | 3, difficulty: 'shintentai', personality: 'balanced' })),
    hints: true, time: defaultTimeControl('guobiao') };
}
export function snapshotGbConfig(value: unknown): GbConfig {
  const c = value as GbConfig;
  if (!c || c.mode !== 'guobiao' || c.schemaVersion !== 1 || c.rulesVersion !== GB_RULES_VERSION
    || c.fanTableVersion !== GB_FAN_VERSION || c.digitalPolicyVersion !== GB_DIGITAL_VERSION) throw new Error('国标规则版本不兼容');
  if (!['single', 'sixteen'].includes(c.length) || typeof c.hints !== 'boolean' || !Array.isArray(c.names)
    || c.names.length !== 4 || c.names.some(n => typeof n !== 'string' || !n.trim())) throw new Error('国标配置无效');
  if (!Array.isArray(c.ai) || c.ai.length !== 3 || c.ai.some((a, i) => a.playerId !== i + 1
    || !['chikukon', 'shintentai', 'upper', 'kishin'].includes(a.difficulty)
    || !['balanced', 'defensive', 'aggressive'].includes(a.personality))) throw new Error('国标 AI 配置无效');
  return { ...structuredClone(c), time: snapshotTimeControl(c.time, 'guobiao') };
}
