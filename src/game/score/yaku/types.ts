export type YakuCategory = 'normal' | 'yakuman' | 'double_yakuman';

/** Stable, display-language-independent identifiers for every yaku the scorer emits. */
export type YakuId =
  | 'riichi' | 'double-riichi' | 'ippatsu' | 'menzen-tsumo' | 'pinfu' | 'iipeikou' | 'tanyao' | 'yakuhai'
  | 'haitei' | 'houtei' | 'rinshan-kaihou' | 'chankan' | 'chiitoitsu' | 'toitoi' | 'sanankou'
  | 'sanshoku-doujun' | 'sanshoku-doukou' | 'sankantsu' | 'shousangen' | 'ittsu' | 'chanta'
  | 'honroutou' | 'ryanpeikou' | 'junchan' | 'honitsu' | 'chinitsu'
  | 'tenhou' | 'chiihou' | 'kokushi' | 'kokushi-13-wait' | 'suuankou' | 'suuankou-tanki'
  | 'daisangen' | 'shousuushii' | 'daisuushii' | 'tsuuiisou' | 'ryuuiisou' | 'chinroutou'
  | 'chuuren' | 'junsei-chuuren' | 'suukantsu'
  | 'tsubamegaeshi' | 'kanfuri' | 'shiisanpuutaa' | 'go-men-zei' | 'sanrenkou' | 'isshoku-sanjun'
  | 'one-pin-moon' | 'nine-pin-fish' | 'renhou' | 'daisharin' | 'daichikurin' | 'daisuulin'
  | 'suurenkou' | 'ishigami-sannen' | 'daichisei';

/** The semantic tile behind a yakuhai result; display labels remain separate. */
export type YakuhaiSource = 'east' | 'south' | 'west' | 'north' | 'white' | 'green' | 'red';

export interface YakuResult {
  id: YakuId;
  name: string;
  sourceTile?: YakuhaiSource;
  category: YakuCategory;
  han?: number;
  yakuman?: boolean;
  yakumanValue?: number;
  closedHan?: number;
  openHan?: number;
  openAllowed: boolean;
}

export function normalYaku(id: YakuId, name: string, han: number, openAllowed: boolean, closedHan?: number, openHan?: number, sourceTile?: YakuhaiSource): YakuResult {
  return {
    id,
    name,
    sourceTile,
    category: 'normal',
    han,
    closedHan,
    openHan,
    openAllowed,
  };
}

export function yakumanYaku(id: YakuId, name: string, yakumanValue = 1): YakuResult {
  return {
    id,
    name,
    category: yakumanValue >= 2 ? 'double_yakuman' : 'yakuman',
    yakuman: true,
    yakumanValue,
    openAllowed: true,
  };
}
