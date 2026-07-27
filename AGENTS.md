# 项目说明

这是一个 React + TypeScript + Vite 的本地立直麻将项目。

## 通用要求

- 所有界面文字使用简体中文。
- 优先复用现有组件、类型和工具函数。
- 保持现有接口与旧数据兼容。
- 只处理当前任务涉及的内容。
- 禁止进行无关重构。
- 不删除、跳过或弱化已有测试。
- 最终回复不超过10行，只说明修改文件、完成内容、测试和构建结果。

## 默认禁止修改

除非任务明确要求，否则不要修改：

- src/game/shanten.ts
- src/game/ukeire.ts
- src/game/recommendDiscards.ts
- src/game/score 下的番、符、点数规则
- src/game/ai.ts 的核心出牌策略
- ruleDescriptions.ts
- Replay / SavedMatch 数据格式版本

## 工作方式

- 开始任务时先读取本文件。
- 只读取和修改任务明确涉及的文件。
- 不扫描 node_modules、dist、.npm-cache。
- CSS或纯展示任务只运行相关测试和 npm run build。
- 游戏规则、计分或状态推进修改后运行完整 npm test 和 npm run build。
- 不重复读取已经确认过的无关文件。
- 不生成长篇计划、逐步过程或项目总结。
