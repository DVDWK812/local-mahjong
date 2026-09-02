# Mahjong Codex Skills v0

A project-local starter pack for repeatable development and acceptance workflows in the Mahjong application.

## Status and recommended split

- `AGENTS.md`: persistent project invariants, architecture boundaries, canonical commands, safety rules.
- repository `.agents/skills/*/SKILL.md`: canonical installed workflows that Codex can discover.
- this folder's `.codex/skills/*/SKILL.md`: retained v0 audit archive; it is not the installed discovery path.

## Skills

1. `mahjong-dev-task` — implement a scoped change with minimal churn and evidence.
2. `mahjong-bugfix` — reproduce, isolate, fix, and verify a concrete defect.
3. `mahjong-ui-qa` — visual/interactivity acceptance for Mahjong UI states.
4. `mahjong-rule-qa` — deterministic game-rule acceptance and regression testing.
5. `mahjong-ai-qa` — deterministic AI behavior/difficulty/personality validation.
6. `mahjong-asset-qa` — voice/BGM/SFX asset, manifest, duplicate, orphan, and side-effect checks.
7. `mahjong-code-review` — read-only defect-first review of a diff/change.
8. `mahjong-release-gate` — final orchestration gate across relevant skills.

## Installation

The maintained project-local copies live under the repository root at `.agents/skills/`. Codex scans that directory from the current working directory up to the repository root. Do not treat this archive's `.codex/skills/` directory as an executable installation.

The skill descriptions are deliberately trigger-rich so Codex can select them automatically. You can also invoke one explicitly, for example:

```text
$mahjong-ui-qa 验收搜索后的语音列表，重点检查重复项、状态回退和删除行为。
```

## Suggested AGENTS.md use

Use `AGENTS.example.md` as historical source material only. The repository root `AGENTS.md` is authoritative.
