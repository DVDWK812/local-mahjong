import { getDoraIndicatorTransform, resolveDora3DSlot } from './doraLayout';
import type { DoraIndicatorSlot } from '../../presentation/table/TablePresentationContract';
import { Tile3D } from '../tile/Tile3D';

export function Dora3D({ slots }: Readonly<{ slots: readonly DoraIndicatorSlot[] }>) {
  const revealedCount = slots.filter((slot) => slot.state === 'revealed').length;
  return (
    <group
      name="dora-indicators"
      userData={{ region: 'dora', slotCount: slots.length, revealedCount }}
    >
      {slots.map((slot) => {
        const transform = getDoraIndicatorTransform(slot.index, slots.length);
        const revealed = slot.state === 'revealed';
        const presentation = resolveDora3DSlot(slot);
        return (
          <Tile3D
            key={revealed ? slot.tile.instanceId : `dora-back-${slot.index}`}
            tile={presentation.tile}
            faceState={presentation.faceState}
            orientation="upright"
            doraSweepKey={revealed ? `dora-${slot.tile.instanceId}` : undefined}
            position={transform.position}
            rotationX={transform.rotationX}
            rotationY={transform.rotationY}
            objectName={`dora-indicator-slot-${slot.index}`}
            metadata={revealed ? {
              region: 'dora', state: 'revealed', index: slot.index,
              tileId: slot.tile.id, red: slot.tile.red === true,
            } : { region: 'dora', state: 'hidden', index: slot.index }}
          />
        );
      })}
    </group>
  );
}
