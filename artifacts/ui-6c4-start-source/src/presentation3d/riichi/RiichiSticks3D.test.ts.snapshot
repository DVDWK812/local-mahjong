import { describe, expect, it } from 'vitest';
import { resolveVisibleRiichiSeats } from './RiichiSticks3D';

describe('UI-5F.2 authoritative riichi stick visibility', () => {
  it('shows every declared seat independently and masks only the active proxy seat', () => {
    const seats = {
      bottom: { riichi: true },
      right: { riichi: false },
      top: { riichi: true },
      left: { riichi: true },
    } as const;
    expect(resolveVisibleRiichiSeats(seats)).toEqual(['bottom', 'top', 'left']);
    expect(resolveVisibleRiichiSeats(seats, new Set(['top']))).toEqual(['bottom', 'left']);
  });

  it('clears all sticks when the next authoritative round resets riichi state', () => {
    const resetSeats = {
      bottom: { riichi: false },
      right: { riichi: false },
      top: { riichi: false },
      left: { riichi: false },
    } as const;
    expect(resolveVisibleRiichiSeats(resetSeats)).toEqual([]);
  });
});
