import { describe, expect, it } from 'vitest';
import { createSeededRandomSource } from '../randomSource';
import { createShuffledWall } from '../wall';
import { getRulePreset } from '../match/matchRules';
import { runSeededRound } from './seededSimulation';

describe('STAB-010 fixed-seed simulation', () => {
  it('same seed produces readable deterministic instance ids and identical wall order', () => {
    const first = createShuffledWall(createSeededRandomSource('wall-seed'));
    const second = createShuffledWall(createSeededRandomSource('wall-seed'));
    expect(first.map(tileSignature)).toEqual(second.map(tileSignature));
    expect(first.every((tile) => tile.instanceId.startsWith('wall-seed-'))).toBe(true);
    expect(new Set(first.map((tile) => tile.instanceId)).size).toBe(136);
  });

  it('different seeds produce a different wall', () => {
    const first = createShuffledWall(createSeededRandomSource('wall-a')).map(tileSignature);
    const second = createShuffledWall(createSeededRandomSource('wall-b')).map(tileSignature);
    expect(first).not.toEqual(second);
  });

  it('same rules, seed and strategy reproduce wall, actions, final state and replay events', () => {
    const rules = getRulePreset('east-round');
    const first = runSeededRound({ seed: 'round-repeat', ruleConfig: rules });
    const second = runSeededRound({ seed: 'round-repeat', ruleConfig: rules });
    expect(first.failure).toBeUndefined();
    expect(second.failure).toBeUndefined();
    expect(first.initialWall).toEqual(second.initialWall);
    expect(first.actions).toEqual(second.actions);
    expect(first.finalState).toEqual(second.finalState);
    expect(first.matchLog.rounds[0].events).toEqual(second.matchLog.rounds[0].events);
    expect(first.invariantChecks.every((step) => step.checks.every((check) => check.passed))).toBe(true);
  });
});

function tileSignature(tile: { id: number; red: boolean; instanceId: string }): string {
  return `${tile.id}:${tile.red ? 1 : 0}:${tile.instanceId}`;
}
