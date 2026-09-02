export type Table3DSeat = 'bottom' | 'right' | 'top' | 'left';

export type SeatDirection = Readonly<{ x: number; z: number }>;

export type SeatTransform = Readonly<{
  position: readonly [number, number, number];
  rotationY: number;
  direction: SeatDirection;
}>;

const SEAT_TRANSFORMS: Record<Table3DSeat, SeatTransform> = {
  bottom: {
    position: [0, 0, 4.65],
    rotationY: 0,
    direction: { x: 0, z: -1 },
  },
  right: {
    position: [7.15, 0, 0],
    rotationY: Math.PI / 2,
    direction: { x: -1, z: 0 },
  },
  top: {
    position: [0, 0, -4.65],
    rotationY: Math.PI,
    direction: { x: 0, z: 1 },
  },
  left: {
    position: [-7.15, 0, 0],
    rotationY: -Math.PI / 2,
    direction: { x: 1, z: 0 },
  },
};

export function getSeatTransform(seat: Table3DSeat): SeatTransform {
  return SEAT_TRANSFORMS[seat];
}

export function getSeatRotation(seat: Table3DSeat): number {
  return getSeatTransform(seat).rotationY;
}

export function getSeatDirection(seat: Table3DSeat): SeatDirection {
  return getSeatTransform(seat).direction;
}
