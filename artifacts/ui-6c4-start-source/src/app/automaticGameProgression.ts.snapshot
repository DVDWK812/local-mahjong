import { advanceAIAction } from '../game/ai';
import { discardTile, drawTile } from '../game/engine';
import { hasDrawAction } from '../game/interaction';
import type { GameState } from '../game/types';

export function advanceAutomaticGameState(gameState: GameState): GameState {
  if (gameState.currentPlayer === 0 && gameState.phase === 'draw') {
    return drawTile(gameState, { settleTsumo: false });
  }
  if (
    gameState.currentPlayer === 0
    && gameState.phase === 'discard'
    && gameState.players[0].riichi
    && gameState.players[0].drawnTile
    && !hasDrawAction(gameState, 0)
  ) {
    return discardTile(gameState, 0, gameState.players[0].drawnTile.instanceId);
  }
  return advanceAIAction(gameState);
}
