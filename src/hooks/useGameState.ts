import { useState } from 'react';
import type { GameState } from '../game/types';

export function useGameState(factory: () => GameState) {
  const [gameState, setGameState] = useState<GameState>(() => factory());

  return {
    gameState,
    setGameState,
  };
}
