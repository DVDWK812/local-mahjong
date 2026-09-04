import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import { playerSlotAvatarStore } from '../presentation/appearance/playerSlotAvatars';
import { DEFAULT_AVATAR_ID } from '../profile/avatars';
import { Table3DHud } from './Table3DHud';

describe('3D stable player avatar ownership', () => {
  it('keeps each player avatar across seat rotations without mutating GameState', () => {
    const state = createInitialGameState(); const before = JSON.stringify(state);
    playerSlotAvatarStore.select(1, 'simple-moon');
    playerSlotAvatarStore.select(2, 'simple-fire');
    playerSlotAvatarStore.select(3, 'simple-star');
    for (const slot of [1, 2, 3] as const) playerSlotAvatarStore.setNickname(slot, `测试玩家${slot + 1}`);
    try {
      for (const bottomPlayerId of [0, 1, 2, 3] as const) {
        const html = renderToStaticMarkup(<Table3DHud gameState={state} bottomPlayerId={bottomPlayerId}
          playerProfile={{ nickname: '玩家', avatarId: 'simple-mountain' }} />);
        for (const [id, glyph] of ['⛰️', '🌙', '🔥', '⭐'].entries()) {
          expect(html).toMatch(new RegExp(`data-player-index="${id}"[^]*?player-avatar__glyph">${glyph}`));
        }
        expect(html).toContain('title="玩家"');
        for (const slot of [1, 2, 3] as const) expect(html).toContain(`title="测试玩家${slot + 1}"`);
      }
      expect(JSON.stringify(state)).toBe(before);
    } finally { for (const slot of [1, 2, 3] as const) {
      playerSlotAvatarStore.select(slot, DEFAULT_AVATAR_ID);
      playerSlotAvatarStore.setNickname(slot, `Player ${slot + 1}`);
    } }
  });
});
