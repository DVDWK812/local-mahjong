# 共享 UI 验证收尾报告

日期：2026-09-27。范围：本轮用户要求的补验；未扩展规则、未重构、未新增功能。

## 结论

本轮浏览器补验完成，未确认需要修复的共享样式回退，因此 **源码修改 0**。原有 dirty / untracked 工作均保留。整体 Gate 仍为 **FAIL**：中央坐标批准基线尚未解决，精确断言仍期望 2.3、生产值仍为 1.9。人工视觉与非静音听感均 **NOT_RUN**，不声明整体验收通过。

## 源码与构建对应

- HEAD：5620bbbb4f73fa1001d663f49c98ad88e75b58e8，含此前未提交修改和新文件。
- 检查 1290 个源码/配置文件，开始至结束哈希漂移为 0；与上一轮受测源码记录一致。详见 start-source.json、end-source.json、version-manifest.json。
- 源码聚合 SHA-256：e10aadde53c3c9e6a81ffe691b8ed7cd17139ff2da5952d7660bfbdac4456862（按路径排序后以 `路径 空格 哈希` 换行聚合）。
- Node v24.18.0 / npm 11.16.0。
- 本轮为正常生产构建，没有新建诊断构建。输出 production/，完整文件哈希在 version-manifest.json。
- 页面实际加载 `/assets/index-D9GJPRQV.js`，3D chunk 为 Table3DScene-DN-12qI6.js，和本轮输出对应；runtime-final.json 留证。预览端口 53027。

## 核查与最小处理

| 项目 | 真实检查 | 结论 / 处理 |
|---|---|---|
| 和/鸣/切 | 普通四人立直与普通血战，720p，下三项全关闭及全开启状态，比较 computed style | 两组逐项相同；未改 CSS，未恢复宽泛覆盖 |
| 头像昵称 | 经正式玩家设置配置柴犬/边牧/黑猫/柯基及血战复核员/右席复核/上席复核/左席复核 | 四张图片 complete 且 naturalWidth=1254，牌桌真实显示 |
| 保存、保存退出、恢复 | 新 origin 的恢复入口先返回“没有血战存档”；普通血战选择三张牌、暂停、保存、导出、保存退出、恢复、再次暂停导出 | 阶段、动作序列6、手牌实例和选中态、积分及导出解析内容一致 |
| 暂停恢复 | 暂停时手牌禁用；恢复后提交换牌 | 进入定缺阶段0/4；本次使用不限时控制节奏，未宣称复测有限预算倒计时 |
| 声音入口 | 普通对局点击声音，实际打开音频设置弹窗 | audio-entry-dom.txt；自动浏览器始终 mute=1，听感留真人 |
| 17 步真实牌桌 | 正常设置→选13张固定手牌→确认→在弃牌候选池弃七筒→AI响应 | 本家17→16步，对手响应后也16步；1 Canvas、两家50000、真实玩家卡与共享顶部栏和中央显示正常 |
| 720p/1080p | 血战、17步实物截图；720p检查中央100分、阶段提示、顶部头像 | 文字符号可读，未见需修复的实际挤压；不改冻结锚点、牌桌、相机或中央基准 |

720p 的投影包围盒存在局部边界相交，不能把这些矩形解释为字形遮挡；本轮以最终实图检查可读性，未据此擅自移动中央板或头像。使用 xz-native-720.png；早期 xz-normal-720.png 为浏览器裁切捕获异常，保留但不作为通过证据。

## 下载实物及对应回读

真实页面导出落在 Windows Downloads：血战回放 (1).json、血战回放 (2).json，分别复制到本目录 xz-before-exit.json / xz-after-restore.json，每份6953字节。工具 download-event 等待曾超时，实际文件已落盘；验收依据是实际文件字节读取与 JSON 解析。

- before SHA-256：a9723b892311d64051bb498d203320b0eb91c290b3ec54c080f7841d09276bc6
- after SHA-256：f5a73f6bc0c256b0c968b904520fda051f9c1bf1782c08cd7f8c12e33f4409fa
- 两文件 JSON 对象完全相等，原始字节不同，仅对象字段顺序变化。没有把解析相等写成字节相等。
- seed=3808798149，digest=e374b104a29de5a8，actions=6。save-comparison.json 记录比较。
- before-exit-dom.json / after-restore-dom.json 保存真实恢复前后页面投影。
- 53027 独立 origin 与原5173存储隔离，本轮开始该 origin 无血战存档；未清除或覆盖用户原 origin 存档。

## 命令与结果

```powershell
npm run build -- --outDir artifacts/xz-ui-verification/production
npx vitest run src/components/XuezhanHud.test.tsx src/game/xuezhan/presentation.test.ts src/presentation3d/Table3DHudAvatar.test.tsx src/presentation3d/table/centralConsoleLayout.test.ts
git diff --check
npm run preview -- --host 127.0.0.1 --port 53027 --strictPort --outDir artifacts/xz-ui-verification/production
```

- build：PASS，包含 TypeScript 检查；Vite 6.27秒，既有大 chunk 警告。production-build.log。
- 定向测试：7 PASS / 1 FAIL；4文件中3通过1失败。失败为 centralConsoleLayout.test.ts:26 的2.3/1.9差异。targeted-with-baseline.log。包装命令最后打印日志，其 shell exit=0 不代表 Vitest 通过。
- diff --check：无空白错误；Git提示既有文件 LF/CRLF转换警告。diff-check.log。
- 本轮未重新启动全量规则/1000种子验收。此前相同源码全项目记录 2248 PASS / 1 FAIL / 1既有SKIP，保留在 ../xz-shared-ui/ 的原日志及报告，不覆盖、不挑选重跑结果。
- Console：0 error，4条 THREE.Clock 弃用 warning；console-final.json。
- Network：可保留窗口内91个响应，状态仅200/206，其中19个audio MIME响应；5个 canceled Media ERR_ABORTED。无HTTP失败响应。事件缓冲已截断，不能声称覆盖此次全部历史请求；network-final.json 原样保留。
- 浏览器真实17步页面 Canvas=1、无水平溢出。截图精确尺寸由图片文件检查，浏览器 innerHeight 可能有1px舍入差异。

## 证据与人工入口

截图：xz-native-720.png（1280×720）、xz-normal-1080.png（1920×1080）、four-normal-720.png、seventeen-720.png、seventeen-1080.png。真实17步操作前后 DOM 在 seventeen-before-discard.txt / seventeen-after-discard.txt。

入口：http://127.0.0.1:53027/?mute=1 。当前生产预览已运行并保留真实17步牌桌。若服务停止，执行上面的 preview 命令；不要重新构建替换该固定输出后继续沿用本报告版本。

人工步骤：
1. 普通血战：主菜单→本地模式→血战到底→恢复存档（仅53027隔离存档）；检查昵称头像、暂停/继续、声音、保存与保存退出；可恢复当前定缺阶段。
2. 普通四人立直：本地模式→立直→四人，在相同和/鸣/切状态对照样式。
3. 17步：本地模式→立直→17步→开始→选满13张并确认→候选池出一张牌；检查17变16、对手响应、顶部栏/玩家卡/中央显示。
4. 分别1280×720和1920×1080人工检查中央积分、阶段提示与顶部头像空间。
5. 真人另用非静音页面检查听感；本报告没有填写人工通过。

本轮新增内容均为本目录证据/报告/生产输出，未提交、推送或发布。未解决项只有既有整体基线阻断及待真人复核，不将本次定向补验扩大解释成全模式规则验收。
