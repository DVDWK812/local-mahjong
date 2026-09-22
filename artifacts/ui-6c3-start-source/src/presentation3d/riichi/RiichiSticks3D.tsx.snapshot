import type { Table3DSeat } from '../coordinates/seatTransforms';
import type { TableSceneState } from '../sceneState/tableSceneTypes';
import { RiichiStick3D } from './RiichiStick3D';
import type { RiichiStick3DAppearance } from './riichiStickAppearance';
import { useContext } from 'react';
import { TileAppearance3DContext, resolveOwnedAppearance3D } from '../appearance/TileAppearance3DContext';

const SEATS: readonly Table3DSeat[] = ['bottom', 'right', 'top', 'left'];

export function RiichiSticks3D({ sceneState, hiddenSeats, appearance }: Readonly<{
  sceneState: TableSceneState;
  hiddenSeats?: ReadonlySet<Table3DSeat>;
  appearance?: RiichiStick3DAppearance;
}>) {
  const resources = useContext(TileAppearance3DContext);
  return (
    <group name="authoritative-riichi-sticks">
      {resolveVisibleRiichiSeats(sceneState.seats, hiddenSeats)
        .map((seat) => (
          <RiichiStick3D
            key={seat}
            seat={seat}
            appearance={resolveOwnedAppearance3D(resources, sceneState.seats[seat].playerId).riichiStickAppearance ?? appearance}
            raycastDisabled
          />
        ))}
    </group>
  );
}

export function resolveVisibleRiichiSeats(
  seats: Readonly<Record<Table3DSeat, Readonly<{ riichi: boolean }>>>,
  hiddenSeats?: ReadonlySet<Table3DSeat>,
): readonly Table3DSeat[] {
  return SEATS.filter((seat) => seats[seat].riichi && !hiddenSeats?.has(seat));
}
