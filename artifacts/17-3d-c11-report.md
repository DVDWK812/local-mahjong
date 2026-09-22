# 17-3D.C.1.1 Cold First-Action Jank Gate

结论：**17-3D.C.1.1 BLOCKED**；**17-3D.C BLOCKED**。

本轮完成可重复的双分辨率冷页面采样，但没有复现历史约83ms帧间隔，不能给它分配精确根因或宣称已修复。1080p完整动态视觉仍需本机人工确认。没有产品修复，没有提前预热，没有调整740ms计划、布局、pacing、四人路径或Scene Ready。

## 环境与方法

- Codex内置浏览器，同一现有 `initial` fixture、`seventeenPacks=split`（female/male）、显式 `table3d=1`。隔离开发fixture，不改存档/设置。
- `window.innerWidth/innerHeight` 实测1280×720、1920×1080；工具请求分别1229×691、1843×1037。每个分辨率5次页面reload，每轮连续点击3张六万，各有一次对手自动弃牌；总共30次本家+30次对手动作。
- 这是页面/JS session冷加载；浏览器进程、HTTP缓存、GPU驱动/program磁盘缓存未清除。因此不能称为浏览器进程或GPU全冷测试。
- 计时轮次没有截图、帧流或CPU profiler。临时opt-in探针收集现有scheduler/visual trace、Long Tasks、Image.decode、WebGL shader/link/texture/buffer/draw调用、controller创建/update、DOM测量、prepare与ready。
- 表中帧间隔是现有scheduler回调的performance.now间隔，不是GPU执行耗时或显示器实际present间隔。不能拿它替代肉眼动态验收。
- 探针没有console逐帧输出、新增RAF或timer。测量后撤下，三个暂时触及文件恢复为启动时逐字节哈希：candidateTrace.ts、CandidateDiscard3D.tsx、ParticipantTable.tsx。全src哈希差异=0。

## 五轮分布（ms）

| CSS viewport | 轮次 | Scene Ready/原子揭开，自navigation | 本家首次最大间隔 | 第二次 | 第三次 | 首次prepare |
|---|---:|---:|---:|---:|---:|---:|
|1280×720|1|979.0|14.8|9.3|9.4|20.3|
|1280×720|2|952.7|14.2|9.9|9.7|19.7|
|1280×720|3|902.7|15.1|10.2|9.2|20.9|
|1280×720|4|949.5|15.0|9.8|9.1|20.9|
|1280×720|5|926.4|13.8|10.7|11.1|19.3|
|1920×1080|1|934.6|14.3|10.1|10.1|21.5|
|1920×1080|2|1150.3|18.1|10.4|11.0|28.0|
|1920×1080|3|1088.2|15.5|12.8|8.8|20.7|
|1920×1080|4|1053.8|17.4|13.7|10.1|23.6|
|1920×1080|5|1048.6|15.6|9.7|9.3|22.7|

第二、三次prepare为4.6–6.8ms。每轮首次动作有2次program link，后续没有。首次仍有可测的首用差异，但本次没有独立约83ms尖峰。没有实施优化，因此没有虚构“修改后”对照或Scene Ready改善数字。数据另见 `17-3d-c11-measurements.json`。

## 精确时间线示例：720p第1轮

以下均为该页面performance.now绝对毫秒：

- 当前effective Pack preload结束809.3；Loading揭开979.0。
- click1051.2；confirmed1051.5；snapshot1051.6。
- prepare1059.0→1079.3。
- HandVisualController创建/CandidateDiscard3D layout mount1071.4；首次手部DOM update和invalidate1071.6。DEV StrictMode还执行一次effect重建，不能误写成两个同时存在的consumer。
- prepare期间createTexture1071.8、1072.0；创建调用本身不足0.1ms。此处没有逐材质身份归属探针，不能说两个texture必然都是代理私有资源。
- approach1079.3→1233.9；grasp1233.9→1331.0；travel1331.1→1574.0。
- 首次program link1242.1、1246.3（grasp第一段，单次调用0–0.1ms）；该处最大scheduler间隔14.8ms。
- settle/release1574.1→1673.5；static river接管/retreat1673.6；retreat结束1845.6；cleanup1845.7。
- source rect: left580.41998、top600.73346、width37.12565、height52.15658 CSS px；首次手部contact(598.98281,626.81175)。这些是运行诊断坐标，不是写入布局的常量。
- 首个手部DOM update不等于首个实际屏幕paint。没有把节点创建时间冒充sprite首个可见帧。

## 根因排查结果

1. **历史83ms的精确区间仍未知。** 本轮未复现；此前报告只有最大帧数值，未提供可关联的83ms调用栈。本轮不能把它写成shader、decode、GC或环境噪声的已确认根因。
2. **图片decode**：10轮第一次click之后新增decode调用均为0；effective Pack在ready之前结束。没有证据支持修改Hand Pack preload。
3. **GPU首用**：首次grasp创建两个program，暖动作不创建；这是真实首用差异。观测到的同步API耗时不足以解释83ms，也未取得GPU定时query。没有贸然引入compile/warmup。
4. **模块**：ParticipantScene在桌面加载时lazy，CandidateDiscard3D为该scene的静态import；没有首次点击才lazy import该consumer的代码分支。
5. **DOM**：首次plan测量最大0.8–1.2ms，手部update最大0.3–0.6ms，未出现83ms forced layout。现有plan仍可能因依赖引用变化重新计算；本轮不为小成本做无依据重构。
6. **一次52ms long task**：1080p第2轮1230.8→1282.8；click1231.1、prepare1240.8→1268.8、approach start1268.9。它跨越click/prepare/首段更新，发生在grasp shader link之前。尚未取得可靠CPU细分归属；不能与历史83ms混为一谈。
7. React commit准确耗时、单独proxy Tile3D mount/cache lookup、具体material首次创建归属、GC分配调用栈没有完整采集，仍标NOT VERIFIED。没有用推测补齐。

## 视觉、运行与清理

- 两个实际CSS viewport均成功进入requested=3d、active=3d、fallback=none、Canvas=1。
- 本轮每分辨率5轮各3次本家合法点击与对家推进完成，候选数减少；固定13张展示保留。720p此前直接动态观察通过的用户前置仍成立，本轮计时记录不冒充新增全程肉眼PASS。
- 1080p一次截图仍有重复/灰区；一次有限screencast可见桌面和落河附近手部，但捕获裁掉底部候选源及右侧，不能验证完整source接触/gap/携带/补位链。已停止重试，没有改Camera/CSS/DPR来迁就捕获。
- 1080p人工待验：上排、下排、对手一次、同session resize后再弃一张，确认接触→source gap→同步携带→settle→静态接管→补位→retract。完整动态Gate未关闭。
- 停止capture后17,167.9ms静止窗口：sprite=0，drawDelta=0，clearDelta=0，Canvas=1。稳定proxy数量未单独遍历场景直接计数，不能伪造该项PASS。
- 返回菜单后Canvas=0、Loading=0、sprite=0；整个3D subtree卸载。浏览器Console error列表为空。测试页关闭、临时viewport override清除。
- 本轮没有重新浏览器验收ron/末步流局、reduced-motion、12→11、下一局和cancel中途链；由已有targeted/full自动回归覆盖，不能代替手工项目。

## 验证与工作区

- Targeted：47 PASS（4 files）。
- npm test：1659 PASS、1既有SKIP（231 passed files、1 skipped）。本轮重跑。
- npm run build：PASS；现有大chunk提示保留。本轮重跑。
- git diff --check：PASS（Git提示既有LF/CRLF转换，不是whitespace error）。
- 没有最终产品代码/测试修改，没有新增“83ms阈值”脆弱测试。临时改动已按启动SHA256精确恢复。既有48个tracked dirty与untracked内容保留。
- 本轮仅新增artifacts/17-3d-c11-*启动清单、测量JSON、本报告与验证日志；未提交。

## NOT VERIFIED / 阻塞

历史83ms精确根因与其消除；进程/GPU真正冷启动；52ms任务CPU细分；GPU真实耗时与React commit细分；1080p完整动态人工Gate；本轮未重做的人工回归项目。

现有测量不支持按猜测加入GPU预热。进一步定位需要在83ms实际复现时取得同一次动作的CPU/渲染追踪；当前仅完成页面冷加载分布，不能宣称修复完成。

**17-3D.C.1.1 BLOCKED**

**17-3D.C BLOCKED**

未进入17-3D.D、UI-6C，未同步Notion。
