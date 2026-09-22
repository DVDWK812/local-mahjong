import { yakumanYaku, type YakuResult } from '../types';

export const YAKUMAN_YAKU = {
  tenhou: () => yakumanYaku('tenhou', '天和', 1),
  chiihou: () => yakumanYaku('chiihou', '地和', 1),
  kokushi: () => yakumanYaku('kokushi', '国士无双', 1),
  kokushi13: (doubleAllowed: boolean) => yakumanYaku('kokushi-13-wait', '国士十三面', doubleAllowed ? 2 : 1),
  suuankou: () => yakumanYaku('suuankou', '四暗刻', 1),
  suuankouTanki: (doubleAllowed: boolean) => yakumanYaku('suuankou-tanki', '四暗刻单骑', doubleAllowed ? 2 : 1),
  daisangen: () => yakumanYaku('daisangen', '大三元', 1),
  shousuushii: () => yakumanYaku('shousuushii', '小四喜', 1),
  daisuushii: (doubleAllowed: boolean) => yakumanYaku('daisuushii', '大四喜', doubleAllowed ? 2 : 1),
  tsuuiisou: () => yakumanYaku('tsuuiisou', '字一色', 1),
  ryuuiisou: () => yakumanYaku('ryuuiisou', '绿一色', 1),
  chinroutou: () => yakumanYaku('chinroutou', '清老头', 1),
  chuuren: () => yakumanYaku('chuuren', '九莲宝灯', 1),
  chuuren9: (doubleAllowed: boolean) => yakumanYaku('junsei-chuuren', '纯正九莲宝灯九面', doubleAllowed ? 2 : 1),
  suukantsu: () => yakumanYaku('suukantsu', '四杠子', 1),
} satisfies Record<string, (...args: any[]) => YakuResult>;
