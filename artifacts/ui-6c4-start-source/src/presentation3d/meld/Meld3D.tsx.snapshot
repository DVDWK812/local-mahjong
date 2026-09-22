import { getMeldTileTransforms } from '../coordinates/sceneTransforms';
import type { SeatSceneState } from '../sceneState/tableSceneTypes';
import { TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';
import { Tile3D } from '../tile/Tile3D';
import type { TileVisualSemanticContext } from '../../presentation/table/tileVisualSemantics';

export function Meld3D({ seatState, hiddenTileKeys, visualContext }: Readonly<{
  seatState: SeatSceneState;
  hiddenTileKeys?: ReadonlySet<string>;
  visualContext?: TileVisualSemanticContext;
}>) {
  const transforms = getMeldTileTransforms(seatState.seat, seatState.melds);
  return (
    <group name={`meld-${seatState.seat}`}>
      {seatState.melds.flatMap((meld, meldIndex) => {
        return meld.tiles.map((tile, tileIndex) => {
          if (hiddenTileKeys?.has(tile.key)) return null;
          const transform = transforms[meldIndex][tileIndex];
          return (
            <Tile3D
              ownerPlayerId={seatState.playerId}
              key={tile.key}
              tile={tile.tile}
              faceState={tile.faceState}
              orientation={tile.orientation}
              position={transform.position}
              rotationY={transform.rotationY}
              tileScale={TABLE_PRESENTATION_TUNING.tileScale.meld}
              doraSweepKey={tile.key}
              visualContext={visualContext}
            />
          );
        });
      })}
    </group>
  );
}
