import type { WorldTuning, DomTuning } from '../coordinates/regionTuning';

export type SanmaScreenSeat = 'bottom' | 'right' | 'top';
type SeatTuning<Hand> = Readonly<{
  hand: Hand;
  river: WorldTuning;
  melds: WorldTuning;
  nuki: WorldTuning;
  avatar: DomTuning;
}>;
export type SanmaUiTuning = Readonly<{
  seats: Readonly<{ bottom: SeatTuning<DomTuning & { readonly rotation: number }>; right: SeatTuning<WorldTuning>; top: SeatTuning<WorldTuning> }>;
  center: Readonly<{ scoreHud: Readonly<{ x: number; y: number; z: number; scale: number }> }>;
  northLane: Readonly<{ radialOffset: number; gap: number }>;
}>;
