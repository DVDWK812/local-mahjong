import { getSeatTransform, type Table3DSeat } from '../coordinates/seatTransforms';
import { Tile3D } from './Tile3D';
import {
  GALLERY_ROWS,
  GALLERY_ROW_Z,
  GALLERY_TILE_CENTER_Y,
  GALLERY_TILE_SPACING,
  SEAT_SAMPLES,
  SEAT_SAMPLE_TILE_CENTER_Y,
} from './tileGalleryData';

function GalleryRows() {
  return (
    <group position={[0, GALLERY_TILE_CENTER_Y, 0]}>
      {GALLERY_ROWS.map((row, rowIndex) => {
        const offset = ((row.length - 1) * GALLERY_TILE_SPACING) / 2;
        return (
          <group key={GALLERY_ROW_Z[rowIndex]} position={[0, 0, GALLERY_ROW_Z[rowIndex]]}>
            {row.map((item, tileIndex) => (
              <Tile3D
                key={`${rowIndex}-${tileIndex}`}
                tile={item.tile}
                faceState={item.faceState}
                orientation={item.orientation}
                position={[tileIndex * GALLERY_TILE_SPACING - offset, 0, 0]}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}

function FourSeatSamples() {
  return (
    <group position={[0, SEAT_SAMPLE_TILE_CENTER_Y, 0]}>
      {(Object.keys(SEAT_SAMPLES) as Table3DSeat[]).map((seat) => {
        const transform = getSeatTransform(seat);
        const samples = SEAT_SAMPLES[seat];
        const offset = ((samples.length - 1) * GALLERY_TILE_SPACING) / 2;
        return (
          <group key={seat} position={transform.position} rotation={[0, transform.rotationY, 0]}>
            {samples.map((sample, index) => (
              <Tile3D
                key={`${seat}-${sample.id}-${sample.red}`}
                tile={sample}
                position={[index * GALLERY_TILE_SPACING - offset, 0, 0]}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}

export function TileGallery() {
  return (
    <group>
      <GalleryRows />
      <FourSeatSamples />
    </group>
  );
}
