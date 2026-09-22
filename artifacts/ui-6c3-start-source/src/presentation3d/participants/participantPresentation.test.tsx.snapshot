import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createSeventeenStepsGame, selectFixedTile, confirmBuild, discardCandidate, declareSeventeenStepsRon, passSeventeenStepsRon } from '../../game/seventeenSteps';
import { presentSeventeenSteps } from './participantPresentation';
import { candidateSourceSlot, participantRiverTarget, resolveParticipantLayout } from './participantLayout';
import { ParticipantTable } from './ParticipantTable';
import { previewParticipants } from '../../dev/ParticipantLayoutPreview';
import { createSeventeenPresentationFixture } from '../../dev/seventeenPresentationFixtures';
import { DEFAULT_APPEARANCE_SETTINGS } from '../../presentation/appearance/appearanceSettings';
import { DEFAULT_PLAYER_SLOT_APPEARANCES, resolveHandPackForPlayer } from '../../presentation/appearance/playerSlotAppearance';

describe('17-step participant presentation', () => {
  it('resolves candidate sources by exact instance and never substitutes a fixed-hand tile', () => {
    const rect = { x: 40, y: 500, width: 30, height: 42 };
    const container = { querySelectorAll: (selector: string) => {
      expect(selector).toBe('[data-candidate-instance]');
      return ['same-face-copy-1', 'same-face-copy-2'].map(instanceId => ({ dataset: { candidateInstance: instanceId }, querySelector: () => ({ getBoundingClientRect: () => rect }), getBoundingClientRect: () => ({ ...rect, width: 40 }) }));
    } } as unknown as HTMLElement;
    expect(candidateSourceSlot(container, 'same-face-copy-2')).toEqual({ instanceId: 'same-face-copy-2', index: 1, rect });
    expect(candidateSourceSlot(container, 'fixed-hand-copy')).toBeNull();
  });
  it('preserves build/confirm and only discards a candidate, keeping fixed identities/order/red', () => {
    let state = createSeventeenStepsGame();
    for (const tile of state.players[0].sourceTiles.slice(0, 13)) state = selectFixedTile(state, 0, tile.instanceId);
    state = confirmBuild(state, 0);
    expect(state.phase).toBe('active');
    const before = presentSeventeenSteps(state);
    const tile = state.players[0].discardCandidates[0];
    expect(discardCandidate(state, 0, state.players[0].fixedHand[0].instanceId)).toBe(state);
    const next = discardCandidate(state, 0, tile.instanceId);
    const after = presentSeventeenSteps(next);
    expect(after.participants).toHaveLength(2);
    expect(after.participants[0].fixedHand).toEqual(before.participants[0].fixedHand);
    expect(after.participants[0].discardCandidates).toEqual({ visibility: 'visible', tiles: state.players[0].discardCandidates.slice(1) });
    expect(after.participants[0].discardedTiles[0]).toEqual({ ...tile, isRiichiDiscard: true });
    expect(after.participants[0].remainingSteps).toBe(16);
    expect(next.turnIndex).toBe(state.turnIndex + 1);
    expect(after.currentParticipantId).toBe(`seventeen:${next.currentPlayerId}`);
  });
  it('redacts every hidden tile attribute and swaps visibility, never appearance slot, for another viewer', () => {
    const state = createSeventeenPresentationFixture('last-turn');
    const zero = presentSeventeenSteps(state, 0);
    const one = presentSeventeenSteps(state, 1);
    expect(zero.participants[1].fixedHand).toEqual({ visibility: 'hidden', count: 13 });
    expect(zero.participants[1].discardCandidates).toEqual({ visibility: 'hidden', count: 5 });
    expect(one.participants[0].fixedHand).toEqual({ visibility: 'hidden', count: 13 });
    for (const tile of state.players[1].fixedHand) expect(JSON.stringify(zero.participants[1].fixedHand)).not.toContain(tile.instanceId);
    expect(zero.participants.map(p => [p.id, p.appearanceSlot])).toEqual(one.participants.map(p => [p.id, p.appearanceSlot]));
  });
  it('resolves exactly the explicit participants, rejects placeholders, and retains identity when remapped', () => {
    const participants = previewParticipants(18);
    const mapped = resolveParticipantLayout(participants, [{ participantId: 'preview:2', seat: 'bottom' }, { participantId: 'preview:0', seat: 'left' }, { participantId: 'preview:1', seat: 'right' }], 'three-preview');
    expect(mapped).toHaveLength(3);
    expect(mapped.some(p => p.seat === 'top')).toBe(false);
    expect(mapped[0].participant.appearanceSlot).toBe(2);
    const slots = { ...DEFAULT_PLAYER_SLOT_APPEARANCES, 1: { ...DEFAULT_PLAYER_SLOT_APPEARANCES[1], handAppearance: 'robot' as const } };
    expect(resolveHandPackForPlayer(mapped[2].participant.appearanceSlot, slots, DEFAULT_APPEARANCE_SETTINGS).id).toBe('robot');
    expect(() => resolveParticipantLayout(participants, [{ participantId: 'unused', seat: 'top' }], 'three-preview')).toThrow();
    const duel = presentSeventeenSteps(createSeventeenPresentationFixture('last-turn')).participants;
    expect(resolveParticipantLayout(duel, [{ participantId: 'seventeen:0', seat: 'bottom' }, { participantId: 'seventeen:1', seat: 'top' }], 'duel')[1].participant.appearanceSlot).toBe(1);
  });
  it('places all 18 river tiles without duplicate targets and leaves top unoccupied in three-preview', () => {
    for (const seat of ['bottom', 'right', 'left'] as const) {
      const positions = Array.from({ length: 18 }, (_, i) => participantRiverTarget('three-preview', seat, i).position);
      expect(new Set(positions.map(p => JSON.stringify(p))).size).toBe(18);
      expect(positions.every(p => Math.abs(p[0]) < 18 && Math.abs(p[2]) < 17)).toBe(true);
    }
    expect(() => participantRiverTarget('three-preview', 'top', 0)).toThrow();
  });
  it('keeps authoritative ron and exhaustive draw results without calculating points in presentation', () => {
    const ron = createSeventeenPresentationFixture('ron');
    expect(ron.phase).toBe('ron-window');
    const won = declareSeventeenStepsRon(ron, 0);
    expect(won.result?.type).toBe('ron');
    expect(presentSeventeenSteps(won).result).toBe(won.result);
    let ended = createSeventeenPresentationFixture('last-turn');
    for (let i = 0; i < 2; i++) {
      const player = ended.players[ended.currentPlayerId];
      ended = discardCandidate(ended, player.id, player.discardCandidates[0].instanceId);
      if (ended.pendingRon) ended = passSeventeenStepsRon(ended, ended.pendingRon.winnerId);
    }
    expect(ended.result?.type).toBe('draw');
    expect(presentSeventeenSteps(ended).result).toBe(ended.result);
  });
  it('shows Loading rather than Legacy until full frame and DOM are ready; uses the shared host without animation sources', () => {
    const markup = renderToStaticMarkup(<ParticipantTable participants={previewParticipants(3)} mapping={[{ participantId: 'preview:0', seat: 'bottom' }, { participantId: 'preview:1', seat: 'right' }, { participantId: 'preview:2', seat: 'left' }]} preset="three-preview" sessionKey="test" localReady={false} label="布局预览，非三人玩法" />);
    expect(markup).toContain('正在准备牌桌');
    expect(markup).toContain('data-presentation-revealed="false"');
    expect(markup).not.toContain('mahjong-table');
    const scene = readFileSync('src/presentation3d/participants/ParticipantScene.tsx', 'utf8');
    expect(scene).toContain('<SceneCanvasHost');
    expect(scene).toContain('<SceneContentReady');
    expect(scene).toContain('<TileTextureWarmup');
    for (const forbidden of ['GameState', 'HandAction3D', 'useTableAnimation3D', 'drawnTile', '<Canvas']) expect(scene).not.toContain(forbidden);
    expect(scene).toContain('activePlayerIds={slots}');
    expect(scene).toContain('includeRiichiResources={false}');
  });
});
