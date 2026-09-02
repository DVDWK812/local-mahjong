import {
  getDeadWallTileTransform,
  getWallTileTransform,
} from '../coordinates/sceneTransforms';
import type { TableSceneState } from '../sceneState/tableSceneTypes';
import { Tile3D } from '../tile/Tile3D';

export function Wall3D({ sceneState }: Readonly<{ sceneState: TableSceneState }>) {
  return (
    <group name="wall-and-dead-wall">
      {sceneState.wall.filter((tile) => tile.visible).map((tile) => {
        const transform = getWallTileTransform(tile.slotIndex);
        return (
          <Tile3D
            key={tile.key}
            faceState={tile.faceState}
            orientation={tile.orientation}
            doraSweepKey={tile.key}
            position={transform.position}
            rotationY={transform.rotationY}
          />
        );
      })}
      {sceneState.deadWall.filter((tile) => tile.visible).map((tile) => {
        const transform = getDeadWallTileTransform(tile.slotIndex);
        return (
          <Tile3D
            key={tile.key}
            tile={tile.tile}
            faceState={tile.faceState}
            orientation={tile.orientation}
            doraSweepKey={tile.key}
            position={transform.position}
            rotationY={transform.rotationY}
          />
        );
      })}
    </group>
  );
}
