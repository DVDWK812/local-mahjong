# AI 语音生成

`generate_voice.py` 从 UTF-8 CSV 生成 Fish Audio MP3。CSV 是唯一标准输入，未知列会被忽略，因此可以安全扩展标准件。

语音资产采用 Voice Pack：`src/music/voice_lines/<pack>/` 内有 `pack.json`、`voice_lines.csv`、缓存和日志，音频固定放在 `audio/`。不带参数时会使用 `xiaozhang` Pack；也可用 `--pack src/music/voice_lines/<pack>` 选择其他 Pack。

`action` 使用英文开发标识，`action_cn` 是仅供编辑时查看的中文名称；生成脚本不会读取 `action_cn`。

`tts_text` 位于 `line` 后：`line` 是游戏显示文本，`tts_text` 是真正发送给 Fish Audio 的文本。默认两者相同；仅在需要修正发音时改 `tts_text`。缺列、NaN、空值或纯空格会自动回退到 `line`，而语音缓存只根据最终 `tts_text` 计算指纹。

安装依赖：`python -m pip install -r requirements.txt`

在 PowerShell 中配置密钥（仅当前终端）：`$env:FISHAUDIO_API_KEY = "你的密钥"`

优先使用环境变量 `FISHAUDIO_API_KEY`。未成功时，再读取 `.secrets/fish_audio_api_keys.txt`：每行一把 key，支持空行和 `#` 注释；遇到 401、403 或 429 会按顺序尝试下一把。密钥从不写入日志，`.secrets/` 已被 Git 忽略。

预览而不请求 API：`python src/audio/generate_voice.py --dry-run --limit 3`

若从旧的根目录 MP3 布局迁入 Voice Pack，先确认 `--dry-run` 全部 unchanged，再运行 `python src/audio/generate_voice.py --pack src/music/voice_lines/xiaozhang --migrate-pack`。该模式只升级缓存、日志和 manifest 的 `audio/` 路径；永远不读取密钥或调用 Fish Audio。

输出包会保存以 `key` 为索引的 `.voice_cache.json`。只有 voiceId、modelId、文本、speed、format 的指纹命中且对应 MP3 存在时才会跳过，不消耗 Fish Audio credit；无缓存记录的已有 MP3 会被视为 `new`，避免仅凭文件存在误判。文本/音色参数改变或文件缺失时，仅对应 key 会请求 API。

`--dry-run` 不调用 API，并会显示 unchanged、changed、new、missing、orphaned 和 API calls 统计；CSV 已删除的 key 只报告为 orphan，不会自动删除其音频或缓存。

文件名只取自 `key`，例如 `action.riichi` 对应 `action_riichi.mp3`。请使用唯一的英文 key；`voice_key_report.json` 会列出非 ASCII key 及改名建议。

生成新角色时，复制不可修改的母版 `src/music/voice_lines/mahjong_voice_lines.csv` 到新目录的 `voice_lines.csv`，修改 `line`（以及需要时 `character`），然后运行：

`python src/audio/generate_voice.py --pack src/music/voice_lines/new_character`

复制标准件后即使未修改 `character` 列，manifest 也会自动使用 Pack 目录名；也可用 `--character` 显式指定。旧式 `--csv <file> --output <pack>` 仍兼容，输出也会采用 `audio/` 子目录。

可复制 `config/fish_audio.example.json` 为本机配置文件，并用 `--config` 指定；不要把 API key 写入 JSON。
