import { describe, expect, it } from 'vitest';
import { createMatch } from './matchEngine';
import { advanceRoundPosition, isExtraRound, isScheduledFinalRound, roundLabel, seatWindForPlayer } from './roundTransition';

describe('round transition helpers', () => {
  it('formats round labels and dynamic seat winds', () => {
    expect(roundLabel({ roundWind: 'east', handNumber: 3 })).toBe('东3局');
    expect(seatWindForPlayer(2, 2)).toBe('east');
    expect(seatWindForPlayer(2, 3)).toBe('south');
    expect(seatWindForPlayer(2, 0)).toBe('west');
    expect(seatWindForPlayer(2, 1)).toBe('north');
  });

  it('advances dealer and hand number through east 1 to east 4', () => {
    const east1 = createMatch();
    expect(advanceRoundPosition(east1)).toMatchObject({ dealer: 1, roundWind: 'east', handNumber: 2 });
    const east4 = { ...east1, dealer: 3 as const, handNumber: 4 as const };
    expect(advanceRoundPosition(east4)).toMatchObject({ dealer: 0, roundWind: 'south', handNumber: 1 });
  });

  it('recognizes east-only and hanchan scheduled final rounds', () => {
    expect(isScheduledFinalRound({ ...createMatch({ matchLength: 'east-only' }), handNumber: 4 })).toBe(true);
    expect(isScheduledFinalRound({ ...createMatch({ matchLength: 'hanchan' }), roundWind: 'south', handNumber: 4 })).toBe(true);
  });

  it('uses 庄数 to decide the scheduled final wind', () => {
    expect(isScheduledFinalRound({ ...createMatch({ matchLength: 'east-only', roundCount: 2 }), roundWind: 'south', handNumber: 4 })).toBe(true);
    expect(isScheduledFinalRound({ ...createMatch({ matchLength: 'hanchan', roundCount: 3 }), roundWind: 'west', handNumber: 4 })).toBe(true);
  });

  it('recognizes extra rounds after the scheduled final wind', () => {
    expect(isExtraRound({ ...createMatch({ matchLength: 'east-only' }), roundWind: 'south', handNumber: 1 })).toBe(true);
    expect(isExtraRound({ ...createMatch({ matchLength: 'hanchan' }), roundWind: 'west', handNumber: 1 })).toBe(true);
  });
});
