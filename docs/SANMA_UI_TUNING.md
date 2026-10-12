# 三麻 UI 集中微调

唯一手调文件：[sanmaUiTuning.ts](../src/presentation3d/table/sanmaUiTuning.ts)。只改这个文件的数字即可。它不包含规则、AI、时间、音频或相机参数；不需要编辑共享组件或重建页面。

## 完整配置结构

下列 W、D、H 是字段结构说明，不是需要用户创建的对象：

```ts
// W：3D 世界增量。三个轴都必须填写。
W = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }
// D：响应式 DOM 基线之后的 CSS px 偏移。
D = { x: 0, y: 0, scale: 1 }
// H：本家 DOM 手牌，附加屏幕平面旋转（弧度）。
H = { x: 0, y: 0, rotation: 0, scale: 1 }

SANMA_UI_TUNING = {
  seats: {
    bottom: { hand: H, river: W, melds: W, nuki: W, avatar: D },
    right:  { hand: W, river: W, melds: W, nuki: W, avatar: D },
    top:    { hand: W, river: W, melds: W, nuki: W, avatar: D },
  },
  center: { scoreHud: { x: 0, y: 0, z: 0, scale: 1 } },
  northLane: { radialOffset: 2.5, gap: 0.12 },
}
```

真实文件逐席展开所有字段，使用 readonly 类型与 satisfies SanmaUiTuning 校验。无 left 项，无运行时 Three.js mutable 对象。bottom 是当前观察者，right 是规则下一位，top 是第三位；换观察席后配置仍跟随屏幕方向，换庄不重新分配配置。

## 坐标、基线与消费者

世界轴来自当前正式坐标系：+X 桌面右方，+Y 向上，+Z 朝 bottom；固定相机在 +Y/+Z 一侧。3D 单位为现有桌面单位，rotation 使用弧度、XYZ 欧拉角增量。旋转与缩放围绕对应区域的共享基线锚点，不绕世界原点，也不会改变相机。位置偏移保持世界轴方向，不因玩家座风改变。

DOM x/y 使用 CSS px，+X 向右、+Y 向下。头像沿用现有响应式尺寸，最后叠加偏移与 scale；本家 hand 仍是 screen-space DOM，rotation 为屏幕平面弧度。scale=1 表示保留基线比例，并非把现有组件缩放设为绝对1。

| 字段 | 实际组件 / 作用 |
| --- | --- |
| bottom.hand | LocalHandArea 的现有屏幕手牌；偏移叠加 getLocalHandScreenOffset，牌按钮和源矩形一起移动 |
| right.hand、top.hand | Hand3D 的整组手牌，包含明牌/暗手、静态命中实体与快照动画手牌 |
| 三席 river | River3D；六列、立直横牌、长河仍由共享 resolver 决定 |
| 三席 melds | Meld3D；保留共享碰/杠/叠牌布局 |
| 三席 nuki | NorthTiles3D；只影响北区，不影响鸣牌 |
| 三席 avatar | Table3DHudView / Table3DPlayerFrame；在原 responsive avatar 基线之后叠加 |
| center.scoreHud | CentralConsoleHudAnchor3D 的 Html 世界锚点；位置相加、响应式 scale 相乘，不移动桌体装饰/立直道 |
| northLane | 既有拔北道 seat-local 径向偏移和牌间距；三个座位共有的基础排布 |

River/Meld/Hand 的共享四人 resolver 完全不读取这个配置。唯一运行时常量导入者是 SanmaScreen；它在 buildSanmaFormalScene 之后调用 renderer 内的 applySanmaUiTuning，向共享组件提供可选只读参数。四人、17步、血战没有这一步。FormalGameScreen → FormalTable3D → Table3DScene 链不变，也没有另一套三麻组件。

静态区域通过同一 RegionGroup 矩阵变换；摸切、碰杠、拔北的源/目标区域调整由共享动画消费，DOM 弃牌投影也使用调后的牌河角点。原 scheduler、pacing、deadline 不变。手部接触点投影与静态区域使用相同调整，取消/卸载仍走现有清理。

## 等价迁移范围

默认 position/rotation 为0、scale为1，保持接入前的正式视觉。NorthTiles3D 内原有的径向 +2.5 和牌间距0.12迁到 northLane，默认最终坐标逐席逐牌有数值等价测试。其他区域此前没有需要迁出的三麻专用坐标；共享手牌/牌河/鸣牌/头像基线仍在原 authority，不复制到本文件。

2026-10-03 用户明确批准全局 HUD-only 最终锚点 [-0.1, 0.698, 1.9]（用户说明已记入 Notion 第27节），对应精确测试基线同步为1.9；center.scoreHud 默认 z=0 表示在共享1.9上增加0。此次批准不改变三麻偏移、生产布局或其他坐标。

## 使用与复现

启动 npm run dev，在测试模式 → 三人立直麻将加载场景。正式三人东/南、测试、保存恢复、回放均经同一个 SanmaScreen，因此读取同一配置。

- SM-18-LONG-RIVER：适合观察三席牌河、方向、长河换行及 HUD。
- SM-09-EIGHT：连续拔出剩余两北，观察北区与四杠独立调整；换观察席检查top/right。
- SM-06-DOUBLE：拔北、两个响应者荣和；观察座席方向、动作和结果。
- SM-15-RESTORE：检查恢复后仍是同一配置，无历史玩家重排。
- SM-16-REPLAY：从账本进入回放，切观察席与seek，屏幕方向配置不变。

可保持“完全控制（关闭AI）”、暂停后单步，以固定画面微调。修改例如 top.river.position.x，Vite HMR 应让上方牌河变化；改回0恢复。不要保留临时验收数值。若同时有其他任务编辑共享外观资源引发整页刷新，重新加载同一fixture即可，不要把该刷新归为本配置的必要流程。

本轮 HMR 临时 x=3 已恢复为0。验证详情、真实 viewport 尺寸、截图和剩余阻断见 [验收记录](../artifacts/sanma-ui-tuning/ACCEPTANCE.md)。未代填人工视觉通过。
