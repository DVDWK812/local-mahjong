---
name: mahjong-ui-qa
description: Perform UI and interaction acceptance testing for the Mahjong application, including screenshots, browser flows, responsive layout, list/search/filter behavior, transient and persisted status transitions, overlays, 3D/table interactions, accessibility basics, console errors, and visual regressions. Use after frontend changes or when the user asks to inspect, verify, accept, compare, or QA a Mahjong UI behavior.
---

# Mahjong UI acceptance

## Objective

Validate observable UI behavior in realistic states instead of inferring correctness from source code alone.

## Required approach

1. Read the change scope and identify all user-visible states affected.
2. Use the project's available browser/E2E tooling when present. Prefer real interaction over static source inspection.
3. Test the primary path plus boundary states relevant to the change.
4. Inspect console/runtime errors during the flow.
5. Capture or compare screenshots when visual layout is part of acceptance.
6. Report PASS/FAIL per criterion with evidence.

## State matrix

Select the relevant states rather than checking only the happy path:

- Initial/loading/empty/populated/error.
- Before action / action in progress / success / failure / retry.
- Search empty query / matching query / no results / clear search.
- Selected/unselected/disabled/hover/focus where applicable.
- Generated/not generated/generating/generation failed for voice/media rows.
- Different game phases such as normal turn, call decision, riichi state, result/dialog overlays where affected.

## Mahjong-specific visual checks

- No duplicate visible rows for the same logical asset/item unless duplicates are intentional and distinguishable.
- Stable ordering and stable identity across search/filter/refresh.
- No status rollback caused by stale data after async completion.
- Tiles, labels, score text, action buttons, hand overlays, dialogs, and table layers do not overlap incorrectly.
- If 3D/hand animation is involved, verify z-order, pointer hit areas, animation completion state, and no blocked controls.
- Audio controls must not create duplicate playback or conflicting simultaneous state indicators.

## Responsive checks

If the app supports multiple viewport classes, check at least one compact and one desktop viewport for changed layout-sensitive UI.

## Acceptance output

Use a compact table or numbered findings containing:

- Criterion.
- PASS/FAIL/NOT VERIFIED.
- Evidence or reproduction steps.
- File/component likely responsible for failures when known.

Do not mark PASS based solely on code inspection when the behavior is browser-visible and browser testing is available.
