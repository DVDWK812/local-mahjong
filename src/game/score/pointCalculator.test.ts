import { describe, expect, it } from 'vitest';
import { createTile } from '../tileUtils';
import type { WinContext } from '../scoreCalculator';
import { calculatePoints } from './pointCalculator';

function ctx(overrides: Partial<WinContext> = {}): WinContext {
  return {
    winTile: createTile(0, 0),
    isTsumo: false,
    isRiichi: false,
    isIppatsu: false,
    isMenzen: true,
    roundWind: 'east',
    seatWind: 'south',
    doraIndicators: [],
    uraDoraIndicators: [],
    honba: 0,
    riichiSticks: 0,
    ...overrides,
  };
}

describe('pointCalculator - limit and non-limit hands', () => {
  it.each([
    [1, 30, 1000, undefined],
    [2, 30, 2000, undefined],
    [3, 30, 3900, undefined],
    [3, 60, 7700, undefined],
    [4, 30, 7700, undefined],
    [4, 40, 8000, '满贯'],
    [5, 30, 8000, '满贯'],
    [6, 30, 12000, '跳满'],
    [8, 30, 16000, '倍满'],
    [11, 30, 24000, '三倍满'],
  ])('%i han %i fu child ron scores %i', (han, fu, expected, limitName) => {
    const points = calculatePoints(han, fu, ctx());
    expect(points.ron).toBe(expected);
    expect(points.limitName).toBe(limitName);
  });

  it('supports kiriage mangan for 4 han 30 fu and 3 han 60 fu', () => {
    expect(calculatePoints(4, 30, ctx({ ruleConfig: { kiriageMangan: true } })).ron).toBe(8000);
    expect(calculatePoints(3, 60, ctx({ ruleConfig: { kiriageMangan: true } })).ron).toBe(8000);
  });

  it('treats kazoe yakuman according to RuleConfig', () => {
    expect(calculatePoints(13, 30, ctx()).ron).toBe(32000);
    expect(calculatePoints(13, 30, ctx({ ruleConfig: { kazoeYakumanMode: 'sanbaiman' } })).ron).toBe(24000);
    expect(calculatePoints(13, 30, ctx({ ruleConfig: { kazoeYakumanMode: 'disabled' } })).ron).toBe(24000);
  });

  it('scores normal, double, and multiple yakuman', () => {
    expect(calculatePoints(0, 0, ctx(), 1).ron).toBe(32000);
    expect(calculatePoints(0, 0, ctx(), 2).ron).toBe(64000);
    expect(calculatePoints(0, 0, ctx(), 3).ron).toBe(96000);
  });

  it('does not use fu for 5 han and above', () => {
    expect(calculatePoints(5, 30, ctx()).ron).toBe(calculatePoints(5, 110, ctx()).ron);
  });
});

describe('pointCalculator - dealer, tsumo, honba, and sticks', () => {
  it('scores dealer ron', () => {
    expect(calculatePoints(1, 30, ctx({ seatWind: 'east' })).ron).toBe(1500);
  });

  it('scores child ron', () => {
    expect(calculatePoints(1, 30, ctx({ seatWind: 'south' })).ron).toBe(1000);
  });

  it('scores dealer tsumo', () => {
    const points = calculatePoints(1, 30, ctx({ seatWind: 'east', isTsumo: true }));
    expect(points.tsumoChild).toBe(500);
    expect(points.total).toBe(1500);
  });

  it('scores child tsumo', () => {
    const points = calculatePoints(1, 30, ctx({ seatWind: 'south', isTsumo: true }));
    expect(points.tsumoDealer).toBe(500);
    expect(points.tsumoChild).toBe(300);
    expect(points.total).toBe(1100);
  });

  it('adds honba and riichi sticks', () => {
    const points = calculatePoints(1, 30, ctx({ honba: 2, riichiSticks: 1 }));
    expect(points.ron).toBe(2600);
    expect(points.total).toBe(2600);
  });
});
