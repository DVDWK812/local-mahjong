import { writeFileSync } from 'node:fs';
import { getChiihouExampleScenario } from '../../src/game/testMode/builtInScenarios';
import { scenarioFromGameState, validateTestScenario } from '../../src/game/testMode/scenario';
import { sortTiles } from '../../src/game/tileUtils';
import { drawTile } from '../../src/game/engine';
import type { PlayerId } from '../../src/game/types';

for (const winner of [0, 1, 2, 3] as PlayerId[]) for (const kind of ['ron', 'tsumo'] as const) {
  const original = getChiihouExampleScenario();
  const state = original.gameState;
  const extra = state.players[0].drawnTile!;
  state.players[0].hand = state.players[0].hand.filter(t => t.instanceId !== extra.instanceId);
  state.players[0].drawnTile = null;
  state.wall.push(extra);
  [state.players[winner].hand, state.players[1].hand] = [state.players[1].hand, state.players[winner].hand];
  state.firstTurnInterrupted = true;
  state.turn = 8;
  state.currentPlayer = winner;
  state.phase = 'draw';
  if (kind === 'ron') {
    const discarder = ((winner + 3) % 4) as PlayerId;
    const win = state.wall.shift()!;
    state.players[discarder].hand.push(win);
    state.players[discarder].hand.sort(sortTiles);
    state.players[discarder].drawnTile = win;
    state.currentPlayer = discarder;
    state.phase = 'discard';
  }
  const scenario = scenarioFromGameState({ id: `UI6A1-${kind}-${winner}`, name: `UI6A.1 ${kind} 玩家${winner + 1}`,
    description: '只用于可见性与生命周期验收；通过正式按钮执行摸牌、弃牌和和牌。',
    ruleConfig: original.ruleConfig, handNumber: 1, gameState: state });
  const result = validateTestScenario(scenario);
  if (!result.valid) throw new Error(JSON.stringify(result.issues));
  writeFileSync(`artifacts/ui-6a1/${kind}-${winner}.json`, JSON.stringify(scenario));
  if (kind === 'tsumo') {
    const ready = scenarioFromGameState({ id: `UI6A1-ready-${winner}`, name: `UI6A.1 摸后玩家${winner + 1}`,
      description: '使用正式 drawTile 得到的摸后场景，避免既有测试模式将普通摸牌误报为牌墙不守恒。',
      ruleConfig: original.ruleConfig, handNumber: 1, gameState: drawTile(state, { settleTsumo: false }) });
    if (!validateTestScenario(ready).valid) throw new Error('Invalid ready scenario');
    writeFileSync(`artifacts/ui-6a1/ready-${winner}.json`, JSON.stringify(ready));
  }
}
