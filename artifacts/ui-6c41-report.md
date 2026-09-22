# UI-6C.4.1 PASS

仅改3个文件：WinPresentationController.ts、其测试、FinalGate scenarios.ts。TSUMO_REVEAL_HOLD_MS=2000 替换原680ms hold，复用现有 finite scheduler/pacing。Ron 2000ms、slap-only轨迹、impact cue、Rules/GameState/Scoring均未改。AV-15说明已更新。

验证：targeted 77 PASS；npm test 1775 PASS + 1 existing SKIP；build PASS；git diff --check exit0。新增正常hold、skip、cancel pacing及rong once回归。首轮build因新测试Array.at不兼容失败，已改等价数组索引；最终targeted和build重新通过，原失败日志保留。

| 浏览器项 | 结果 | 证据 |
|---|---|---|
| 1280×720 | PASS | hold39031.8 → cleanup41036.5，2004.7ms；Result41161.4 |
| 1920×1080 | PASS | hold60023.6 → cleanup62035.9，2012.3ms；Result62155.5 |
| 单牌最终画面 | PASS | 撤手后牌保持可见，hold后才显示Result；两尺寸截图已保存 |
| 音效 | PASS | 每次win-impact→rong一次，媒体正常开始/结束；backend mute=1 |
| Reduced motion | PASS | 临时QA开关开启后动作/hold/结果可完成，无死锁 |
| Renderer | PASS | Canvas=1、requested/active=3d、fallback=none |
| Console/Network | PASS | 无相关error或失败请求 |
| 退出 | PASS | Canvas/sprite/proxy均0 |

浏览器URL：/?testMode=1&uiFinalGate=1&qaAudio=1&mute=1。浏览器截图仍有既有宿主viewport合成灰边，未改产品CSS/DPR；DOM实测尺寸如表。机器验证时间和顺序，不替代人耳听感；AV-15动作已由用户人工认可。探针已随测试页关闭清除，viewport已reset。

启动与结束status/stat、浏览器JSON及测试日志位于artifacts/ui-6c41-*。保留全部既有dirty/untracked。没有commit/push、Notion或其它功能改动。
