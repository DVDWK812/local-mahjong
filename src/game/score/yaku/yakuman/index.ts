import { yakumanYaku, type YakuResult } from '../types';

export const YAKUMAN_YAKU = {
  tenhou: () => yakumanYaku('天和', 1),
  chiihou: () => yakumanYaku('地和', 1),
  kokushi: () => yakumanYaku('国士无双', 1),
  kokushi13: (doubleAllowed: boolean) => yakumanYaku('国士十三面', doubleAllowed ? 2 : 1),
  suuankou: () => yakumanYaku('四暗刻', 1),
  suuankouTanki: (doubleAllowed: boolean) => yakumanYaku('四暗刻单骑', doubleAllowed ? 2 : 1),
  daisangen: () => yakumanYaku('大三元', 1),
  shousuushii: () => yakumanYaku('小四喜', 1),
  daisuushii: (doubleAllowed: boolean) => yakumanYaku('大四喜', doubleAllowed ? 2 : 1),
  tsuuiisou: () => yakumanYaku('字一色', 1),
  ryuuiisou: () => yakumanYaku('绿一色', 1),
  chinroutou: () => yakumanYaku('清老头', 1),
  chuuren: () => yakumanYaku('九莲宝灯', 1),
  chuuren9: (doubleAllowed: boolean) => yakumanYaku('纯正九莲宝灯九面', doubleAllowed ? 2 : 1),
  suukantsu: () => yakumanYaku('四杠子', 1),
} satisfies Record<string, (...args: any[]) => YakuResult>;
