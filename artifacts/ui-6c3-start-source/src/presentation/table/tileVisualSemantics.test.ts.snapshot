import { describe, expect, it } from 'vitest';
import { getTileRank, getTileSuit } from '../../game/tileUtils';
import type { Tile, TileId } from '../../game/types';
import {
  EMPTY_TILE_VISUAL_SEMANTICS,
  resolveTileDoraVisualKind,
  resolveTileVisualSemantics,
} from './tileVisualSemantics';

function tile(id: TileId, red = false): Tile {
  return {
    id,
    suit: getTileSuit(id),
    rank: getTileRank(id),
    red,
    instanceId: `${id}-${red}`,
  };
}

describe('UI-5F.2 shared tile visual semantics', () => {
  it('matches only visible face-up identities and never leaks a concealed tile', () => {
    const context = {
      hoveredTileType: 4 as TileId,
      sameTileHoverEnabled: true,
      doraGlowEnabled: true,
    };
    expect(resolveTileVisualSemantics({ tileId: 4, faceUp: true, context }))
      .toMatchObject({ hoveredMatch: true, dimmedByHoveredMatch: true });
    expect(resolveTileVisualSemantics({ tileId: 4, faceUp: false, context }))
      .toEqual(EMPTY_TILE_VISUAL_SEMANTICS);
    expect(resolveTileVisualSemantics({ tileId: undefined, faceUp: false, context }))
      .toEqual(EMPTY_TILE_VISUAL_SEMANTICS);
  });

  it('uses the shared Dora authority and preserves red/normal/combined distinctions', () => {
    const indicator = tile(3);
    const normalFive = tile(4);
    const redFive = tile(4, true);
    const normalKind = resolveTileDoraVisualKind(normalFive, [indicator]);
    const combinedKind = resolveTileDoraVisualKind(redFive, [indicator]);
    const context = { doraGlowEnabled: true };

    expect(normalKind).toBe('tile--dora');
    expect(combinedKind).toBe('tile--double-dora');
    expect(resolveTileVisualSemantics({
      tileId: normalFive.id,
      faceUp: true,
      doraKind: normalKind,
      context,
    })).toMatchObject({ doraHighlight: true, redDoraHighlight: false, combinedHighlight: false });
    expect(resolveTileVisualSemantics({
      tileId: redFive.id,
      faceUp: true,
      doraKind: combinedKind,
      context,
    })).toMatchObject({ doraHighlight: true, redDoraHighlight: true, combinedHighlight: true });
  });

  it('honors both visual feature switches without weakening tile identity', () => {
    expect(resolveTileVisualSemantics({
      tileId: 4,
      faceUp: true,
      doraKind: 'tile--double-dora',
      context: {
        hoveredTileType: 4,
        sameTileHoverEnabled: false,
        doraGlowEnabled: false,
      },
    })).toEqual(EMPTY_TILE_VISUAL_SEMANTICS);
  });

  it('keeps hover dimming and combined Dora breathing semantics together', () => {
    expect(resolveTileVisualSemantics({
      tileId: 4,
      faceUp: true,
      doraKind: 'tile--double-dora',
      context: {
        hoveredTileType: 4,
        sameTileHoverEnabled: true,
        doraGlowEnabled: true,
      },
    })).toEqual({
      hoveredMatch: true,
      dimmedByHoveredMatch: true,
      doraHighlight: true,
      redDoraHighlight: true,
      combinedHighlight: true,
    });
  });
});
