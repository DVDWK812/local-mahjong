import type { PlayerId } from '../../game/types';
import type { LimitTier } from '../../game/score/pointCalculator';
import type { YakuhaiSource, YakuId } from '../../game/score/yaku/types';
import type { WinScoredPresentationEvent } from '../../presentation/PresentationEventBus';

export const DORA_MANY_THRESHOLD = 14;

export type WinPresentationItemKind = 'win-action' | 'yaku' | 'dora' | 'limit';
export interface WinPresentationItem {
  readonly kind: WinPresentationItemKind;
  readonly voiceKey: string;
  readonly actorId: PlayerId;
  readonly yakuId?: YakuId;
  readonly sourceTile?: YakuhaiSource;
  /** Awarded han for this result, never a theoretical closed/open value. */
  readonly han?: number;
  readonly totalDora?: number;
  readonly limitTier?: LimitTier;
  readonly yakumanMultiplier?: number;
  /** Human-facing display data is produced with the sequence, never re-derived by the UI. */
  readonly displayLabel?: string;
  readonly displayValue?: number;
}

export interface WinVoiceSequence {
  readonly id: string;
  readonly winnerId: PlayerId;
  readonly items: readonly WinPresentationItem[];
}

/**
 * Structured, safe-to-log diagnostic for a scored result. It deliberately
 * exposes only semantic scoring inputs and selected voice keys; no translated
 * yaku name or inferred score is used to make the sequence.
 */
export interface WinVoiceSequenceDiagnostic {
  readonly winnerId: PlayerId;
  readonly winType: 'ron' | 'tsumo';
  readonly yaku: readonly Pick<WinScoredPresentationEvent['yaku'][number], 'id' | 'sourceTile' | 'han' | 'yakuman'>[];
  readonly limitTier: LimitTier;
  readonly yakumanMultiplier: number;
  readonly totalDora: number;
  readonly voiceKeys: readonly string[];
}

export function describeWinVoiceSequence(event: WinScoredPresentationEvent): WinVoiceSequenceDiagnostic {
  return Object.freeze({
    winnerId: event.winnerId,
    winType: event.winType,
    yaku: event.yaku.map(({ id, sourceTile, han, yakuman }) => Object.freeze({ id, sourceTile, han, yakuman })),
    limitTier: event.limitTier,
    yakumanMultiplier: event.yakumanMultiplier,
    totalDora: event.totalDora,
    voiceKeys: Object.freeze(buildWinVoiceSequence(event).items.map((item) => item.voiceKey)),
  });
}

type YakuVoiceMapping = Readonly<{ voiceKey: string; yakuman?: boolean }>;

/** Explicit canonical order used only to break ties between equal awarded han. */
export const YAKU_VOICE_ORDER: readonly YakuId[] = [
  'riichi', 'double-riichi', 'ippatsu', 'menzen-tsumo', 'yakuhai', 'pinfu', 'tanyao', 'iipeikou',
  'haitei', 'houtei', 'rinshan-kaihou', 'chankan', 'chiitoitsu', 'toitoi', 'sanankou',
  'sanshoku-doujun', 'sanshoku-doukou', 'sankantsu', 'shousangen', 'ittsu', 'chanta', 'honroutou',
  'ryanpeikou', 'junchan', 'honitsu', 'chinitsu',
  'tsubamegaeshi', 'kanfuri', 'shiisanpuutaa', 'go-men-zei', 'sanrenkou', 'isshoku-sanjun',
  'one-pin-moon', 'nine-pin-fish',
  'tenhou', 'chiihou', 'kokushi-13-wait', 'kokushi', 'suuankou-tanki', 'suuankou', 'daisangen',
  'shousuushii', 'daisuushii', 'tsuuiisou', 'ryuuiisou', 'chinroutou', 'junsei-chuuren', 'chuuren',
  'suukantsu', 'renhou', 'daisharin', 'daichikurin', 'daisuulin', 'suurenkou', 'ishigami-sannen', 'daichisei',
];

const YAKU_ORDER_INDEX = new Map(YAKU_VOICE_ORDER.map((id, index) => [id, index]));
const YAKUHAI_VOICE_KEYS: Readonly<Record<YakuhaiSource, string>> = {
  east: 'yaku.ton', south: 'yaku.nan', west: 'yaku.shaa', north: 'yaku.pei',
  white: 'yaku.haku', green: 'yaku.hatsu', red: 'yaku.chun',
};

const YAKU_VOICE_KEYS: Readonly<Partial<Record<YakuId, YakuVoiceMapping>>> = {
  riichi: { voiceKey: 'yaku.riichi' },
  ippatsu: { voiceKey: 'yaku.ippatsu' },
  chankan: { voiceKey: 'yaku.chankan' },
  'rinshan-kaihou': { voiceKey: 'yaku.rinshan_kaihou' },
  haitei: { voiceKey: 'yaku.haitei' }, houtei: { voiceKey: 'yaku.houtei' }, pinfu: { voiceKey: 'yaku.pinfu' },
  tanyao: { voiceKey: 'yaku.tanyao' }, iipeikou: { voiceKey: 'yaku.iipeikou' }, chanta: { voiceKey: 'yaku.chanta' },
  honroutou: { voiceKey: 'yaku.honroutou' }, toitoi: { voiceKey: 'yaku.toitoi' }, sanankou: { voiceKey: 'yaku.sanankou' },
  'sanshoku-doujun': { voiceKey: 'yaku.sanshoku' }, ittsu: { voiceKey: 'yaku.ittsu' }, sankantsu: { voiceKey: 'yaku.sankantsu' },
  'sanshoku-doukou': { voiceKey: 'yaku.sanshoku_doukou' }, junchan: { voiceKey: 'yaku.junchan' },
  chinitsu: { voiceKey: 'yaku.chinitsu' }, honitsu: { voiceKey: 'yaku.honitsu' }, chiitoitsu: { voiceKey: 'yaku.chiitoitsu' },
  shousangen: { voiceKey: 'yaku.shousangen' }, ryanpeikou: { voiceKey: 'yaku.ryanpeikou' },
  tsubamegaeshi: { voiceKey: 'yaku.tsubamegaeshi' }, kanfuri: { voiceKey: 'yaku.kanfuri' },
  shiisanpuutaa: { voiceKey: 'yaku.shiisanpuutaa' }, 'go-men-zei': { voiceKey: 'yaku.go_men_zei' },
  sanrenkou: { voiceKey: 'yaku.sanrenkou' }, 'isshoku-sanjun': { voiceKey: 'yaku.isshoku_sanjun' },
  'one-pin-moon': { voiceKey: 'yaku.one_pin_moon' }, 'nine-pin-fish': { voiceKey: 'yaku.nine_pin_fish' },
  tenhou: { voiceKey: 'yaku.tenhou', yakuman: true }, chiihou: { voiceKey: 'yaku.chiihou', yakuman: true },
  'kokushi-13-wait': { voiceKey: 'yaku.kokushi_13_wait', yakuman: true }, suukantsu: { voiceKey: 'yaku.suukantsu', yakuman: true },
  'junsei-chuuren': { voiceKey: 'yaku.junsei_chuuren', yakuman: true },
  kokushi: { voiceKey: 'yakuman.kokushi', yakuman: true }, suuankou: { voiceKey: 'yakuman.suuankou', yakuman: true },
  'suuankou-tanki': { voiceKey: 'yakuman.suuankou_tanki', yakuman: true }, daisangen: { voiceKey: 'yakuman.daisangen', yakuman: true },
  shousuushii: { voiceKey: 'yakuman.shousuushi', yakuman: true }, daisuushii: { voiceKey: 'yakuman.daisuushi', yakuman: true },
  tsuuiisou: { voiceKey: 'yakuman.tsuuiisou', yakuman: true }, ryuuiisou: { voiceKey: 'yakuman.ryuuiisou', yakuman: true },
  chinroutou: { voiceKey: 'yakuman.chinroutou', yakuman: true }, chuuren: { voiceKey: 'yakuman.chuuren', yakuman: true },
  renhou: { voiceKey: 'yaku.renhou', yakuman: true }, daisharin: { voiceKey: 'yaku.daisharin', yakuman: true },
  daichikurin: { voiceKey: 'yaku.daichikurin', yakuman: true }, daisuulin: { voiceKey: 'yaku.daisuulin', yakuman: true },
  suurenkou: { voiceKey: 'yaku.suurenkou', yakuman: true }, 'ishigami-sannen': { voiceKey: 'yaku.ishigami_sannen', yakuman: true },
  daichisei: { voiceKey: 'yaku.daichisei', yakuman: true },
};

const SPECIFIC_YAKUMAN_BASE: Readonly<Partial<Record<YakuId, YakuId>>> = {
  'kokushi-13-wait': 'kokushi', 'suuankou-tanki': 'suuankou', 'junsei-chuuren': 'chuuren',
};

const LIMIT_VOICE_KEYS: Readonly<Partial<Record<LimitTier, string>>> = {
  mangan: 'score.mangan', haneman: 'score.haneman', baiman: 'score.baiman', sanbaiman: 'score.sanbaiman',
  'counted-yakuman': 'score.counted_yakuman',
};

/** Builds display- and locale-independent ordered data for one winner. */
export function buildWinVoiceSequence(event: WinScoredPresentationEvent): WinVoiceSequence {
  const action: WinPresentationItem = { kind: 'win-action', voiceKey: event.winType === 'ron' ? 'action.ron' : 'action.tsumo', actorId: event.winnerId };
  const yakumanPath = event.yakumanMultiplier > 0;
  const yakuItems = stableYakuEntries(event, yakumanPath)
    .flatMap((entry) => toYakuItem(entry, event.winnerId, yakumanPath));
  const items: WinPresentationItem[] = [action, ...yakuItems];

  if (!yakumanPath) {
    const doraKey = doraVoiceKey(event.totalDora);
    if (doraKey) items.push({ kind: 'dora', voiceKey: doraKey, actorId: event.winnerId, totalDora: event.totalDora });
    const limitKey = LIMIT_VOICE_KEYS[event.limitTier];
    if (limitKey) items.push({ kind: 'limit', voiceKey: limitKey, actorId: event.winnerId, limitTier: event.limitTier });
  } else {
    items.push({ kind: 'limit', voiceKey: yakumanMultiplierVoiceKey(event.yakumanMultiplier), actorId: event.winnerId, yakumanMultiplier: event.yakumanMultiplier });
  }
  return {
    id: event.eventId,
    winnerId: event.winnerId,
    items: items.map((item) => ({
      ...item,
      displayLabel: presentationLabel(item),
      displayValue: item.kind === 'dora' ? item.totalDora : undefined,
    })),
  };
}

const PRESENTATION_LABELS: Readonly<Record<string, string>> = {
  'action.ron': '荣和', 'action.tsumo': '自摸',
  'score.mangan': '满贯', 'score.haneman': '跳满', 'score.baiman': '倍满', 'score.sanbaiman': '三倍满',
  'score.counted_yakuman': '累计役满', 'score.yakuman': '役满', 'score.double_yakuman': '双倍役满',
  'yaku.triple_yakuman': '三倍役满', 'yaku.quadruple_yakuman': '四倍役满', 'yaku.quintuple_yakuman': '五倍役满', 'yaku.sextuple_yakuman': '六倍役满',
  'yaku.riichi': '立直', 'yaku.ippatsu': '一发', 'yaku.chankan': '抢杠', 'yaku.rinshan_kaihou': '岭上开花',
  'yaku.haitei': '海底摸月', 'yaku.houtei': '河底捞鱼', 'yaku.ton': '东', 'yaku.nan': '南', 'yaku.shaa': '西', 'yaku.pei': '北',
  'yaku.haku': '白', 'yaku.hatsu': '发', 'yaku.chun': '中', 'yaku.pinfu': '平和', 'yaku.tanyao': '断幺九',
  'yaku.iipeikou': '一杯口', 'yaku.chanta': '混全带幺九', 'yaku.honroutou': '混老头', 'yaku.toitoi': '对对和',
  'yaku.sanankou': '三暗刻', 'yaku.sanshoku': '三色同顺', 'yaku.ittsu': '一气通贯', 'yaku.sankantsu': '三杠子',
  'yaku.sanshoku_doukou': '三色同刻', 'yaku.junchan': '纯全带幺九', 'yaku.chinitsu': '清一色', 'yaku.honitsu': '混一色',
  'yaku.chiitoitsu': '七对子', 'yaku.shousangen': '小三元', 'yaku.ryanpeikou': '二杯口',
  'yakuman.kokushi': '国士无双', 'yakuman.suuankou': '四暗刻', 'yakuman.suuankou_tanki': '四暗刻单骑',
  'yakuman.daisangen': '大三元', 'yakuman.shousuushi': '小四喜', 'yakuman.daisuushi': '大四喜',
  'yakuman.tsuuiisou': '字一色', 'yakuman.ryuuiisou': '绿一色', 'yakuman.chinroutou': '清老头', 'yakuman.chuuren': '九莲宝灯',
  'yaku.tenhou': '天和', 'yaku.chiihou': '地和', 'yaku.kokushi_13_wait': '国士无双十三面', 'yaku.suukantsu': '四杠子',
  'yaku.junsei_chuuren': '纯正九连宝灯', 'yaku.tsubamegaeshi': '燕返', 'yaku.kanfuri': '杠振',
  'yaku.shiisanpuutaa': '十二落抬', 'yaku.go_men_zei': '五门齐', 'yaku.sanrenkou': '三连刻',
  'yaku.isshoku_sanjun': '一色三同顺', 'yaku.one_pin_moon': '一筒摸月', 'yaku.nine_pin_fish': '九筒捞鱼',
  'yaku.renhou': '人和', 'yaku.daisharin': '大车轮', 'yaku.daichikurin': '大竹林', 'yaku.daisuulin': '大数邻',
  'yaku.suurenkou': '四连刻', 'yaku.ishigami_sannen': '石上三年', 'yaku.daichisei': '大七星',
};

function presentationLabel(item: WinPresentationItem): string {
  if (item.kind === 'dora') return '宝牌';
  return PRESENTATION_LABELS[item.voiceKey] ?? item.yakuId ?? item.voiceKey;
}

export function doraVoiceKey(totalDora: number): string | undefined {
  if (!Number.isFinite(totalDora) || totalDora <= 0) return undefined;
  if (totalDora >= DORA_MANY_THRESHOLD) return 'yaku.dora_many';
  return totalDora === 1 ? 'yaku.dora' : `yaku.dora_${Math.floor(totalDora)}`;
}

function yakumanMultiplierVoiceKey(multiplier: number): string {
  if (multiplier <= 1) return 'score.yakuman';
  if (multiplier === 2) return 'score.double_yakuman';
  if (multiplier === 3) return 'yaku.triple_yakuman';
  if (multiplier === 4) return 'yaku.quadruple_yakuman';
  if (multiplier === 5) return 'yaku.quintuple_yakuman';
  return 'yaku.sextuple_yakuman';
}

function stableYakuEntries(event: WinScoredPresentationEvent, yakumanPath: boolean) {
  const specificIds = new Set(event.yaku.map((entry) => entry.id));
  return event.yaku
    .filter((entry) => isYakumanEntry(entry) === yakumanPath)
    .filter((entry) => ![...specificIds].some((id) => SPECIFIC_YAKUMAN_BASE[id] === entry.id))
    .sort((left, right) => yakumanPath
      ? canonicalYakuOrder(left.id, right.id)
      : (left.han - right.han) || canonicalYakuOrder(left.id, right.id));
}

function isYakumanEntry(entry: WinScoredPresentationEvent['yaku'][number]): boolean {
  return entry.yakuman === true || YAKU_VOICE_KEYS[entry.id]?.yakuman === true;
}

function canonicalYakuOrder(left: YakuId, right: YakuId): number {
  return (YAKU_ORDER_INDEX.get(left) ?? Number.MAX_SAFE_INTEGER) - (YAKU_ORDER_INDEX.get(right) ?? Number.MAX_SAFE_INTEGER);
}

function toYakuItem(entry: WinScoredPresentationEvent['yaku'][number], actorId: PlayerId, yakumanPath: boolean): WinPresentationItem[] {
  if (entry.id === 'yakuhai') {
    const voiceKey = entry.sourceTile ? YAKUHAI_VOICE_KEYS[entry.sourceTile] : undefined;
    return voiceKey && !yakumanPath ? [{ kind: 'yaku', voiceKey, actorId, yakuId: entry.id, sourceTile: entry.sourceTile, han: entry.han }] : [];
  }
  const mapping = YAKU_VOICE_KEYS[entry.id];
  if (!mapping) return [];
  if ((mapping.yakuman === true) !== yakumanPath) return [];
  return [{ kind: 'yaku', voiceKey: mapping.voiceKey, actorId, yakuId: entry.id, han: entry.han }];
}
