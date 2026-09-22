import { describe, expect, it } from 'vitest';
import { applyOfficialTestModeAction } from '../../game/testMode/actions';
import { createFourGateFixture, createSeventeenGateFixture, finalGateScenarios, gateAction, isSeventeenGate } from './scenarios';
import { finalGateRoute } from './route';

describe('Final Gate opt-in and fixtures', () => {
  it('requires DEV plus both harness parameters; audio separately opts in', () => {
    for (const search of ['', '?testMode=1', '?qaAudio=1', '?uiFinalGate=1&qaAudio=1']) expect(finalGateRoute(search, true)).toEqual({ enabled: false, audio: false });
    expect(finalGateRoute('?testMode=1&uiFinalGate=1', true)).toEqual({ enabled: true, audio: false });
    expect(finalGateRoute('?testMode=1&uiFinalGate=1&qaAudio=1', true)).toEqual({ enabled: true, audio: true });
    expect(finalGateRoute('?testMode=1&uiFinalGate=1&qaAudio=1', false)).toEqual({ enabled: false, audio: false });
  });
  for (const scenario of finalGateScenarios.filter(item => !isSeventeenGate(item.id))) {
    it(`${scenario.id} executes a real accepted action and independently resets`, () => {
      const state = createFourGateFixture(scenario.id);
      const baseline = JSON.stringify(state);
      const next = applyOfficialTestModeAction(state, gateAction(scenario.id, state));
      expect(next).not.toEqual(state);
      expect(JSON.stringify(state)).toBe(baseline);
      expect(createFourGateFixture(scenario.id)).toEqual(state);
      if (scenario.id === 'AV-14') {
        expect(next.phase).toBe('round-ended');
        expect(next.result?.type).toBe('ron');
        expect(next.players[0].river).toHaveLength(1);
      }
      if (scenario.id === 'AV-15') expect(next.result?.type).toBe('tsumo');
      if (scenario.id === 'AV-09' || scenario.id === 'AV-10') expect(next.players[1].calls).toHaveLength(1);
    });
  }
  for (const scenario of finalGateScenarios.filter(item => isSeventeenGate(item.id))) {
    it(`${scenario.id} creates a fresh deterministic seventeen-step fixture`, () => {
      const state = createSeventeenGateFixture(scenario.id);
      expect(state).toEqual(createSeventeenGateFixture(scenario.id));
      if (scenario.id === 'VIS-01' || scenario.id === 'VIS-03') {
        expect(state.players.map(player => player.discardedTiles.length)).toEqual([17, 17]);
        expect(state.result?.type).toBe('draw');
      }
      if (scenario.id === 'VIS-02' || scenario.id === 'VIS-04') expect(state.players.map(player => player.discardedTiles.length)).toEqual([12, 12]);
    });
  }
});
