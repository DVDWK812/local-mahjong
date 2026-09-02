import { describe, expect, it } from 'vitest';
import { TABLE_WORLD_DIMENSIONS } from '../table/TableMesh';
import { CENTRAL_CONSOLE_DIMENSIONS } from '../table/CentralConsole3D';
import { MAHJONG_TILE_DIMENSIONS } from '../tile/tileGeometry';
import { getFlatTileCenterY, getStandingTileCenterY } from '../tile/tileGrounding';
import {
  getHandTileScale,
  TABLE_PRESENTATION_TUNING,
} from '../table/tablePresentationTuning';
import {
  canonicalToSeat,
  getDeadWallTileTransform,
  getHandTileTransform,
  getMeldTileTransform,
  getMeldTileTransforms,
  getRiverTileRotationY,
  getRiverTileTransform,
  getRiverTileTransforms,
  getWallTileTransform,
  type SceneTileTransform,
  TABLE_SCENE_LAYOUT,
} from './sceneTransforms';
import type { Table3DSeat } from './seatTransforms';
import {
  getFlatTileFootprint,
  packedWidth,
  TILE_PACKING_GAPS,
} from '../tile/tileFootprintPacking';

describe('UI-5C canonical table transforms', () => {
  it('maps normal and riichi river orientation from the same seat-local frame', () => {
    const seats = ['bottom', 'right', 'top', 'left'] as const;
    const normal = seats.map((seat) => getRiverTileRotationY(seat, 'upright'));
    const sideways = seats.map((seat) => getRiverTileRotationY(seat, 'sideways'));
    expect(normal).toEqual([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    sideways.forEach((rotation, index) => {
      expect(rotation - normal[index]).toBeCloseTo(Math.PI / 2);
    });
  });

  it('uses a fixed six-column river grid with variable normal/sideways footprints', () => {
    const riverScale = TABLE_PRESENTATION_TUNING.tileScale.river;
    const inputs = Array.from({ length: 7 }, (_, layoutIndex) => ({
      layoutIndex,
      orientation: layoutIndex === 2 ? 'sideways' as const : 'upright' as const,
    }));
    const packed = getRiverTileTransforms('bottom', inputs);
    const firstRow = inputs.slice(0, 6).map(({ layoutIndex }) => packed.get(layoutIndex)!);
    const secondRowFirst = packed.get(6)!;
    expect(new Set(firstRow.map((tile) => tile.position[2])).size).toBe(1);
    const normalRowWidth = packedWidth(
      Array.from({ length: 6 }, () => getFlatTileFootprint('upright', riverScale).x),
      TILE_PACKING_GAPS.riverInline * riverScale,
    );
    expect(secondRowFirst.position[0]).toBeCloseTo(
      -normalRowWidth / 2 + getFlatTileFootprint('upright', riverScale).x / 2,
    );
    expect(secondRowFirst.position[2] - firstRow[0].position[2])
      .toBeCloseTo(TABLE_SCENE_LAYOUT.riverRowSpacing * riverScale);
    for (let index = 1; index < firstRow.length; index += 1) {
      const previousFootprint = getFlatTileFootprint(inputs[index - 1].orientation, riverScale).x;
      const currentFootprint = getFlatTileFootprint(inputs[index].orientation, riverScale).x;
      expect(firstRow[index].position[0] - firstRow[index - 1].position[0])
        .toBeCloseTo(
          previousFootprint / 2
          + TILE_PACKING_GAPS.riverInline * riverScale
          + currentFootprint / 2,
        );
    }
    const firstLeftEdge = firstRow[0].position[0]
      - getFlatTileFootprint(inputs[0].orientation, riverScale).x / 2;
    const lastRightEdge = firstRow[5].position[0]
      + getFlatTileFootprint(inputs[5].orientation, riverScale).x / 2;
    expect(firstLeftEdge).toBeCloseTo(-lastRightEdge);
    (['right', 'top', 'left'] as const).forEach((seat) => {
      const rowStart = getRiverTileTransform(seat, 0).position;
      const wrapped = getRiverTileTransform(seat, 6).position;
      expect(Math.hypot(wrapped[0] - rowStart[0], wrapped[2] - rowStart[2]))
        .toBeCloseTo(TABLE_SCENE_LAYOUT.riverRowSpacing * riverScale);
    });
  });

  it('scales River upright/sideways footprints, gaps, and grounding from one authority', () => {
    const scale = 0.8;
    const inputs = [
      { layoutIndex: 0, orientation: 'upright' as const },
      { layoutIndex: 1, orientation: 'sideways' as const },
      { layoutIndex: 6, orientation: 'upright' as const },
    ];
    const packed = getRiverTileTransforms('bottom', inputs, 6, scale);
    const first = packed.get(0)!;
    const sideways = packed.get(1)!;
    const wrapped = packed.get(6)!;
    const uprightFootprint = getFlatTileFootprint('upright', scale);
    const sidewaysFootprint = getFlatTileFootprint('sideways', scale);

    expect(TABLE_PRESENTATION_TUNING.tileScale.river).toBe(1.2);
    expect(sideways.position[0] - first.position[0]).toBeCloseTo(
      uprightFootprint.x / 2
      + TILE_PACKING_GAPS.riverInline * scale
      + sidewaysFootprint.x / 2,
    );
    expect(wrapped.position[2] - first.position[2]).toBeCloseTo(
      uprightFootprint.z + TILE_PACKING_GAPS.riverRow * scale,
    );
    expect(first.position[1]).toBeCloseTo(getFlatTileCenterY(scale));
  });

  it('scales each opponent Hand spacing, drawn gap, centering, and grounding independently', () => {
    const tileScale = TABLE_PRESENTATION_TUNING.tileScale as unknown as {
      topHand: number;
      leftHand: number;
      rightHand: number;
    };
    const previous = { ...tileScale };
    try {
      tileScale.topHand = 0.9;
      tileScale.leftHand = 0.8;
      tileScale.rightHand = 0.7;
      const scales = { top: 0.9, left: 0.8, right: 0.7 } as const;
      (Object.keys(scales) as Array<keyof typeof scales>).forEach((seat) => {
        const first = getHandTileTransform(seat, 0, 14, true);
        const second = getHandTileTransform(seat, 1, 14, true);
        const lastBase = getHandTileTransform(seat, 12, 14, true);
        const drawn = getHandTileTransform(seat, 13, 14, true);
        expect(getHandTileScale(seat)).toBe(scales[seat]);
        expect(Math.hypot(
          second.position[0] - first.position[0],
          second.position[2] - first.position[2],
        )).toBeCloseTo(TABLE_SCENE_LAYOUT.handSpacing * scales[seat]);
        expect(Math.hypot(
          drawn.position[0] - lastBase.position[0],
          drawn.position[2] - lastBase.position[2],
        )).toBeCloseTo(
          (TABLE_SCENE_LAYOUT.handSpacing + TABLE_SCENE_LAYOUT.drawnGap) * scales[seat],
        );
        expect(first.position[1]).toBeCloseTo(getStandingTileCenterY(scales[seat]));
      });
      expect(getHandTileScale('bottom')).toBe(1);
      expect(getHandTileTransform('bottom', 0, 1, false).position[1])
        .toBeCloseTo(getStandingTileCenterY());
    } finally {
      Object.assign(tileScale, previous);
    }
  });

  it('rotates one canonical bottom layout into all four screen seats', () => {
    expect(canonicalToSeat('bottom', [0, 1, 5]).position).toEqual([0, 1, 5]);
    expect(canonicalToSeat('right', [0, 1, 5]).position[0]).toBeCloseTo(5);
    expect(canonicalToSeat('top', [0, 1, 5]).position[2]).toBeCloseTo(-5);
    expect(canonicalToSeat('left', [0, 1, 5]).position[0]).toBeCloseTo(-5);
  });

  it('applies one world-Z offset only to the requested Hand, River, and Meld transforms', () => {
    const tuning = TABLE_PRESENTATION_TUNING as unknown as {
      lowerTableContentOffsetZ: number;
    };
    const previousOffset = tuning.lowerTableContentOffsetZ;
    const seats = ['bottom', 'right', 'top', 'left'] as const;
    tuning.lowerTableContentOffsetZ = 0;
    const baseline = Object.fromEntries(seats.map((seat) => [seat, {
      hand: getHandTileTransform(seat, 0, 1, false),
      river: getRiverTileTransform(seat, 0),
      meld: getMeldTileTransform(seat, 0, 0),
    }])) as Record<typeof seats[number], {
      hand: ReturnType<typeof getHandTileTransform>;
      river: ReturnType<typeof getRiverTileTransform>;
      meld: ReturnType<typeof getMeldTileTransform>;
    }>;
    try {
      tuning.lowerTableContentOffsetZ = 2;
      seats.forEach((seat) => {
        const hand = getHandTileTransform(seat, 0, 1, false);
        const river = getRiverTileTransform(seat, 0);
        const meld = getMeldTileTransform(seat, 0, 0);
        const handMoves = seat === 'left' || seat === 'right';
        const meldMoves = seat !== 'top';

        expect(hand.position[0]).toBe(baseline[seat].hand.position[0]);
        expect(hand.position[1]).toBe(baseline[seat].hand.position[1]);
        expect(hand.position[2] - baseline[seat].hand.position[2])
          .toBeCloseTo(handMoves ? 2 : 0);
        expect(river.position[0]).toBe(baseline[seat].river.position[0]);
        expect(river.position[1]).toBe(baseline[seat].river.position[1]);
        expect(river.position[2] - baseline[seat].river.position[2]).toBeCloseTo(2);
        expect(meld.position[0]).toBe(baseline[seat].meld.position[0]);
        expect(meld.position[1]).toBe(baseline[seat].meld.position[1]);
        expect(meld.position[2] - baseline[seat].meld.position[2])
          .toBeCloseTo(meldMoves ? 2 : 0);
      });
    } finally {
      tuning.lowerTableContentOffsetZ = previousOffset;
    }
  });

  it('packs chi, pon, kan and stacked kakan tiles by authoritative footprint', () => {
    const meldScale = TABLE_PRESENTATION_TUNING.tileScale.meld;
    const melds = [
      { tiles: [
        { orientation: 'upright' as const, called: false, stacked: false },
        { orientation: 'sideways' as const, called: true, stacked: false },
        { orientation: 'upright' as const, called: false, stacked: false },
      ] },
      { tiles: [
        { orientation: 'upright' as const, called: true, stacked: false },
        { orientation: 'upright' as const, called: false, stacked: false },
        { orientation: 'upright' as const, called: false, stacked: false },
        { orientation: 'upright' as const, called: false, stacked: true },
      ] },
    ];
    const transforms = getMeldTileTransforms('bottom', melds);
    expect(transforms[0][0].position[0] - transforms[0][1].position[0]).toBeCloseTo(
      getFlatTileFootprint('upright', meldScale).x / 2
      + TILE_PACKING_GAPS.meldInline * meldScale
      + getFlatTileFootprint('sideways', meldScale).x / 2,
    );
    expect(transforms[1][3].position[0]).toBeCloseTo(transforms[1][0].position[0]);
    expect(transforms[1][3].position[1]).toBeGreaterThan(transforms[1][0].position[1]);
    const firstGroupLeftEdge = transforms[0][2].position[0]
      - getFlatTileFootprint('upright', meldScale).x / 2;
    const secondGroupRightEdge = transforms[1][0].position[0]
      + getFlatTileFootprint('upright', meldScale).x / 2;
    expect(firstGroupLeftEdge - secondGroupRightEdge)
      .toBeCloseTo(TILE_PACKING_GAPS.meldGroup * meldScale);
  });

  it('applies independent Meld offsets after seat rotation without changing packing or grounding', () => {
    const tuning = TABLE_PRESENTATION_TUNING as unknown as {
      meldSeatOffsets: Record<Table3DSeat, { inline: number; radial: number }>;
    };
    const seats = ['bottom', 'right', 'top', 'left'] as const;
    const melds = [{ tiles: [
      { orientation: 'upright' as const, called: false, stacked: false },
      { orientation: 'sideways' as const, called: true, stacked: false },
      { orientation: 'upright' as const, called: false, stacked: false },
    ] }];
    const previous = Object.fromEntries(seats.map((seat) => [
      seat, { ...tuning.meldSeatOffsets[seat] },
    ])) as Record<Table3DSeat, { inline: number; radial: number }>;
    const expectedDelta = {
      bottom: [1.25, 0.75],
      right: [0.75, -1.25],
      top: [-1.25, -0.75],
      left: [-0.75, 1.25],
    } as const;
    try {
      seats.forEach((seat) => {
        tuning.meldSeatOffsets[seat].inline = 0;
        tuning.meldSeatOffsets[seat].radial = 0;
      });
      const baseline = Object.fromEntries(seats.map((seat) => [
        seat, getMeldTileTransforms(seat, melds)[0],
      ])) as Record<Table3DSeat, readonly SceneTileTransform[]>;

      seats.forEach((seat) => {
        tuning.meldSeatOffsets[seat].inline = 1.25;
        tuning.meldSeatOffsets[seat].radial = 0.75;
        const shifted = getMeldTileTransforms(seat, melds)[0];
        shifted.forEach((transform, tileIndex) => {
          expect(transform.position[0] - baseline[seat][tileIndex].position[0])
            .toBeCloseTo(expectedDelta[seat][0]);
          expect(transform.position[2] - baseline[seat][tileIndex].position[2])
            .toBeCloseTo(expectedDelta[seat][1]);
          expect(transform.position[1]).toBe(baseline[seat][tileIndex].position[1]);
          expect(transform.rotationY).toBe(baseline[seat][tileIndex].rotationY);
        });
        expect(shifted[0].position[0] - shifted[1].position[0]).toBeCloseTo(
          baseline[seat][0].position[0] - baseline[seat][1].position[0],
        );
        tuning.meldSeatOffsets[seat].inline = 0;
        tuning.meldSeatOffsets[seat].radial = 0;
      });
    } finally {
      seats.forEach((seat) => {
        tuning.meldSeatOffsets[seat].inline = previous[seat].inline;
        tuning.meldSeatOffsets[seat].radial = previous[seat].radial;
      });
    }
  });

  it('scales Meld footprints, inline/group gaps, stacked height, and grounding together', () => {
    const tileScale = TABLE_PRESENTATION_TUNING.tileScale as unknown as { meld: number };
    const previousScale = tileScale.meld;
    const scale = 0.8;
    tileScale.meld = scale;
    try {
      const melds = [
        { tiles: [
          { orientation: 'upright' as const, called: false, stacked: false },
          { orientation: 'sideways' as const, called: true, stacked: false },
          { orientation: 'upright' as const, called: false, stacked: false },
        ] },
        { tiles: [
          { orientation: 'upright' as const, called: true, stacked: false },
          { orientation: 'upright' as const, called: false, stacked: false },
          { orientation: 'upright' as const, called: false, stacked: false },
          { orientation: 'upright' as const, called: false, stacked: true },
        ] },
      ];
      const transforms = getMeldTileTransforms('bottom', melds);
      expect(transforms[0][0].position[0] - transforms[0][1].position[0]).toBeCloseTo(
        getFlatTileFootprint('upright', scale).x / 2
        + TILE_PACKING_GAPS.meldInline * scale
        + getFlatTileFootprint('sideways', scale).x / 2,
      );
      expect(transforms[0][0].position[1]).toBeCloseTo(getFlatTileCenterY(scale));
      expect(transforms[1][3].position[1] - transforms[1][0].position[1])
        .toBeCloseTo((MAHJONG_TILE_DIMENSIONS.height + 0.04) * scale);
      const firstGroupLeftEdge = transforms[0][2].position[0]
        - getFlatTileFootprint('upright', scale).x / 2;
      const secondGroupRightEdge = transforms[1][0].position[0]
        + getFlatTileFootprint('upright', scale).x / 2;
      expect(firstGroupLeftEdge - secondGroupRightEdge)
        .toBeCloseTo(TILE_PACKING_GAPS.meldGroup * scale);
    } finally {
      tileScale.meld = previousScale;
    }
  });

  it('keeps hand, river, meld, and drawn-tile spacing in separate radial lanes', () => {
    const first = getHandTileTransform('bottom', 0, 14, true);
    const lastBase = getHandTileTransform('bottom', 12, 14, true);
    const drawn = getHandTileTransform('bottom', 13, 14, true);
    expect(drawn.position[0] - lastBase.position[0]).toBeCloseTo(
      TABLE_SCENE_LAYOUT.handSpacing + TABLE_SCENE_LAYOUT.drawnGap,
    );
    expect(first.position[2]).toBe(TABLE_SCENE_LAYOUT.handZ);
    expect(first.position[1]).toBe(TABLE_SCENE_LAYOUT.standingHandCenterY);
    expect(first.rotationX).toBe(TABLE_SCENE_LAYOUT.standingHandRotationX);
    const bottomRiverSecondRow = getRiverTileTransform('bottom', 6);
    const bottomMeld = getMeldTileTransform('bottom', 0, 0);
    expect(bottomRiverSecondRow.position[2]).toBeCloseTo(
      TABLE_SCENE_LAYOUT.riverZ
      + TABLE_PRESENTATION_TUNING.riverSeatOffsets.bottom.radialZ
      + TABLE_SCENE_LAYOUT.riverRowSpacing * TABLE_PRESENTATION_TUNING.tileScale.river
      + TABLE_PRESENTATION_TUNING.lowerTableContentOffsetZ,
    );
    expect(bottomMeld.position[2]).toBe(
      TABLE_SCENE_LAYOUT.meldZ
      + TABLE_PRESENTATION_TUNING.meldSeatOffsets.bottom.radial
      + TABLE_PRESENTATION_TUNING.lowerTableContentOffsetZ,
    );
    expect(bottomMeld.position[2]).toBeGreaterThan(TABLE_SCENE_LAYOUT.handZ);
    expect(TABLE_SCENE_LAYOUT.handZ).toBeGreaterThan(bottomRiverSecondRow.position[2]);
    expect(bottomRiverSecondRow.position[2]).toBeGreaterThan(TABLE_SCENE_LAYOUT.wallZ);
  });

  it('forms a four-side wall ring and continues the dead wall on the final side', () => {
    expect(getWallTileTransform(0).position[2]).toBeGreaterThan(0);
    expect(getWallTileTransform(22).position[0]).toBeGreaterThan(0);
    expect(getWallTileTransform(42).position[2]).toBeLessThan(0);
    expect(getWallTileTransform(64).position[0]).toBeLessThan(0);
    expect(getDeadWallTileTransform(0).position[0]).toBeLessThan(0);
    expect(getDeadWallTileTransform(13).position[0]).toBeLessThan(0);
    expect(getDeadWallTileTransform(0).position[2])
      .toBeGreaterThan(getWallTileTransform(68).position[2]);
    expect(getWallTileTransform(1).position[1] - getWallTileTransform(0).position[1])
      .toBeCloseTo(TABLE_SCENE_LAYOUT.wallLayerHeight);
  });

  it('keeps every seat on the same radial baselines after rotation', () => {
    expect(getHandTileTransform('right', 0, 1, false).position[0])
      .toBeCloseTo(TABLE_SCENE_LAYOUT.handZ + TABLE_SCENE_LAYOUT.sideHandOutset);
    expect(getHandTileTransform('right', 0, 1, false).rotationY)
      .toBeCloseTo(Math.PI / 2);
    expect(getRiverTileTransform('top', 0).position[2])
      .toBeCloseTo(
        -TABLE_SCENE_LAYOUT.riverZ
        - TABLE_PRESENTATION_TUNING.riverSeatOffsets.top.radialZ
        + TABLE_PRESENTATION_TUNING.lowerTableContentOffsetZ,
      );
    expect(getMeldTileTransform('left', 0, 0).position[0])
      .toBeCloseTo(-(
        TABLE_SCENE_LAYOUT.meldZ
        + TABLE_SCENE_LAYOUT.sideMeldOutset
        + TABLE_PRESENTATION_TUNING.meldSeatOffsets.left.radial
      ));
  });

  it('keeps the physical zone footprints separated and inside the rectangular tabletop', () => {
    const riverOuterZ = TABLE_SCENE_LAYOUT.riverZ
      + TABLE_SCENE_LAYOUT.riverRowSpacing * 2;
    const standingHandRadialFootprint = MAHJONG_TILE_DIMENSIONS.height / 2;
    const flatTileRadialFootprint = MAHJONG_TILE_DIMENSIONS.depth / 2;
    expect(TABLE_SCENE_LAYOUT.handZ - standingHandRadialFootprint)
      .toBeGreaterThan(TABLE_SCENE_LAYOUT.meldZ + flatTileRadialFootprint);
    expect(TABLE_SCENE_LAYOUT.meldZ - TABLE_SCENE_LAYOUT.wallZ)
      .toBeGreaterThan(MAHJONG_TILE_DIMENSIONS.depth);
    expect(TABLE_SCENE_LAYOUT.wallZ - riverOuterZ)
      .toBeGreaterThan(MAHJONG_TILE_DIMENSIONS.depth);
    expect(TABLE_SCENE_LAYOUT.handZ + standingHandRadialFootprint)
      .toBeLessThan(TABLE_WORLD_DIMENSIONS.depth / 2);
    expect(TABLE_SCENE_LAYOUT.meldRightX + MAHJONG_TILE_DIMENSIONS.depth / 2)
      .toBeLessThan(TABLE_WORLD_DIMENSIONS.width / 2);
    expect(TABLE_SCENE_LAYOUT.handZ + TABLE_SCENE_LAYOUT.sideHandOutset
      + standingHandRadialFootprint)
      .toBeLessThan(TABLE_WORLD_DIMENSIONS.width / 2);
  });

  it('keeps the console, river, meld, and hand in explicit non-overlapping radial zones', () => {
    const riverInnerEdge = TABLE_SCENE_LAYOUT.riverZ - MAHJONG_TILE_DIMENSIONS.depth / 2;
    const riverOuterEdge = TABLE_SCENE_LAYOUT.riverZ
      + TABLE_SCENE_LAYOUT.riverRowSpacing * 2
      + MAHJONG_TILE_DIMENSIONS.depth / 2;
    const meldInnerEdge = TABLE_SCENE_LAYOUT.meldZ - MAHJONG_TILE_DIMENSIONS.height / 2;
    const handInnerEdge = TABLE_SCENE_LAYOUT.handZ - MAHJONG_TILE_DIMENSIONS.height / 2;

    expect(riverInnerEdge).toBeGreaterThan(CENTRAL_CONSOLE_DIMENSIONS.outerSize / 2);
    expect(meldInnerEdge).toBeGreaterThan(riverOuterEdge);
    expect(handInnerEdge).toBeGreaterThan(
      TABLE_SCENE_LAYOUT.meldZ + MAHJONG_TILE_DIMENSIONS.height / 2,
    );
    expect(TABLE_WORLD_DIMENSIONS.width).toBe(38);
    expect(TABLE_WORLD_DIMENSIONS.depth).toBe(35);
  });

  it('keeps adjacent legal six-column river zones physically disjoint', () => {
    const riverScale = TABLE_PRESENTATION_TUNING.tileScale.river;
    const legalRowFootprints = [
      getFlatTileFootprint('sideways', riverScale).x,
      ...Array.from({ length: 5 }, () => getFlatTileFootprint('upright', riverScale).x),
    ];
    const tangentialOuterEdge = packedWidth(
      legalRowFootprints,
      TILE_PACKING_GAPS.riverInline * riverScale,
    ) / 2 + Math.abs(TABLE_PRESENTATION_TUNING.riverSeatOffsets.bottom.inlineX);
    const sideRiverInnerEdge = TABLE_SCENE_LAYOUT.riverZ
      + TABLE_SCENE_LAYOUT.sideRiverOutset
      + TABLE_PRESENTATION_TUNING.riverSeatOffsets.right.radialZ
      - getFlatTileFootprint('sideways', riverScale).z / 2;

    expect(sideRiverInnerEdge).toBeGreaterThan(tangentialOuterEdge);
  });

  it('gives every wall stack a unique horizontal position without corner intersections', () => {
    const stackPositions = [
      ...Array.from({ length: 35 }, (_, index) => getWallTileTransform(index * 2).position),
      ...Array.from({ length: 7 }, (_, index) => getDeadWallTileTransform(index * 2).position),
    ];
    for (let first = 0; first < stackPositions.length; first += 1) {
      for (let second = first + 1; second < stackPositions.length; second += 1) {
        const dx = stackPositions[first][0] - stackPositions[second][0];
        const dz = stackPositions[first][2] - stackPositions[second][2];
        expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(MAHJONG_TILE_DIMENSIONS.width);
      }
    }
  });
});
