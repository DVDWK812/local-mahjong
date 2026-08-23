import { normalYaku, yakumanYaku, type YakuResult } from '../types';

export const ANCIENT_YAKU = {
  tsubamegaeshi: () => normalYaku('tsubamegaeshi', '燕返', 1, true, 1, 1),
  kanfuri: () => normalYaku('kanfuri', '杠振', 1, true, 1, 1),
  shiieruota: () => normalYaku('shiisanpuutaa', '十二落抬', 1, true, 1, 1),
  uumensai: () => normalYaku('go-men-zei', '五门齐', 2, true, 2, 2),
  sanrenkou: () => normalYaku('sanrenkou', '三连刻', 2, true, 2, 2),
  isshokuSanjun: (closed: boolean) => normalYaku('isshoku-sanjun', '一色三同顺', closed ? 3 : 2, true, 3, 2),
  iipinmooyue: () => normalYaku('one-pin-moon', '一筒摸月', 5, true, 5, 5),
  chuupinraoyui: () => normalYaku('nine-pin-fish', '九筒捞鱼', 5, true, 5, 5),
  renhou: () => yakumanYaku('renhou', '人和', 1),
  daisharin: () => yakumanYaku('daisharin', '大车轮', 1),
  daichikurin: () => yakumanYaku('daichikurin', '大竹林', 1),
  daisuurin: () => yakumanYaku('daisuulin', '大数邻', 1),
  suurenkou: () => yakumanYaku('suurenkou', '四连刻', 1),
  ishinoUenoSannen: () => yakumanYaku('ishigami-sannen', '石上三年', 1),
  daichisei: () => yakumanYaku('daichisei', '大七星', 2),
} satisfies Record<string, (...args: any[]) => YakuResult>;

export const ANCIENT_YAKU_IDS = Object.keys(ANCIENT_YAKU);
