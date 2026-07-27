import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createTile } from '../../game/tileUtils';
import type { Tile } from '../../game/types';
import { DiscardRiver } from './DiscardRiver';

describe('立直宣言牌被鸣后的牌河显示', () => {
  it('鸣牌留空关闭时隐藏被鸣宣言牌，但下一张实际弃牌仍横置', () => {
    const state = createInitialGameState();
    const claimedDeclaration = { ...createTile(4, 1), claimed: true, isRiichiDiscard: true } as Tile;
    const nextDiscard = { ...createTile(5, 2), isRiichiDiscard: true } as Tile;
    const player = {
      ...state.players[0],
      river: [claimedDeclaration, nextDiscard, createTile(6, 3)],
      riichi: true,
      riichiState: {
        declaredAtTurn: 4,
        ippatsuAvailable: true,
        kind: 'riichi' as const,
        riichiDiscardInstanceId: claimedDeclaration.instanceId,
      },
    };

    const html = renderToStaticMarkup(<DiscardRiver player={player} position="south" />);
    expect((html.match(/riichi-discard-slot/g) ?? [])).toHaveLength(1);
    expect(html).not.toContain('discard-river-tile--claimed');
  });

  it('鸣牌留空开启时被鸣宣言牌保留横牌宽度空当，下一张实际弃牌也横置', () => {
    const state = createInitialGameState();
    const claimedDeclaration = { ...createTile(4, 1), claimed: true, isRiichiDiscard: true } as Tile;
    const nextDiscard = { ...createTile(5, 2), isRiichiDiscard: true } as Tile;
    const player = {
      ...state.players[0],
      river: [claimedDeclaration, nextDiscard],
      riichi: true,
      riichiState: {
        declaredAtTurn: 4,
        ippatsuAvailable: true,
        kind: 'riichi' as const,
        riichiDiscardInstanceId: claimedDeclaration.instanceId,
      },
    };

    const html = renderToStaticMarkup(<DiscardRiver player={player} position="south" preserveClaimedDiscardGap />);
    expect((html.match(/riichi-discard-slot/g) ?? [])).toHaveLength(2);
    expect(html).toContain('discard-river-tile--claimed');
    expect(html).toContain('discard-river-claimed-placeholder');
  });
});
