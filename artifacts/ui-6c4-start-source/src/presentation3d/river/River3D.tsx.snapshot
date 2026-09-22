import { getRiverTileRotationY, getRiverTileTransforms } from '../coordinates/sceneTransforms';
import type { SeatSceneState } from '../sceneState/tableSceneTypes';
import { TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';
import { Tile3D } from '../tile/Tile3D';
import type { TileVisualSemanticContext } from '../../presentation/table/tileVisualSemantics';

export function River3D({ seatState, hiddenTileKeys, winningRiverIndex, visualContext }: Readonly<{
  seatState: SeatSceneState;
  hiddenTileKeys?: ReadonlySet<string>;
  winningRiverIndex?: number;
  visualContext?: TileVisualSemanticContext;
}>) {
  const transforms = getRiverTileTransforms(seatState.seat, seatState.river);
  return (
    <group name={`river-${seatState.seat}`}>
      {seatState.river.filter((tile) => tile.visible).map((tile) => {
        const transform = transforms.get(tile.layoutIndex);
        if (!transform) return null;
        if (hiddenTileKeys?.has(tile.key)) return null;
        const winning = tile.riverIndex === winningRiverIndex;
        const position = winning
          ? [transform.position[0], transform.position[1] + 0.16, transform.position[2]] as const
          : transform.position;
        return (
          <Tile3D
            ownerPlayerId={seatState.playerId}
            key={tile.key}
            tile={tile.tile}
            faceState={tile.faceState}
            orientation="upright"
            position={position}
            rotationY={getRiverTileRotationY(seatState.seat, tile.orientation)}
            objectName={`river-tile-${seatState.seat}-${tile.layoutIndex}`}
            tileScale={TABLE_PRESENTATION_TUNING.tileScale.river}
            doraSweepKey={tile.key}
            visualContext={visualContext}
            metadata={{
              region: 'river',
              seat: seatState.seat,
              riverIndex: tile.riverIndex,
              layoutIndex: tile.layoutIndex,
              winning,
            }}
            emphasized={winning}
          />
        );
      })}
    </group>
  );
}
