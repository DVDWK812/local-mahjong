import { expect, it } from 'vitest';
import { presentXz } from '../../presentation/table/xuezhanPresentation';
import { loadXzScenario, xzCases } from './scenarios';
import { applyXz } from './engine';
it('普通隐藏、已胡公开、测试全知各自隔离，公开手牌用共享平放语义', () => {
  let s = loadXzScenario(xzCases().find(t => t.id === 'XZ-TRIPLE')!.scenario);
  expect(presentXz(s).scene.seats.right.hand.every(t => !t.tile)).toBe(true);
  for (const seat of [1, 2, 3] as const) s = applyXz(s, seat, { type: 'win' });
  const publicView = presentXz(s).scene;
  expect(publicView.seats.right.exposedHand).toBe(true); expect(publicView.seats.right.hand.every(t => t.tile !== undefined)).toBe(true);
  expect(presentXz(s, [], false).scene.seats.right.hand.every(t => !t.tile)).toBe(true);
  expect(presentXz(s, [], false, true).scene.seats.right.exposedHand).toBe(true);
  expect(publicView.doraIndicators).toEqual([]); expect(publicView.deadWall).toEqual([]); expect(publicView.wall).toHaveLength(s.wall.length);
  expect(Object.values(publicView.seats).every(v => !v.riichi)).toBe(true);
});
