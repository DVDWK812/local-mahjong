# UI-6B.2 BLOCKED

实现及自动验证完成；视觉门禁仍有一项未决：普通牌局从 720p resize 到 1080p 后，首批真实 CDP 帧中出现本家整排牌面空白、人手未显示。保持 1080p 再次弃牌未复现。尚不能确认是捕获/合成瞬态还是产品空帧，不能把这一项判 PASS。没有为掩盖它添加 CSS fade，也没有扩改冻结的纹理预热或 Canvas 架构。

## 1. 视觉参数

- sprite：`clamp(216, tileWidth × 4.8, 296)` CSS px；原值为 `clamp(220, tileWidth × 5.2, 320)`。中间区间缩小约 7.7%，减少本家相邻牌遮盖。
- release：前 65% 保留 carry grip，最后 35% smoothstep 松手；原先前 45% 即完成松手。
- tedashi insert：前 28% reach→touch，28–46% touch→pinch；前 18% 渐入。
- 第二次回手：沿既有 seat entry vector 从 `110 × 0.55` px 偏移接近真实 drawn contact，在 insert 28% 时对齐。
- 不改阶段长度、snapshot、牌轨迹或 scheduler。

## 2. 变化最大的 pose

insert 中的 reach-open / touch-contact：从原先直接在牌旁出现改为短伸入接触。release-open：松手后移。arrange-push 的独立素材、旋转和推牌方向保持。

## 3. 四席最终 transform

| Seat | Rotation | Entry vector |
| --- | --- | --- |
| bottom | 0° | [0.3, 1] |
| right | -90° | [1, -0.3] |
| top | 180° | [-0.3, -1] |
| left | 90° | [-1, 0.3] |

保留这些值，没有证据要求新增 mirror。主进入/退出距离仍为 110 px，旋转附加 reach +4° / retract -4°，进入退出 scale 最大变化 3.5%。

## 4. Local draw alignment

继续读取真实 drawn tile DOM rect，没有固定屏幕锚点。720p/1080p fixture 及普通牌局观察了接触与落定，落定时指尖覆盖 drawn tile，动作后 sprite 清零。既有 tsumo fixture 在摸牌后显示牌墙 invariant 提示，未修改规则；普通牌局另行验证。resize 后首批捕获异常仍待明确，见阻塞项。

## 5. Tsumogiri

两个视口实际观察 reach/grab/carry/settle/retract；原 13 张稳定，无 arrange。新增调参不改变 proxy ownership 或原手牌布局。

## 6. Tedashi + arrange

两个视口、四席实际观察弃牌、落河后 gap、回到 drawn slot、insert/reorder、退手。第二次伸入更明确，推牌姿态与弃牌抓握不同。没有提前闭合 gap。

## 7. Crossfade

保留双 image node、plus-lighter、归一化指尖锚点与 smoothstep。没有新增循环，pointer-events:none、z-index token 和袖口 alpha feather 均保持。固定视口复验未见明显双手、亮度跳变或 ghost。

## 8. Responsive

测试 origin 受 96% 缩放影响，用 1229×691 / 1843×1037 的工具视口得到实际 1280×720 / 1920×1080；普通 localhost origin 为 100%，使用实际指定尺寸。检查时区分了这两种情况。图片输出会缩放；不依靠输出图片尺寸推断 CSS viewport。

## 9. Performance

停止帧捕获后，普通牌局两个实际视口均记录 sprite=0、drawDelta=0、clearDelta=0。Canvas 引用在同一牌局内保持一致，最多一只可见 sprite。未新增 RAF、interval、polling、useFrame。

## 10. Browser QA

| Criterion | Result | State / evidence | Component |
| --- | --- | --- | --- |
| 默认 3D | PASS | 127.0.0.1:5173 / localhost:5173；requested=3d、active=3d，单 Canvas，正常可见场景 | 原 renderer |
| 正常摸牌 | PASS（固定视口） | 720p / 1080p，真实截图与帧流 | Local DOM contact |
| 摸切 | PASS（固定视口） | 两个视口，原 13 张稳定，无 arrange | HandVisualController |
| 手切及理牌 | PASS（固定视口） | 两个视口，gap 后回手推牌 | HandVisualController |
| right/top/left | PASS（固定视口） | 六组视口/席位组合，直接查看抓握、理牌 | 共享 seat transform |
| 连续自动回合 | PASS（固定视口） | 无旧牌局存档的 localhost origin；四席连续动作 | 原 pacing + sprite |
| resize 后无空帧 | NOT VERIFIED | 首批帧出现本家牌面空白；固定 1080p 重放正常，根因未确定 | 待定位，不能认定为 controller |
| 清理与 demand | PASS | 两个视口 sprite/draw/clear 均 0；Canvas 同实例 | 原生命周期 |
| Console | PASS | 普通牌局无 error；已有 Three.Clock 弃用 warning | 环境/依赖提示 |
| Network | 部分验证 | 留存请求中的手部 PNG 为 200，无 loadingFailed；事件缓冲有截断，未保存完整 HAR | 静态 assets |
| Legacy smoke | PASS | ?table3d=0&testMode=1&testAnimations=1；内置场景弃白后进入南家摸牌，Canvas=0、3D layer=0、sprite=0、mask=0 | 原 Legacy |

截图工具不是阻塞原因本身；阻塞是对已看到的异常无法可靠判定。一次连续回合误绑定旧标签页的帧流已剔除，随后使用独立 nc 捕获重新验收。

## 11. Tests / build / diff

- targeted：39 passed（20 hand visual + 18 hand presentation + 1 flash lifecycle）。
- npm test：1590 passed，1 既有 skipped；224 files passed，1 skipped。
- npm run build：通过，保留既有 >500 kB bundle warning。
- git diff --check：通过，仅 LF/CRLF 提示。
- 新增三项测试：松手区间、第二次伸入接触、响应式尺寸边界；未删改旧断言。

## 12. 修改文件

- src/hand/HandVisualController.ts
- src/hand/HandVisualController.test.ts
- artifacts/ui-6b2-test.log
- artifacts/ui-6b2-build.log
- artifacts/ui-6b2-report.md

开始时工作区干净。未修改 PNG、handAssets、projection、CSS、Rules、GameState、Scoring、AI、snapshot、scheduler、Camera、Tile geometry、Appearance、Dora、Hand3D 或 renderer policy。

## 13. NOT VERIFIED

- resize 首批空白帧根因及其是否属于真实显示回归。
- 所有刷新帧的逐帧完整覆盖；帧流是采样。
- 完整 Network HAR（缓冲截断）；跨浏览器/GPU 矩阵。
- 每个 pose 边界的 skip/cancel/speed 组合手动穷举；保留既有清理测试。

停止于本阶段，未将未决视觉项升级为 PASS。
