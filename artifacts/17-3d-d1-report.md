# 17-3D.D.1 — Full River Readability / Final Re-Gate

## Status

**17-3D.D BLOCKED — exact-viewport / dynamic visual confirmation pending.** Product obstruction has been repaired in the available real WebGL view. Do not declare migration COMPLETE/FROZEN until the remaining manual visual check is confirmed.

## Root cause and minimal repair

At 1281×720 CSS px, the pre-fix bottom river projected under the duel HUD in row 1 (indexes 0–5), under the bottom avatar in row 2 (indexes 6–7), and under the avatar in row 3 (indexes 12–13). The top river did not overlap these cards. A third-row-only scale could not fix a first-row HUD overlap. See `17-3d-d1-geometry.md` for rects and observed image evidence.

The 17-step duel now uses `participantRiverTarget` as the single mode-specific resolver. Counts 1–12 and canvas heights above 800 CSS px return the exact shared four-player transform. At count 13–17 in a short canvas, it applies 0.90 river tile scale, a 0.55-world-unit participant-relative radial clearance, and a 2.7-world-unit inline clearance for rows 2–3. Bottom/top mirror; four-player `getRiverTileTransforms`, Camera, avatar/HUD anchors and table geometry are unchanged. The first tile moves slightly in compact mode because a fixed-center scale left it under the HUD; the original baseline is retained for 1–12 and 1080p.

The `CandidateDiscard3D` proxy and static `ParticipantRiver` both call this resolver for the final tile target. On 12→13, the old twelve tiles hold their previous targets through settle/release and interpolate toward compact targets during the existing retreat frames. No scheduler, timing, clock, rule or state contract changed. A follow-up 720p static visual inspection found the existing candidate header also obscured the last bottom tiles. A short 17-step-only max-height CSS rule moves the header to the right of the fixed candidate grid; the grid rect and Canvas rect do not move.

## Browser evidence

- Measured diagnostic CSS viewports: 1281×720 and 1279×720; 1920×1081. The requested exact 1280×720 and 1920×1080 were not obtainable in the two calibration rounds; these are **not** described as exact viewports.
- At 1281×720, real R3F scene objects for both 13×13 and 17×17 rivers produced zero projected bounding-box intersection with the actual HUD and top/bottom avatar DOM rects. At 17×17, temporarily hiding only the result backdrop showed every static tile clear of the candidate header; the backdrop was restored immediately. The candidate grid stayed `[416.2,599.0,864.6,711.4]` before/after the CSS change.
- At 1920×1081, all 34 river objects remain at baseline scale 1.2 and show zero projected-box overlap with HUD, avatars and candidate header. The browser's full screenshot repeated/cropped part of the result dialog, so a reliable complete 1080p visual frame was **not** seen. Previous D-stage exact 1920×1080 playthrough covered the unchanged 1080p layout; it is not direct post-fix visual confirmation.
- `cross-row` reached 12→13 through real click actions, settled at exactly 13 bottom and 13 top static tiles with zero proxy. Finite screencast returned no usable dynamic frames, so human inspection of the reflow smoothness remains pending. Pure endpoint/shared-target assertions pass.
- `last-turn` reached 17×17 and the authoritative draw ResultDialog, followed by next round build with Canvas=0. `ron` fixture reached authoritative +12,000 Ron result and next round build. Animation-time route exit yielded Canvas=0, Loading=0, sprite=0.
- Ordinary four-player 3D smoke: Canvas=1, self discard, AI draw/discard. The test-mode fixture emitted its pre-existing wall-count diagnostic; button-driven menu exit did not complete there. Subsequent navigation unmounted the scene. Four-player geometry/Camera sources were untouched; prior D-stage four-player full smoke remains applicable.
- Three-player preview: exactly three participant identities, 54 river tiles after 18-tile toggle, identity rotation, Canvas=1; exit Canvas=0. Layout preview only, no three-player gameplay.
- 17-step renderer diagnostic: requested=3d, active=3d, fallback=none, Canvas=1. 1080→720 resize kept the same Canvas object. In a 900ms stable sample, R3F `frameloop=demand`, render frame 6→6, calls 159→159, sprite=0, proxy=0. No new console errors in duel or preview tabs.

## Verification and limits

- Targeted: 65 PASS across six scene/candidate/ready/layout files; new 720p clearance, mirrored compact targets, 1080p baseline, proxy/static equality and interpolation assertions pass.
- Full `npm test`: 1663 PASS, 1 pre-existing opt-in pressure test SKIP (see log); build PASS with existing chunk-size warning; `git diff --check` PASS.
- Prior D-stage regression evidence covers two different effective Hand Packs, reduced motion, Scene Ready and full gameplay. This D.1 change does not alter those contracts. No Appearance settings, user save, Hand Pack assets or previous dirty/untracked files were modified by this task.
- Exact 720p/1080p post-fix visual frames, 12→13 moving reflow, a complete new 0→17×17 round after this patch, resize-after-action contact, and two-Pack post-fix visual comparison remain **NOT VERIFIED**. A manual check has been requested. Double-SFX stays with UI-6C; no infinite resource stress test was run.

Files changed in D.1: `src/presentation3d/participants/participantLayout.ts`, `ParticipantScene.tsx`, `CandidateDiscard3D.tsx`, `participantTable.css`, `participantRiverCompact.test.ts`; this report and the geometry audit. Existing A/B/C/D dirty/untracked work was preserved.
