import { expect, it } from 'vitest';
import { resolveHandVisual } from '../../hand/HandVisualController';
import { resolveTsumoSlapMotion } from './tsumoSlapMotion';
import { RON_REVEAL_HOLD_MS } from './WinPresentationController';

it('holds Ron for the requested 2000 scheduler milliseconds', () => expect(RON_REVEAL_HOLD_MS).toBe(2000));
it('has continuous position and velocity through the grasp/carry boundary', () => {
  const before = resolveTsumoSlapMotion(0.25 - 0.0001);
  const contact = resolveTsumoSlapMotion(0.25);
  const after = resolveTsumoSlapMotion(0.25 + 0.0001);
  expect(contact.offsetY - before.offsetY).toBeCloseTo(after.offsetY - contact.offsetY, 5);
  expect(contact.handPhase).toBe('carry'); expect(contact.handProgress).toBe(0);
  expect(resolveTsumoSlapMotion(0).offsetY).toBe(0);
  expect(resolveTsumoSlapMotion(1).offsetY).toBe(-72);
  let previous = 0;
  for (let i = 0; i <= 100; i++) {
    const m = resolveTsumoSlapMotion(i / 100);
    expect(m.offsetY).toBeLessThanOrEqual(previous); previous = m.offsetY;
    const hand = resolveHandVisual({ x: 400, y: 500 + m.offsetY, width: 45 }, 'bottom', m.handPhase, m.handProgress);
    expect(hand.x).toBe(400); expect(hand.y).toBe(500 + m.offsetY);
  }
});
