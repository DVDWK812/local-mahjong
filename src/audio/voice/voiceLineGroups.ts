import type { VoiceLine } from './types';

export type VoiceLineGroupId = 'personal' | 'actions' | 'special-game' | 'score' | 'yakuman' | 'regular-yaku' | 'special-yaku' | 'dora' | 'tiles';

export interface VoiceLineGroup {
  readonly id: VoiceLineGroupId;
  readonly title: string;
}

export const VOICE_LINE_GROUPS: readonly VoiceLineGroup[] = [
  { id: 'personal', title: '个性化 / 对局' },
  { id: 'actions', title: '核心动作' },
  { id: 'special-game', title: '特殊对局' },
  { id: 'score', title: '结算等级' },
  { id: 'yakuman', title: '役满' },
  { id: 'regular-yaku', title: '常规役种' },
  { id: 'special-yaku', title: '特殊役' },
  { id: 'dora', title: '宝牌' },
  { id: 'tiles', title: '出牌报牌' },
];

const PERSONAL_KEYS = new Set([
  'game.start', 'game.end', 'game.draw', 'result.second_place', 'result.third_place', 'result.fourth_place',
  'yaku.tenpai', 'yaku.noten',
]);
const SETTLEMENT_YAKU = new Set(['yaku.triple_yakuman', 'yaku.quadruple_yakuman', 'yaku.quintuple_yakuman', 'yaku.sextuple_yakuman']);
const YAKUMAN_YAKU = new Set(['yaku.tenhou', 'yaku.chiihou', 'yaku.kokushi_13_wait', 'yaku.suukantsu', 'yaku.junsei_chuuren']);
const REGULAR_YAKU = new Set([
  'yaku.riichi', 'yaku.ippatsu', 'yaku.chankan', 'yaku.rinshan_kaihou', 'yaku.haitei', 'yaku.houtei',
  'yaku.ton', 'yaku.shaa', 'yaku.nan', 'yaku.pei', 'yaku.haku', 'yaku.hatsu', 'yaku.chun',
  'yaku.pinfu', 'yaku.tanyao', 'yaku.iipeikou', 'yaku.chanta', 'yaku.honroutou', 'yaku.toitoi',
  'yaku.sanankou', 'yaku.sanshoku', 'yaku.ittsu', 'yaku.sankantsu',
  'yaku.sanshoku_doukou', 'yaku.junchan', 'yaku.chinitsu', 'yaku.honitsu', 'yaku.chiitoitsu',
  'yaku.shousangen', 'yaku.ryanpeikou',
]);

/** Derives a UI-only heading from the real VoiceLine identity; it never creates CSV rows. */
export function voiceLineGroupId(line: Pick<VoiceLine, 'key' | 'category'>): VoiceLineGroupId {
  if (line.key.startsWith('tile.')) return 'tiles';
  if (line.key === 'yaku.dora' || /^yaku\.dora_(?:\d+|many)$/.test(line.key)) return 'dora';
  if (line.category === 'flavor' || PERSONAL_KEYS.has(line.key)) return 'personal';
  if (line.category === 'action') return 'actions';
  if (line.category === 'game') return 'special-game';
  if (line.category === 'score' || SETTLEMENT_YAKU.has(line.key)) return 'score';
  if (line.category === 'yakuman' || YAKUMAN_YAKU.has(line.key)) return 'yakuman';
  if (REGULAR_YAKU.has(line.key)) return 'regular-yaku';
  return 'special-yaku';
}

export interface GroupedVoiceLines { readonly group: VoiceLineGroup; readonly lines: readonly VoiceLine[]; }

/** Keeps incoming CSV order inside every group and omits empty headings (including search results). */
export function groupVoiceLines(lines: readonly VoiceLine[]): readonly GroupedVoiceLines[] {
  const buckets = new Map<VoiceLineGroupId, VoiceLine[]>();
  for (const line of lines) {
    const groupId = voiceLineGroupId(line);
    const bucket = buckets.get(groupId) ?? [];
    bucket.push(line); buckets.set(groupId, bucket);
  }
  return VOICE_LINE_GROUPS.flatMap((group) => {
    const grouped = buckets.get(group.id) ?? [];
    return grouped.length ? [{ group, lines: grouped }] : [];
  });
}
