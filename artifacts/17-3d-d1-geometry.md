# 17-3D.D.1 geometry audit (pre-fix)

Real WebGL in Codex built-in browser, `?seventeenFixture=last-turn&table3d=1`. Fixture has 16 discarded tiles per participant; the observed production 17th-discard symptom was recorded in `17-3d-d-report.md`. Browser viewport calibration produced **1281×720** and **1920×1081 CSS px**; these measurements are close diagnostic samples, not a claim of exact gate sizes.

Projected rectangles were computed from each rendered `participant-river-*` mesh's world bounding box and the active R3F camera, then compared with actual visible `.table-3d-player-card` and `.table-center` rects. A screencast was inspected to confirm the overlapping elements are visible, rather than relying on rectangle intersection alone.

At 1281×720: bottom avatar card `[521.3,498.3,586.2,597.0]`, central HUD `[515.6,255.2,759.8,443.1]`, top avatar card `[958.0,67.8,1022.9,166.5]` (CSS pixels, left/top/right/bottom).

| Seat | River tile indexes (zero based) | Obscurer | Projected tile ranges | Approximate intersection |
|---|---|---|---|---|
| bottom | 0–5 | central HUD | row 1 y=428–485 | 474–625 CSS px² each |
| bottom | 6, 7 | bottom avatar | row 2 y=478–537 | 1175–1376 CSS px² |
| bottom | 12, 13 | bottom avatar | row 3 y=530–591 | 2027–2053 CSS px² |
| top | 0–15 | none | three rows | 0 |

At 1920×1081, no bottom/top river tile box intersects the actual avatar cards or center HUD. The top screenshot had capture clipping; the projection result is diagnostic, not a substitute for complete 1080p visual confirmation.

Four-player screenshot from prior D gate uses the same frozen bottom avatar/HUD anchors and displays the same tight first river tile clearance; this task must leave that path unchanged.

The first bottom tile already intersects the HUD before a third row exists. A third-row-only adjustment or a uniform 0.90–0.94 scale at unchanged tile center cannot clear all intersections. A **non-product simulation** at 720p found that `0.90` tile scale plus approximately `+0.55` world radial offset for all rows and `+2.7` world inline offset for rows 2–3 clears the measured boxes for this fixture. This shifts the first tile's screen position and therefore needs clarification against the requested unchanged starting anchor.

## Post-fix diagnostic

Only the 17-step duel preset at 13–17 tiles and canvas height at most 800 CSS px uses the mode-local compact transform. At 1281×720, the actual 13+ tile R3F objects were projected again against the real visible DOM cards/HUD. Both 13×13 and 17×17 scenes reported **zero projected-box intersections**. The 17th bottom tile projected to `[770,550,814,605]`, and the 17th top tile to `[505,124,538,164]`; neither intersects the cards or HUD. At 1920×1081, the compact transform is disabled and rendered river tile scale remains the shared baseline `1.2`. The 1080p full screenshot is affected by capture duplication/clipping, so this check is geometric and does not close that visual gate.

The 12→13 transition was reached through the `cross-row` fixture in a real WebGL session. The scene settled at exactly 13 bottom and 13 top static tiles with zero candidate proxies. A short screencast produced no usable frames, so visual continuity of the reflow itself remains to be confirmed directly; the pure interpolation endpoints and shared proxy/static destination are covered by `participantRiverCompact.test.ts`.

After the 17th discard, a temporary diagnostic hide of the ResultDialog backdrop exposed the unchanged static table, then the backdrop was restored immediately. This revealed a second screen-space obstruction: the 720p candidate header rect `[711.1,570.7,864.6,595.0]` crossed the third bottom river row. A duel-only `max-height:800px` CSS rule now places this short header at `[872.6,599.0,1026.2,623.3]` while the candidate grid rect stays exactly `[416.2,599.0,864.6,711.4]`. The follow-up real WebGL frame showed all 17 bottom and 17 top tiles unobscured by the candidate header; the ResultDialog was restored after inspection.
