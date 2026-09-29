# 血战到底共享 UI 修正报告

日期：2026-09-27。范围仅为最新 UI 指令；没有修改血战 engine、scoring、AI、存档/回放格式、相机或牌桌世界坐标。未提交、推送或发布。

## 修改与根因

1. **手牌**：原 `.xz-game button` 给正式 Tile 按钮额外添加 padding、边框及背景，另外又覆盖手牌 row、disabled 与合法牌光效。移除这些血战专属覆盖及已废弃手牌 CSS，继续直接使用 `TileFaceDomAppearance → LocalHandArea → Tile`。保留原有权威交互回调、摸牌 gap、动画捕获与牌面设置。
2. **顶部按钮**：从已有 GameTopBar 提取共享 `GameTopBarFrame` 外壳；立直保留原 DOM 类名和动作，血战将原保存、退出、暂停、声音和账本回调放入同一外壳。未创建第二套按钮样式。
3. **头像卡**：删除血战重复的 ResizeObserver、头像解析和尺寸计算代码，改为消费 `Table3DHudView → Table3DPlayerFrame`。共享 View 新增可选状态内容、seat anchor 水平居中开关，其他模式默认行为不变。仅血战顶部启用居中；血战 DOM 顶部座位留出公开手牌区域。没有修改 `tablePresentationTuning`。
4. **中央板**：消费现有 Scene 的 `centralHud` 插槽、`Table3DCentralHudView`、`TableCenterView` 及冻结的中央 anchor。显示模式、局数、余牌、活跃人数、庄家标记、四家积分、权威胡牌顺位、换牌/定缺进度和结束状态。无新规则状态，也不调用立直计分。三响按权威结果显示三家并列第 1 胡，积分 97/101/101/101。结束时单行提示查看账本，具体花猪/查叫/退税仍由既有账本提供；没有在中央板内增加结算分页。
5. **小屏布局**：将血战阶段提示与操作按钮分开，中央结束提示压成单行，避免压住积分。所有新增布局选择器均在 `.xz-game` 或 `.xz-center` 下。

## 本次实际修改文件

- src/components/XuezhanScreen.tsx
- src/components/XuezhanHud.tsx
- src/components/xuezhan.css
- src/components/game/GameTopBar.tsx
- src/components/game/TableCenter.tsx
- src/presentation3d/Table3DHud.tsx
- src/presentation/table/xuezhanPresentation.ts
- src/components/XuezhanHud.test.tsx（新增）

素材全部复用，未生成/替换声音、头像、牌面或模型。工作区原有共享 View/三麻等并行改动已保留。`before/` 保存本次修改前文件；`task-only.patch` 是相对此次开始状态的专属差异，而非将全部 dirty work 归为本次修改。

## 自动验证

环境：Node v24.18.0；npm 11.16.0；Vitest 2.1.9。HEAD `5620bbbb4f73fa1001d663f49c98ad88e75b58e8`，工作区存在未提交及 untracked 内容。`start-status.txt`、`start-diff-stat.txt`、`end-status.txt`、`end-diff-stat.txt` 记录边界。

| 命令 | 结果 | 日志 |
|---|---|---|
| npm run check:types | 通过 | 首次工具输出；生产构建也完整执行 tsc |
| npx vitest run src/components/XuezhanHud.test.tsx src/game/xuezhan/presentation.test.ts src/presentation3d/Table3DHudAvatar.test.tsx | 3 文件、5 测试通过 | targeted-final.log |
| npm test（布局修正前） | 2248 通过、1 失败、1 原有跳过 | full-test.log |
| npm test（最终稳定版本） | 2248 通过、1 失败、1 原有跳过；95.74s | full-test-final.log |
| npm run build | 通过；Vite 仅有已有大 chunk 提示 | build.log |
| git diff --check | 退出码 0；只有 Git CRLF 提示 | diff-check-final.log |

初次沙箱测试未启动，原因是 esbuild 子进程 spawn EPERM；授权后正常执行。首次新增三响 UI 测试误把同时胡牌期望写成 1/2/3 顺位，实际权威状态为并列 1；改为验证三家第 1 胡及固定金样分数 97/101/101/101，未改引擎或弱化已有断言。随后发现结算双行挤压，修复后重跑最终定向和全项目测试；所有失败日志保留。

最终全量包括血战1000固定种子小局及3099个合法字段配对，均通过。

全量回归中的唯一失败为既有 `centralConsoleLayout.test.ts:26`：expected Z=2.3，生产 Z=1.9。本任务不修改冻结生产坐标，也没有批准依据去同步该断言。因此**总体 Gate 仍为 FAIL，不能标记为自动复核全部通过**。本次没有新增 skip。

`final-files.json` 记录 8 个任务文件及 dist/index.html 的 SHA-256；`tested-source-start.json` 记录 1290 个源文件/配置的哈希，`source-drift.json` 记录最终运行期间漂移。浏览器测试使用当前工作区 Vite dev 页面，生产构建单独验证，不把开发页面描述为固定生产预览。

## 内置浏览器证据

URL：`http://127.0.0.1:5173/?mute=1`。使用 Codex 内置浏览器和现有隔离测试 Tab，没有填写人工通过。宿主缩放为 0.96；以 CDP `cssLayoutViewport` 核实 1280×720 和 1920×1080（见 viewport JSON）；截图物理尺寸因此不同。早期捕获出现宿主缩放裁切，仅下列 final 图片用于血战验收，未调整相机来迎合截图。

| 检查项 | 结果 | 证据 |
|---|---|---|
| 双分辨率中央板、四头像、手牌和控件 | PASS | xz-720-final.png、xz-1080-final.png |
| 顶部头像水平居中 | PASS | 720p DOM 中心约 x=640.42，位于顶部座位中心，下方保留中央板 |
| 正式手牌样式复用 | PASS | riichi-dom.json / xz-dom.json：720p 牌宽约43.54、高61.18、row gap=2px、padding=0、border=0，使用同一 tiles 资源目录 |
| 真实指针 hover / 点击选中 | PASS | 通过 DOM 命中位置发送鼠标输入，四万 :hover=true，点击后 aria-pressed=true |
| 选择三张、换牌提交与禁用 | PASS | 三张九万选中，提交按钮启用；提交后 1/4 且手牌 disabled |
| 三响后分数与结果折叠、账本开关 | PASS | xz-720-triple-final.png；97/101/101/101，账本三笔，各 1 分 |
| WebGL | PASS | 1 Canvas，requested/active=3d，fallback=none |
| Console / Network | PASS | 无 error；完整最终观察77条事件，响应仅200/206；1条导航/媒体切换导致的 canceled Media ERR_ABORTED，无失败资源响应。见 browser-network-final.json |
| 四人立直共享组件 | PASS（冒烟） | 隔离暗杠场景；原工具栏、手牌、中央分数及本场仍显示；riichi-dom.json |
| 三人立直共享组件 | PASS（冒烟） | 1 Canvas、3 张玩家卡、三家35000、东1局0本场余54；规则按钮打开原抽屉 |
| 17 步 | PASS（设置入口）；完整视觉未复验 | 设置页面正常；完整测试中包含17步回归。本次没有启动普通17步对局或覆盖存档 |
| Legacy 兼容 | PASS（独立冒烟） | /?table3d=0&mute=1 的隔离暗杠场景执行动作；Canvas=0，3D layer=0，legacy-smoke.json |
| 真人审美/听感/普通存档按钮端到端 | NOT RUN | 不代替真人；测试场景不显示普通保存/声音按钮，回调保持原实现 |

## 人工复核

启动：在项目目录执行 `npm run dev -- --host 127.0.0.1`，按终端显示端口打开 `/?mute=1`。当前已有5173开发服务，未重复启动。

1. 主菜单 → 测试模式 → 血战到底 → 定缺换三张完整比赛 → 加载真实场景。
2. 分别以1280×720、1920×1080检查四家卡片、顶部居中、中央字段；悬停/点击手牌，选择三张九万并提交，确认已提交1/4及禁用。
3. 返回血战用例 → 一炮三响 → 加载真实场景 → 逐步执行3次，展开/收起结果，再开关规则与账本；核对三家并列第1胡及97/101/101/101。
4. 普通血战对局人工确认保存、暂停、声音入口；听感请真人使用非静音页面单独检查。

人工状态仍为 NOT_RUN。剩余阻断：中央布局历史基线差异。未声称整套血战或所有模式已完成人工验收。
