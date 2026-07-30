import { normalYaku, yakumanYaku, type YakuResult } from '../types';

export const ANCIENT_YAKU = {
  tsubamegaeshi: () => normalYaku('燕返', 1, true, 1, 1),
  kanfuri: () => normalYaku('杠振', 1, true, 1, 1),
  shiieruota: () => normalYaku('十二落抬', 1, true, 1, 1),
  uumensai: () => normalYaku('五门齐', 2, true, 2, 2),
  sanrenkou: () => normalYaku('三连刻', 2, true, 2, 2),
  isshokuSanjun: (closed: boolean) => normalYaku('一色三同顺', closed ? 3 : 2, true, 3, 2),
  iipinmooyue: () => normalYaku('一筒摸月', 5, true, 5, 5),
  chuupinraoyui: () => normalYaku('九筒捞鱼', 5, true, 5, 5),
  renhou: () => yakumanYaku('人和', 1),
  daisharin: () => yakumanYaku('大车轮', 1),
  daichikurin: () => yakumanYaku('大竹林', 1),
  daisuurin: () => yakumanYaku('大数邻', 1),
  suurenkou: () => yakumanYaku('四连刻', 1),
  ishinoUenoSannen: () => yakumanYaku('石上三年', 1),
  daichisei: () => yakumanYaku('大七星', 2),
} satisfies Record<string, (...args: any[]) => YakuResult>;

export const ANCIENT_YAKU_IDS = Object.keys(ANCIENT_YAKU);
