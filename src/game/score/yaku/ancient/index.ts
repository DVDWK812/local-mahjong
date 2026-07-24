import { normalYaku, type YakuResult } from '../types';

export const ANCIENT_YAKU = {
  renhou: () => normalYaku('人和', 5, false),
  daisharin: () => normalYaku('大车轮', 6, false),
  daichikurin: () => normalYaku('大竹林', 6, false),
  daisuurin: () => normalYaku('大数邻', 6, false),
  sanrenkou: () => normalYaku('三连刻', 2, true),
  suurenkou: () => normalYaku('四连刻', 4, true),
  isshokuSanjun: () => normalYaku('一色三顺', 3, true),
  chiiseiPuutao: () => normalYaku('七星不靠', 6, false),
  shiisanPuuta: () => normalYaku('十三不塔', 6, false),
} satisfies Record<string, () => YakuResult>;
