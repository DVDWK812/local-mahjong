---
name: mahjong-ui-qa
description: "Perform browser-visible UI, interaction, and 3D/WebGL acceptance for this Mahjong app using the Codex built-in browser. Use after frontend, layout, interaction, animation, Three.js/R3F/WebGL, renderer-selection, HUD, overlay, pointer, responsive, or visual-regression changes. Validate observable behavior at required viewports with screenshots, Console, Network, and authoritative interaction evidence. Do not use for rules-only, AI-only, or asset-only validation."
---

# Mahjong UI and WebGL Acceptance

Validate observable user-facing behavior in the running application.

Do not infer a browser-visible `PASS` from source inspection, unit tests, snapshots, or build success alone.

3D is the primary/default renderer. 2.5D is frozen Legacy Compatibility Mode and is bugfix-only. New presentation work targets 3D unless the task explicitly says otherwise.

## Browser policy

For localhost UI and WebGL acceptance in this repository:

- Use the **Codex built-in browser only**.
- Do **not** use the Google Chrome extension.
- Do **not** depend on Chrome Native Messaging Host.
- Do **not** require an existing Chrome profile, cookies, or user browser tab.
- Do **not** report Chrome-extension connectivity failures as product failures.

If the built-in browser is unavailable or cannot access the running application, report:

`MANUAL BLOCKED`

Do not substitute source inspection or automated tests for browser-visible acceptance.

If the task explicitly concerns real Chrome profile state, a Chrome extension, browser-specific cookies, or Chrome-only behavior, report that limitation instead of silently switching tooling.

## Scope

Use this Skill when the task changes or may regress any of the following:

- responsive layout;
- page composition;
- buttons, dialogs, overlays, HUD, prompts, menus, tooltips;
- hover, click, pointer, focus, disabled, selected, drag, or hit-target behavior;
- async UI handoff;
- loading, empty, error, retry, success, or failure states;
- z-index, stacking, clipping, overflow, occlusion;
- 2.5D Mahjong table presentation;
- 3D Mahjong table presentation;
- Three.js / R3F scene layout;
- camera;
- materials;
- tile geometry;
- tile grounding;
- river / meld / hand packing;
- renderer activation and fallback;
- WebGL runtime;
- animation proxies;
- presentation masking;
- pointer raycast / hit meshes;
- texture loading or scene Suspense behavior;
- DOM overlays anchored to the 3D scene;
- visual regression after shared presentation changes.

Do not use this Skill as the primary validator for scoring, rule legality, AI strategy, seed/personality behavior, or asset-manifest integrity without a UI consequence. Use the corresponding rule, AI, asset, or bugfix Skill for those areas.

# General UI workflow

## 1. Read project constraints

Before browser acceptance:

1. Read the applicable `AGENTS.md`.
2. Read the task scope.
3. Identify whether the change affects 3D, shared presentation state, legacy isolation, or only DOM UI. Expand 2.5D regression only for GameScreen, Local Hand/shared DOM tiles, PresentationEvent/pacing, renderer switch/fallback, shared CSS/layout, shared audio, Rules/GameState, or an explicitly reported 2.5D bug.
4. Preserve existing dirty/untracked work.
5. Do not modify product code while performing acceptance unless the task explicitly asks for a fix.

Acceptance is not a substitute for implementation.

## 2. Confirm the app is running

Use the running local development server if already available.

Expected local application is normally under:

`http://127.0.0.1:5173/`

Do not start duplicate dev servers if an existing server is already serving the current worktree.

If the app is not running and the task permits starting it, start the normal project dev command and record the actual URL used.

## 3. Identify acceptance states

Before interacting, define the minimum user-visible states required by the task, such as initial, hover, selected, disabled, loading, settled, overlay open/closed, animation in progress/complete, success, failure, retry, and next-turn transition.

Do not perform generic browser clicking without connecting each action to a specific acceptance criterion.

# Viewport requirements

For gameplay, table, responsive, or 3D changes, validate both:

- `1280 × 720`
- `1920 × 1080`

If the task explicitly requires another viewport, add it without replacing these two unless instructed otherwise.

At each viewport check:

- no horizontal overflow;
- no unintended vertical overflow;
- no clipped controls;
- no hidden gameplay-critical information;
- no overlap between independent layout zones;
- text remains readable;
- pointer targets remain aligned with visuals.

# Default 3D acceptance

The default URL is:

`http://127.0.0.1:5173/`

For 3D presentation, renderer integration, shared state, gameplay interaction, HUD, overlays, or routing, verify the primary 3D path at both required viewports.

Required checks:

- exactly one Canvas is present;
- requested and active renderer are `3d`;
- fallback reason is `none`;
- the 3D scene, shared HUD, local hand, and affected interaction are visible and usable;
- Console contains no relevant errors;
- required Network requests do not fail.

# Legacy Compatibility smoke

Use `http://127.0.0.1:5173/?table3d=0` for one lightweight legacy smoke after 3D presentation work:

- Canvas count is `0` and no 3D layer is mounted;
- the table enters without a crash;
- a basic hand can run.

Do not require 2.5D feature or visual parity for new 3D presentation work. Run the broader 2.5D regression only when the shared-boundary conditions above apply.

# Mandatory 3D / WebGL acceptance

Use this section for any change involving 3D runtime, 3D layout, camera, table dimensions, tile geometry, grounding, hand/river/meld coordinates, Dora 3D integration, scene-anchored DOM, pointer/hit targets, 3D interaction, renderer animation, texture loading, Suspense, renderer selection, fallback, or shared 2D/3D presentation contracts.

The default 3D URL is:

`http://127.0.0.1:5173/`

`?table3d=1` remains a compatible explicit 3D URL; `?table3d=0` explicitly selects Legacy Compatibility Mode.

Use the Codex built-in browser.

## 3D runtime checks

At both `1280×720` and `1920×1080`, verify:

- exactly one WebGL Canvas is present;
- requested renderer is `3d`;
- active renderer is `3d`;
- fallback reason is `none`;
- the 3D scene is actually visible;
- no legacy 2.5D table is visibly mounted underneath or on top of it;
- the table is not clipped;
- no large unintended blank/black layout region was introduced;
- no horizontal overflow exists.

If renderer diagnostics use DOM attributes or stable debug markers, inspect those rather than guessing from appearance.

Do not treat `canvas >= 1` alone as proof that the intended renderer is active.

# 3D composition checks

Inspect the complete table composition, not just one changed object.

Depending on the task, verify:

- table bounds;
- felt surface;
- center console;
- DOM HUD alignment;
- player frames;
- local hand;
- opponent hands;
- river;
- meld lanes;
- Dora indicator area;
- action prompts;
- event overlays;
- result overlays.

Check that independent zones do not overlap unexpectedly.

For camera changes, verify both global composition and tile readability.

# Camera acceptance

For camera changes, record:

- camera position;
- target/lookAt;
- FOV;
- relevant near/far values if changed.

At both required viewports verify:

- all four hand regions remain usable;
- river tiles remain readable;
- meld regions remain visible;
- central console does not hide nearby river tiles;
- local hand does not obscure critical table information;
- opponent hands remain visually grounded;
- tile thickness remains perceptible when that is part of the visual goal;
- no required object is clipped by the viewport.

Do not approve a camera change solely because the table still fits on screen.

# Tile grounding acceptance

For Hand, River, Meld, Dora, and animation proxies affected by the task:

- tile bodies must not visibly penetrate the felt;
- tiles must not visibly float above the felt without intention;
- standing tiles must rest consistently across all seats;
- flat tiles must rest consistently across all seats;
- sideways tiles must remain grounded after rotation;
- animated tiles must remain above the felt during pitch/rotation interpolation.

Pay particular attention to intermediate animation frames, not only settled positions.

If grounding is derived from a shared surface authority, verify the visible result rather than assuming the math is correct.

# River acceptance

For River changes:

- each seat uses its correct seat-local orientation;
- normal discards use normal orientation;
- only authoritative riichi-discard tiles are sideways;
- standard river wrapping remains correct;
- when the project specifies six tiles per row, the seventh tile begins the next row;
- sideways tiles do not force unrelated normal tiles into excessive spacing;
- tiles do not geometrically overlap;
- tiles do not enter the center console;
- tiles do not invade the meld lane;
- accumulated river tiles remain visible after later discards.

For animation tasks, verify that the authoritative river tile remains after the proxy settles.

# Meld acceptance

For Chi / Pon / Kan visual changes:

- meld belongs to the correct player;
- meld is positioned in that player's meld lane;
- tiles within one meld are tightly and consistently packed;
- sideways called tiles do not create accidental overlap or excessive gaps;
- separate meld groups have clear group spacing;
- ankan / minkan / kakan preserve the intended authoritative arrangement;
- kakan added-tile presentation does not cause the entire meld to flash or remount;
- meld does not overlap River, Hand, or center console.

Do not infer meld legality from renderer behavior.

# Pointer / hover / click acceptance

For any pointer-sensitive 3D task, verify with the built-in browser using actual pointer movement.

Required checks:

- hover targets the authoritative tile intended by the visual;
- cursor remains stable while the pointer is stationary;
- the tile does not oscillate between hover/non-hover states;
- visual lift does not invalidate the hit target;
- adjacent tiles do not steal the pointer unexpectedly;
- a click triggers at most one authoritative action;
- disabled/non-playable tiles do not trigger gameplay actions;
- opponent tiles do not trigger local discard actions;
- pointer behavior survives animation completion;
- leaving the Canvas clears cursor/hover ownership cleanly.

When debugging pointer instability, watch for repeated:

`pointerover → pointerout → pointerover`

while the physical pointer is stationary.

Do not approve pointer fixes based only on unit tests.

# Hit-target acceptance

When stable hit meshes are used:

- hit target remains aligned with the static tile slot;
- visual hover lift may move without moving the hit target;
- hit target is not so large that neighboring tiles overlap;
- decorative face meshes or decals do not steal gameplay raycasts;
- a single pointer position resolves to the intended authoritative tile ID.

Hitbox and visual geometry must remain perceptually consistent.

# Animation acceptance

For Draw / Discard / Riichi / Meld / Win animation changes, validate:

- event starts once;
- proxy appears without a visible blank frame;
- authoritative source visibility is masked/handed off correctly;
- proxy reaches the intended target;
- authoritative target appears without a visible blank frame;
- proxy is cleaned up;
- no duplicate tile remains;
- no stale mask remains;
- next automatic action does not start before the relevant presentation barrier resolves.

Inspect actual visual handoff, not only event logs.

## Draw

Verify:

- draw motion is visible;
- final tile settles in the correct hand position;
- local drawn gap is preserved when expected;
- opponent draw does not reveal hidden tile identity;
- Draw → Discard cadence is visually readable.

## Discard

Verify:

- source tile leaves the correct hand region;
- transient proxy is visible during motion;
- target river slot is correct;
- river tile remains visible after settle;
- no source/proxy/target triple-duplication is visible;
- no full-scene flash occurs;
- Discard → next automatic action cadence is visually readable.

## Riichi

Verify:

- discard completes before the riichi presentation begins;
- riichi declaration does not replay the discard animation;
- riichi stick appears at the correct seat anchor;
- authoritative riichi state is preserved;
- the riichi-discard river tile remains sideways;
- no duplicate stick remains after cleanup.

## Chi / Pon / Kan

Verify:

- declaration animation uses the correct player's meld region;
- authoritative meld order is preserved;
- Kan → Rinshan Draw ordering remains serialized;
- added Kan does not visually rebuild unrelated meld state;
- animation proxy cleanup is complete.

## Ron / Tsumo / round-end

When applicable, verify ordering of:

- final Draw/Discard;
- win presentation;
- hand reveal / push-down;
- winning-tile emphasis;
- event overlay;
- result dialog;
- continuation.

The result dialog must not appear before required presentation completes.

# Animation cadence

For automatic gameplay sequences, confirm actions are visually distinguishable.

Examples:

`Draw → settle → short hold → Discard`

`Discard → settle → short hold → next automatic action`

The purpose is observable pacing, not artificial rule delay.

Verify normal speed, accelerated speed if supported, Skip, and Cancel/unmount.

Skip should snap to final presentation state and continue without leaving proxies or masks.

Cancel/unmount should clean transient presentation state.

# Suspense / texture-loading acceptance

For Three.js/R3F texture or lazy-loading changes:

- introducing a newly visible tile face must not blank the entire table;
- the table body and HUD must remain stable while tile assets load;
- no visible full-scene `fallback=null` flash should occur during normal gameplay;
- required textures should be preloaded or isolated behind appropriately scoped Suspense boundaries;
- repeated discards or newly revealed tiles should not cause scene-wide flashing.

Check Console and Network for failed chunks or textures.

# DOM / 3D integration acceptance

For DOM elements anchored to 3D objects:

- authoritative data remains in the existing DOM/shared model;
- 3D only provides spatial housing/anchor where intended;
- DOM overlay remains aligned with its 3D target at both required viewports;
- camera changes do not detach the overlay from the physical object;
- pointer behavior is not blocked by non-interactive DOM overlays;
- overlay does not create duplicate authority.

Examples include central score console, Dora screen overlay, player frames, action prompt, and event overlay.

# Async UI acceptance

When the change involves async UI state, exercise relevant states such as idle, loading, success, failure, retry, stale-to-fresh handoff, cancellation, and component unmount.

Verify that temporary state does not regress back to stale UI after success.

# Console checks

During the acceptance flow inspect Console.

Fail the relevant criterion for:

- uncaught application errors;
- React/R3F runtime errors;
- Three.js errors;
- renderer initialization errors;
- repeated pointer/runtime exceptions;
- required asset load errors.

Do not automatically fail for unrelated known environmental noise unless it affects the tested feature. Record unrelated noise separately.

# Network checks

Inspect required requests during the tested flow.

Fail the relevant criterion for failed required:

- JS chunks;
- tile textures;
- UI assets;
- audio assets required by the tested path;
- application data required by the tested state.

Expected cancellations caused by navigation or media switching are not automatically failures. State why a failed/cancelled request is relevant or irrelevant.

# Screenshot policy

Capture screenshots when:

- layout changed;
- camera changed;
- table dimensions changed;
- visual comparison matters;
- a regression is visible;
- a state cannot be adequately evidenced by logs alone.

For 3D/table acceptance, capture affected states at both:

- `1280×720`
- `1920×1080`

Do not rely on screenshots alone for pointer, hover, animation ordering, or runtime stability.

# Evidence requirements

Each browser-visible criterion must be reported as one of:

- `PASS`
- `FAIL`
- `NOT VERIFIED`
- `MANUAL BLOCKED`

Use direct evidence such as viewport, URL, visible state, interaction performed, Canvas count, renderer diagnostics, Console result, Network result, screenshot, and actual gameplay progression.

Do not upgrade `NOT VERIFIED` or `MANUAL BLOCKED` to `PASS` because automated tests passed.

# Failure handling

If acceptance finds a defect:

1. State the observable failure.
2. State the viewport/state where it occurred.
3. Identify the most likely responsible component only if evidence supports it.
4. Do not silently modify code during a read-only QA task.
5. If the parent task is a bugfix/development task and permits fixes, return evidence to that workflow before modifying code.

Do not broaden the task into unrelated cleanup.

# Legacy / 3D isolation

For shared renderer changes, explicitly verify isolation.

A 3D fix must retain Legacy Compatibility smoke viability. It does not require 2.5D feature or visual parity.

A 2.5D fix must not accidentally mount or alter the 3D renderer.

For standard acceptance:

- default URL → one active 3D Canvas
- `?table3d=0` → `Canvas=0`, no 3D layer

# Output format

Provide a compact acceptance table:

| Criterion | Result | Viewport / State | Evidence | Likely component |
|---|---|---|---|---|

Then summarize:

## Automated evidence

Include relevant targeted tests, full tests, build, and diff check.

Do not call automated evidence browser acceptance.

## Built-in browser evidence

Include:

- URLs used;
- viewport(s);
- Canvas count;
- requested renderer;
- active renderer;
- fallback;
- primary interaction path;
- Console;
- Network;
- screenshots;
- notable visual observations.

## Legacy Compatibility smoke

State what was actually verified.

## Blockers

If the Codex built-in browser was unavailable, state:

`MANUAL BLOCKED: built-in browser unavailable`

Do not mention Chrome extension or Native Messaging Host unless the task explicitly concerns them.

# PASS gate

For a UI/browser task, overall UI QA is `PASS` only when every required browser-visible criterion has direct browser evidence.

For 3D/WebGL work, `PASS` requires at minimum:

- built-in browser successfully used;
- both required viewports validated;
- Canvas count correct;
- requested/active renderer correct;
- fallback `none`;
- changed layout/interaction/animation verified in the browser;
- Console clean of relevant errors;
- Network clean of failed required resources;
- Legacy Compatibility smoke checked; broader 2.5D regression checked only when applicable.

If any mandatory browser criterion is not observed, report `NOT VERIFIED` or `MANUAL BLOCKED`, not `PASS`.

# Completion rule

UI QA does not decide game legality.

Do not modify Rules, GameState, Scoring, or AI to make a visual acceptance pass.

Report evidence, preserve architecture boundaries, and stop when the requested acceptance scope is complete.
