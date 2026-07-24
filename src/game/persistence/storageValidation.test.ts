import { describe, expect, it } from 'vitest';
import { validateSavedMatch } from './storageValidation';
import { sampleSavedMatch } from './saveTestUtils';

describe('storageValidation', () => {
  it('accepts a valid save and rejects structural mismatches', () => {
    expect(() => validateSavedMatch(sampleSavedMatch())).not.toThrow();
    expect(() => validateSavedMatch({ ...sampleSavedMatch(), saveId: '' })).toThrow(/saveId/);
    const mismatched = sampleSavedMatch();
    mismatched.gameState = { ...mismatched.gameState!, dealer: 1 };
    expect(() => validateSavedMatch(mismatched)).toThrow(/dealer/);
  });
});
