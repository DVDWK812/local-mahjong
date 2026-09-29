# SANMA-4 共享正式 UI 接入修正

2026-09-24。本次基线来自当前工作区，不是 HEAD 干净树；开始前 tracked patch/status 已保存在 baseline。此前独立页面的视觉证据失效。规则、计分、MatchRuntime 与 AI 不重写。

原四人：App → Board → GameScreen → TableRenderer → Table3DScene。
原三人：App/SanmaTestTab → SanmaScreen → ParticipantTable(preset=sanma) → ParticipantScene。后者是参与者预览，独立 CSS、HUD、操作与结果，因此并没有进入四人正式 UI。

|区域|四人实际来源|旧三人来源|原来共用|本次实际接入|
|---|---|---|---|---|
|页面外壳|components/game/GameScreen.tsx|components/SanmaScreen.tsx、sanma.css|否|双方调用 FormalGameScreen，实际组合顶栏、场景、LocalHandArea、prompt、结果等|
|场景宿主与生命周期|presentation3d/TableRenderer.tsx、Table3DScene.tsx|participants/ParticipantTable、ParticipantScene|仅底层 Canvas|双方调用 FormalTable3D → 同一 Table3DScene → SceneCanvasHost；四人 fallback 外层保留|
|相机、桌面、环境、光照材质|FixedTableCamera、TableMesh、TableEnvironment、TableLighting、AppearanceResources3D|ParticipantScene|部分底层资源|同一正式 Table3DScene；未调整这些基线参数|
|布局、响应式|sceneTransforms、tablePresentationTuning、Table3DHud|participantLayout、sanma.css|否|三席映射到正式 bottom/right/left；正式 responsive avatar resolver|
|中央 HUD|Table3DCentralHud、TableCenter|sanma-center + participant cards|否|双方调用 Table3DCentralHudView、TableCenterView|
|头像昵称点数座风|Table3DHud、PlayerAvatar、slot appearance|ParticipantTable 信息卡|仅头像资源|Table3DHudView 真实三玩家，Profile 与 appearanceSlot 保留|
|本家 DOM 手牌|LocalHandArea、DiscardSourceSnapshotStore|LocalHandArea + 独立动画|部分|FormalGameScreen 唯一 LocalHandArea，完整选择/hover/drawn/source snapshot，统一动画回调|
|对手暗手|Hand3D|ParticipantScene 简化区域|部分|正式 Hand3D；没有 top 数据和节点；暗牌无 identity|
|牌河、副露、棒与宝牌|River3D、Meld3D、RiichiSticks3D、DoraIndicatorStack|ParticipantScene、SanmaPublicTiles、自绘宝牌|否|同一正式组件；三人 adapter 负责真实来源方向与宝牌身份|
|按钮、和鸣切与计时|ActionPrompt、OperationButton、MatchClockHud|sanma-actions + MatchClockHud|仅 clock|同一 ActionPrompt/OperationButton/MatchClockHud；north 能力扩展，无 chi|
|动画与 pacing|useTableAnimation3D、HandAction3D、WinPresentationOverlay|useSanmaAnimation、SanmaMotion3D|仅调度底层|同一正式 consumer/target/proxy；north_committed 真语义，独立北区 mask；不发假杠|
|顶栏、声音、退出、规则账本|GameTopBar、AnalysisDrawer|sanma-topbar、sanma-details|否|GameTopBarView、AnalysisDrawerView；三人 ledger 内容插槽|
|小局结果|ResultDialog|sanma-result|否|共用 ResultShell、ResultDeltas、WinnerResultCards；只投影权威三人得点和 bonus|
|终局、回放|MatchResultDialog、ReplayControls|自绘 rank/replay nav|否|共用 MatchRankingCards、ReplayBottomBar → ReplayControls；三人回放仍用 replaySanma|

必要的三人职责：三人权威 controller/command、readonly adapter、三人宝牌 identities、三席映射、结果投影、拔北 north lane/事件。原 SanmaScreen 独立页面 JSX/CSS 已退出；participants 中旧 SanmaMotion/PublicTiles 仅预览实现仍隔离留存，正式及测试 SanmaScreen 无引用，其他模式不删除。

顶部公共宝牌没有因 top player 缺席而删除。场景 wall/reserve 只读数据保留，但同四人正式路径不渲染实体牌墙。共有相机/HUD/桌体基线未改；1.9/2.3 既有严格测试单列。

证据级别：此表是源码接线证据，不替代浏览器视觉或用户 Gate。
