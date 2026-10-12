# GitHub 上传前文件审计与安全清理报告

日期：2026-10-13（Australia/Sydney）。本轮不执行 Commit、Push、暂存、停止追踪、历史改写或 Git 对象清理。

## 结论

**PASS WITH RISKS：当前待提交文件满足 GitHub 单文件限制，测试和构建通过，可由用户在 GitHub Desktop 手动 Commit / Push。** 当前待提交 166 个文件，起始 3620 个；减少 3454 个（3458 个产物被忽略，新增 4 个审计相关文件）。没有删除文件或提交/推送。风险为 2 个既有未推送提交仍包含历史 artifacts，且本地保留证据未远程备份。

## 仓库与起始现场

- 当前 branch：`feature/voice-pack-repository`；HEAD：`12e4fc5ecfa31629496d02475e652c5010272ff2`。
- 当前 worktree：`C:/Users/Wenkai/Desktop/UNSW/local-mahjong-voice-phase1`；另一个 worktree 为 `C:/Users/Wenkai/Desktop/UNSW/local mahjong`，branch `fix/riichi-tile-overlap`，未修改。
- 起始 3620 个逐文件变更：37 个已追踪修改、3583 个未追踪文件；新增已追踪/删除/暂存/重命名均为 0。未暂存变更 3620（含未追踪）。
- 已追踪源码修改和全部未追踪源码/资源均保留。完整起始清单见 [逐文件分类](git-upload-audit-inventory.csv)，包含状态、字节及处理依据。
- upstream：`origin/feature/voice-pack-repository`，领先 2、落后 0。通过 `git ls-remote origin refs/heads/feature/voice-pack-repository` 核实 GitHub 分支仍为 `8a3732e959664c5ca380530de0154e74023254ed`。

## 分类

| 分类 | 起始变更文件数 | 处理 |
|---|---:|---|
| A 必须保留并提交 | 162 | 37 个原有修改及 125 个未追踪源码/正式资源/测试/文档 |
| B 本地保留、不新增上传 | 3458 | 全部是未追踪 artifacts 产物，加入忽略规则；原文件留在磁盘 |
| C 确认可删除 | 0 | 无法证明任何旧产物已不再需要，未执行删除 |
| D 用途不明 | 0 | 已能确定分类用途；未把相同内容误判为可删除证据 |

A 主要目录：`src/game` 69、`src/components` 25、`src/hand` 23、`src/presentation3d` 21、`src/assets` 8、`src/presentation` 4、`src/audio` 3，其余为 App/navigation 与 7 个 docs 文件。保留国标规则及 vendor 代码、`LICENSE.txt`/`NOTICE.md`，正式花牌图片、三种手部资源包和全部新增测试。本审计不代替对原有功能变更的代码审查。

B 主要目录：

| 目录 | 未追踪文件 | 字节 | 用途 |
|---|---:|---:|---|
| `artifacts/gb-feedback/` | 45 | 2007858 | 规则页与语音后续反馈验收证据 |
| `artifacts/gb-v1/` | 127 | 11880243 | 国标开发验收、第三方候选包/来源与资产迁移记录 |
| `artifacts/sanma-ui-tuning/` | 23 | 1773625 | 三麻布局调优证据 |
| `artifacts/xz-baseline-approved-20261003/` | 1289 | 2059055312 | 批准基线、封存源码 ZIP、production/diagnostic、哈希、截图及验收日志 |
| `artifacts/xz-guide-20261005/` | 1974 | 2191370335 | production/diagnostic/production-final、规则页/语音审计及验收证据 |

B 共 4,266,087,373 字节（约 3.97 GiB），全部保留，不是释放空间。

起始 B 文件含 MP3 2175、PNG 805、WAV 170、日志 88、JSON 63、其他脚本/包/截图/补丁等 157。整个 artifacts 目录（包含已追踪及忽略文件）有 3045 个 MP3，逐项 SHA-256 均与 `src/music` 的正式 MP3 相同。这些是构建/源码快照副本；正式资源仍保留。WAV、截图、录制、诊断文件与日志按封存证据保留，未转码或删减。

`artifacts/gb-v1` 的候选 tarball、解包源、WMO PDF/文本属于来源与审计材料；运行时代码已在 `src/game/guobiao/vendor`。正式 vendor 许可文件在 A 类，不依赖 artifacts 提供运行时模块。部分 docs 和 NOTICE 中 artifacts 路径是本地证据引用，fresh clone 不含此次 B 类文件时这些证据链接不可用；必要时另行备份/共享，不能把本地保留当作远程备份。

## 删除与忽略规则

- 精确删除清单为空；磁盘删除 0 文件，释放 0 字节。未清空 artifacts。
- `candidate-source.zip` 不是可随意删除的当前源码重复副本：ZIP 有 1383 项，解压总字节 707,377,739；1360 项与当前文件相同、23 项内容不同、0 项缺失。不同文件代表已批准候选的历史内容，必须保留。
- 基线 report.md 明确要求封存 ZIP、manifest、构建指纹及 production/diagnostic 保持对应关系；没有删除其中任何一项。
- ZIP SHA-256：`32fb7f75042da3801c64f895abd5104bf5691804df0f34731dbc8e14ca89f167`（本轮重新计算，和批准报告一致）。
- `.gitignore` 新增 `/artifacts/` 与 `/.git-upload-audit-local/`。前者防止新生成构建、日志、截图、备份与音频副本进入待提交清单；后者仅隐藏本轮审计原始记录/测试日志。
- 没有全局忽略 *.mp3、*.png、*.zip 或 src 下资源，避免隐藏正式文件。
- `.gitignore` 不影响已追踪文件。既有 3149 个 artifacts 追踪项没有执行 `git rm --cached`，磁盘也没有删除；停止追踪与磁盘删除均未发生。

## 超大文件与历史检查

扫描整个工作目录（包括忽略的 node_modules/dist/缓存，排除 Git 对象库）发现唯一 >50 MiB 文件：

| 路径 | 字节 | MiB | >100 MiB | 结果 |
|---|---:|---:|---|---|
| `artifacts/xz-baseline-approved-20261003/candidate-source.zip` | 651412259 | 621.23 | 是 | 未追踪、未暂存、已忽略、本地保护 |

- 当前 index 全对象扫描：没有 >50 MiB blob，因此也没有 >100 MiB 普通 Git 文件。
- `@{upstream}..HEAD` 两个未推送提交全对象扫描：没有 >50 MiB blob。
- `git rev-list --objects --all` + `git cat-file --batch-check` 找到一个 >50 MiB 对象，即上述 ZIP，OID `dded3cb5ff9243fc7e6bf1ac908407de4f15b504`。
- 该对象不在当前 HEAD 可达历史；位于 Codex 本地检查点 `refs/codex/turn-diffs/checkpoints/cc030318c8d2ebd077720c3d95f829f2/54567ac8f36c278ed797ea39a44d8257/1791025707075/3183fb42-f4d6-47b3-a2a5-c6bc56f66881` 可达对象集合。不是当前分支的普通推送内容。没有删除检查点或对象，也无需因此改写当前分支历史。不要使用镜像推送来上传本地内部引用。
- 尚未推送提交：`5620bbb`、`12e4fc5`；相对 upstream 的净变化 3402 文件。当前分支历史已包含大量旧 artifacts，即使新增忽略规则，它们仍随普通分支推送。没有单文件限制阻断，但此次操作未精简这些历史产物。

## 资源依赖与验证

- 检查 src、scripts、vite.config.ts、package.json 对 artifacts 的引用：运行时资源来自正式 src 目录；artifacts 用于测试输出、快照脚本、构建指纹测试和文档证据。
- 所有 A/B 原文件均保留；无 Rules/AI/GameState/音频二进制变更。
- 不需要新增浏览器视觉验收：本轮只改忽略规则和审计文档，不改变界面、资源引用或游戏行为。人工视觉/听感 NOT_RUN。
- `npm test`：退出码 0；271 文件通过、1 文件既有跳过；2451 测试通过、1 既有跳过；105.97 秒。pretest 的 voice-pack 索引生成与完整性验证也通过。
- `npm run build`：退出码 0；TypeScript 编译及 Vite 生产构建通过，6.22 秒；保留既有大 chunk 警告。
- `git diff --check`：退出码 0；只有既有 LF/CRLF 提示，没有空白错误。
- 测试过程中追踪的 long-run-results.json 曾暂时变化，测试全部完成后自行回到起始内容，最终 artifacts 无 dirty；没有执行证据恢复或覆盖。
- 清理后 166 个逐文件变更：38 个已追踪修改（原有 37 + .gitignore）、128 个未追踪（原有 A 类 125 + 报告/CSV/提交清单）；暂存/删除/重命名均为 0。
- 原始 A 类最大文件 2,482,764 字节；最终待提交列表无 >50 MiB 或 >100 MiB 文件。3458 个 B 类文件存在性已逐项确认。

## 人工 Commit / Push 清单

提交原始 A 类 162 文件，加 `.gitignore`、本报告、逐文件 CSV；最终准确逐文件待提交清单将生成在 `docs/git-upload-submit-list.txt`。不选择被忽略的 B 文件，不强制添加 ZIP。

仍需人工决定：是否接受历史 2 个未推送提交中已包含的旧 artifacts；本轮不擅自停止追踪或重写这两条提交。对源码的原有功能改动按用户原计划审阅。已批准基线及本地证据需要另做可靠备份，GitHub 此次不提供这些 B 文件的备份。

原始审计记录、本轮测试和构建日志位于 `.git-upload-audit-local/`，该目录只留本地。
