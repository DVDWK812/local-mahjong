import type { SanmaUiTuning } from './sanmaUiTuningTypes';

/**
 * 三麻相对正式共享基线的唯一微调入口；改数字即可由 Vite 热更新。
 * 世界轴：+X 桌面右方、+Y 向上、+Z 朝 bottom（固定相机位于 +Y/+Z）。
 * 世界 position 是平移增量（桌面单位），rotation 为世界轴 XYZ 欧拉角增量（弧度）。
 * 旋转/缩放围绕各区域的共享基线锚点；scale=1 保持基线。不是相机参数。
 * DOM：x/y 为 CSS px，+X 向右、+Y 向下；rotation 为弧度，scale=1 保持响应式基线。
 * bottom=当前观察者，right=规则下一位，top=第三位；没有 left 玩家配置。
 * 本家 hand 是 DOM，不能用世界坐标；right/top hand 才是 3D。
 */
export const SANMA_UI_TUNING = {
  seats: {
    bottom: {
      hand:  { x: 0, y: 0, rotation: 0, scale: 1 }, // 本家屏幕手牌
      river: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // 牌河
      melds: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // 鸣牌（与拔北独立）
      nuki: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // 拔北区
      avatar: { x: 0, y: 0, scale: 1 }, // 响应式头像的最终 CSS px 偏移
    },
    right: {
      hand: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // 对手暗手/明手
      river: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // 牌河
      melds: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // 鸣牌（与拔北独立）
      nuki: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // 拔北区
      avatar: { x: 0, y: 0, scale: 1 }, // 响应式头像的最终 CSS px 偏移
    },
    top: {
      hand: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // 对手暗手/明手
      river: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // 牌河
      melds: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // 鸣牌（与拔北独立）
      nuki: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // 拔北区
      avatar: { x: 0, y: 0, scale: 1 }, // 响应式头像的最终 CSS px 偏移
    },
  },
  center: {
    scoreHud: { x: 0, y: 0, z: 0, scale: 1 }, // 3D Html 锚点世界增量；保留共享响应式缩放
  },
  northLane: { radialOffset: 2.5, gap: 0.12 }, // 迁入既有拔北道参数：seat-local 径向偏移、牌间距（桌面单位）
} as const satisfies SanmaUiTuning;

