# 3D table baseline (UI-5A.1 / UI-5B / UI-5C)

## Fixed camera

- Perspective camera position: `[0, 15.8, 22.2]`
- Look-at target: `[0, 0.35, 0.85]`
- FOV: `37`; near/far: `0.1 / 60`
- UI-5C.1 makes this single complete-table framing correction after separating all static zones. The modest FOV remains free of wide-angle distortion.

## World coordinates and scale

- `X`: table left (-) to right (+)
- `Y`: vertical, table surface to air (+)
- `Z`: top/opponent side (-) to bottom/local side (+)
- Table outer size: `21.2 × 21.2` world units; edge height: `1.05`. The former shallow depth could not physically contain the rotated side hands plus wall/river lanes.
- Mahjong tile: width `1.08`, height/thickness `0.60`, depth/long side `1.46`, corner radius `0.11`
- Seat order: `bottom → right → top → left`
- Seat origins are defined only in `coordinates/seatTransforms.ts`; every seat faces the table centre. Scene components must use `getSeatTransform`, `getSeatRotation`, or `getSeatDirection` rather than repeating rotations.

## Tile system

```text
existing Tile { id, red }
        ↓
resolveTileVisual
        ↓
visual key + cached texture resource
        ↓
shared geometry / shared material cache
        ↓
Tile3D
```

- `TileDefinition` is a read-only projection of the existing domain `Tile`; it is not a second tile domain model.
- The resolver covers 34 base faces, authoritative `red=true` for 5m/5p/5s, face-down/back, and an unknown-tile placeholder.
- `Tile3D` accepts `face-up | face-down` independently from `upright | sideways`. Seat rotation remains an outer spatial transform.
- Body, face plane, and red marker geometries are module singletons. The warm-beige side body (`#d8b170`, roughness `0.44`, metalness `0.008`) and red marker materials are shared singletons; warm-white face materials are cached by visual key.
- The face plane is `0.90 × 1.28` and sits only `0.002` above the rounded body. This preserves the texture-based prototype while reducing the former floating-sticker gap.
- Existing PNG resources remain authoritative. Drei `useTexture` caches by URL; UI-5B uses 35 image resources in the gallery (34 faces + back), or 36 including the lazy unknown placeholder. Red fives reuse their base-five textures and add a red material tint/marker.
- Textures use `SRGBColorSpace`, linear magnification, mipmapped linear minification, generated mipmaps, and anisotropy clamped to `1...8`.
- Shared cached geometry/material/texture resources intentionally outlive a scene toggle and are reused on remount; R3F owns scene objects and listeners. Do not dispose these module-level shared resources from individual tiles.

## Authoritative scene-state boundary

```text
GameState
    ↓ buildTableSceneState (pure, deterministic)
TableSceneState
    ↓ canonical bottom-seat transforms
Hand3D / River3D / Meld3D / Wall3D
    ↓
Tile3D
```

- `TableSceneState` contains only presentation projections, stable instance-derived keys, visibility flags and authoritative ordering. It never stores or mutates `GameState` and no R3F component reads Rules.
- Logical players are mapped to `bottom/right/top/left` from the existing controlled viewpoint. One canonical bottom-seat layout is rotated for the other seats; `sceneTransforms.ts` is the only owner of zone spacing and world positions.
- Hand order follows `PlayerState.hand`; `drawnTile.instanceId` is moved to the final separated slot. The bottom hand is face-up. Opponent tile definitions are omitted entirely unless existing `revealOpponentHands` or `revealedPlayerId` visibility permits them.
- Rivers preserve authoritative order and riichi instance markers. Claimed tiles are removed or retain an empty layout slot according to the existing `preserveClaimedDiscardGap` rule configuration; the 3D layer performs no call inference.
- Melds reuse `callsToMeldDisplayModels`, including chi/pon, ankan end backs, minkan, and stacked kakan presentation.
- The live wall uses fixed slots so remaining tiles do not reindex after a draw. Dead-wall roles come from `deadWallSlotRole`; used rinshan slots disappear, revealed dora faces are public, and ura slots remain face-down.

## Spatial zones and coexistence

- Hand zone: radius `9.55`, near each seat edge, with a deterministic drawn-tile gap.
- Meld zone: its own radius `7.88`; stacked kakan tiles reuse the called-tile position and cannot collide with the hand lane.
- Wall zone: radius `6.30`, two-level stacks forming a 42-stack rectangular ring. The 35 live stacks lead directly into seven dead-wall stacks on the final side, with a visible boundary gap.
- River zone: starts at radius `1.25` and expands outward in six-column rows (`+1.45` per row), so later rows no longer cross the table centre.
- Center zone remains clear for the DOM score HUD. Player frames, riichi sticks, event overlays, result UI and top controls remain DOM.
- In 3D mode `MahjongTable` renders a HUD-only layer. The legacy local-hand buttons remain mounted and clickable but visually transparent, preventing duplicate visible tiles until UI-5D migrates interaction. WebGL failure restores the complete 2.5D table and visible legacy hand.
- Replay uses the same renderer and its existing camera/open-hands controls. Test Mode continues to pass its existing all-open flag. The two-player 17-step table is rejected by `supports3DGameState` and remains legacy.

## Renderer and performance baseline

- `?table3d=1` lazy-loads the 3D chunk; default rendering remains the existing 2.5D table and WebGL failure returns to it.
- A normal initial four-player state renders 136 physical scene tiles: 53 hand tiles, 69 live-wall tiles and 14 dead-wall tiles, before rivers and melds grow.
- `InstancedMesh` is not used in UI-5C. Stable individual `Tile3D` meshes keep future extraction for UI-5E straightforward, but the initial color pass is roughly 272 tile mesh submissions before table meshes, markers and shadow passes. Static wall and concealed opponent backs are the first measured optimization candidates.
- A texture atlas is deferred until measured loading, memory, or draw-call pressure justifies it.

## Known visual limitations

- There are no dedicated red-five image assets, so the authoritative red state currently uses the existing five texture plus a restrained red tint and corner marker.
- The face remains a shallow plane above the rounded body rather than engraved/inset geometry; final edge, plastic, and face polish belongs to UI-5F.
- Static hand, wall, river and meld composition is present, but no 3D raycasting, interaction or presentation animation is enabled.
- The current environment still needs a real WebGL 720p/1080p composition and FPS pass; automated tests verify state parity and transforms, not pixels or GPU cost.
