# 项目说明

这是 React + TypeScript + Vite 的本地麻将项目，包含稳定的 2.5D renderer 与正在迁移的 Three.js / R3F 3D renderer。

## Startup

开始任何任务时：

1. 读取适用范围内的 `AGENTS.md`。
2. 运行 `git status` 与 `git diff --stat`。
3. 记录并保留任务开始前已有的 dirty / untracked work。
4. 实现前检查任务是否匹配项目 Skill；匹配时先完整读取对应 `SKILL.md`。

不要覆盖、回退或格式化无关修改。若用户点名的 Skill 在当前 session 不可见，先报告，不要静默忽略。

## Skills routing

项目级 Skills 的 discovery 目录是 `.agents/skills/`。只加载当前任务需要的最小集合：

- 功能开发 → `mahjong-dev-task`
- Bug / 回归 / 异常行为 → `mahjong-bugfix`
- UI、交互、3D、Chrome / WebGL 验收 → `mahjong-ui-qa`
- Rules、番符、役、听牌、合法性 → `mahjong-rule-qa`
- AI、难度、人格、seed、决策回归 → `mahjong-ai-qa`
- Audio、Voice、BGM、SFX、manifest → `mahjong-asset-qa`
- 只读 diff / implementation 审查 → `mahjong-code-review`
- 提交、合并或发布前最终验收 → `mahjong-release-gate`

Skill 不得覆盖本文件的架构、安全或权限边界。不要让一个 Skill 无限制地自动加载全部 Skills。

## 架构不变量

### Rules authority

Rules / GameState / Scoring 是游戏结果的唯一权威。

Presentation / DOM / Three.js 不得：

- 重新判断动作是否合法；
- 直接修改 `GameState`；
- 复制第二套规则状态；
- 根据视觉状态推导规则结果。

### Shared Presentation

功能语义通过共享边界流向 renderer：

`GameState → Shared TablePresentationState → Shared TableInteractionActions → 2.5D / 3D renderers`

共享 playable、selected、drawn、riichi candidate、actions、Dora semantic slots、River / Meld semantic state；不共享 renderer-specific 坐标或视觉实现。

### 2.5D / 3D

2.5D 已稳定。除非任务明确要求，不修改 legacy 2.5D layout、CSS geometry 或交互，也不为方便 3D 开发而改变 2.5D 行为。

Three.js / R3F 只负责 world layout、geometry、materials、camera、hit targets 与 renderer animation。3D pointer 必须沿 `Tile → authoritative tile id → Shared Actions` 路由，不得直接调用 Rules 或 mutate `GameState`。

### Presentation animation

继续复用 `PresentationEvent → Animation consumer → AnimationScheduler → PresentationPacing`。Rules 不等待动画。

- Skip：立即进入最终 presentation state 并继续。
- Cancel / unmount：清理 proxy、mask 与 pending pacing。
- 不用固定 AI `setTimeout` 代替 `PresentationPacing`。

涉及 3D browser acceptance 时，按 `mahjong-ui-qa` 执行真实 Chrome / WebGL 验收；具体 viewport、Canvas、fallback、Console、Network、pointer 与截图要求只在该 Skill 中维护。

## 通用要求

- 所有界面文字使用简体中文。
- 优先复用现有组件、类型和工具函数。
- 保持接口和旧数据兼容。
- 只处理当前任务，禁止无关重构。
- 不删除、跳过或弱化测试，不通过放宽断言掩盖实现错误。

## Git 安全

禁止：

- `git reset --hard`
- `git clean -fd`
- 回退用户已有修改
- broad formatter
- 修改与任务无关的 dirty files

并行工作导致全量测试或构建失败时，先根据任务开始时的 status / diff 判断归属，不擅自修复其他模块。

## 默认禁止修改

除非任务明确要求，否则不要修改：

- `src/game/shanten.ts`
- `src/game/ukeire.ts`
- `src/game/recommendDiscards.ts`
- `src/game/score` 下的番、符、点数规则
- `src/game/ai.ts` 核心出牌策略
- `ruleDescriptions.ts`
- Replay / SavedMatch 数据格式版本

## 验证

普通实现运行 targeted tests、`npm test`、`npm run build` 与 `git diff --check`。纯展示任务可按范围减少测试；3D interaction / animation / shared contract 修改应运行完整测试。

结束前重新检查 `git status`、`git diff --stat` 与 `git diff`。最终简洁报告修改、测试、构建、人工验收与已知阻塞。
