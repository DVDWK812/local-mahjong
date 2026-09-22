import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { TABLE_CAMERA } from '../camera/FixedTableCamera';
import { getHandTileTransform, getRiverTileTransforms, getRiverTileRotationY, TABLE_SCENE_LAYOUT } from '../coordinates/sceneTransforms';
import { getHandTileScale, TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';
import { PARTICIPANT_LAYOUTS, participantHandTarget, participantRiverTarget, resolveParticipantLayout } from './participantLayout';
import { presentSeventeenSteps } from './participantPresentation';
import { createSeventeenPresentationFixture } from '../../dev/seventeenPresentationFixtures';
import { DuelHud, DuelCentralHud } from './DuelHud';
import { DEFAULT_APPEARANCE_SETTINGS } from '../../presentation/appearance/appearanceSettings';
import { SeventeenStepsScreen } from '../../components/SeventeenStepsScreen';
import { getRulePreset } from '../../game/match/matchRules';

const mapping = [{ participantId: 'seventeen:0', seat: 'bottom' }, { participantId: 'seventeen:1', seat: 'top' }] as const;
describe('17-step four-player baseline reuse', () => {
  it('references the camera authority and exactly matches all top hands and 17 river transforms/scales', () => {
    expect(PARTICIPANT_LAYOUTS.duel.camera).toBe(TABLE_CAMERA.position);
    expect(PARTICIPANT_LAYOUTS.duel.target).toBe(TABLE_CAMERA.target);
    expect(PARTICIPANT_LAYOUTS.duel.columns).toBe(TABLE_SCENE_LAYOUT.riverColumns);
    const state = createSeventeenPresentationFixture('last-turn');
    const tiles = [...state.players[0].discardedTiles, state.players[0].discardCandidates[0]];
    const inputs = tiles.map((tile, layoutIndex) => ({ layoutIndex, orientation: tile.isRiichiDiscard ? 'sideways' as const : 'upright' as const }));
    for (const seat of ['bottom', 'top'] as const) {
      const standard = getRiverTileTransforms(seat, inputs);
      for (let i = 0; i < 17; i++) expect(participantRiverTarget('duel', seat, i, tiles)).toEqual({ ...standard.get(i), rotationY: getRiverTileRotationY(seat, inputs[i].orientation), tileScale: TABLE_PRESENTATION_TUNING.tileScale.river });
      for (let i = 0; i < 13; i++) expect(participantHandTarget('duel', seat, i, 13)).toEqual({ ...getHandTileTransform(seat, i, 13, false), tileScale: getHandTileScale(seat) });
    }
  });
  it('mounts only actual bottom/top frames with the same vertical frame and stable slot identity', () => {
    const participants = presentSeventeenSteps(createSeventeenPresentationFixture('last-turn')).participants;
    expect(resolveParticipantLayout(participants, mapping, 'duel').map(p => p.participant.appearanceSlot)).toEqual([0, 1]);
    const hud = renderToStaticMarkup(<DuelHud participants={participants} mapping={mapping} settings={DEFAULT_APPEARANCE_SETTINGS} />);
    expect(hud.match(/data-player-index=/g)).toHaveLength(2);
    expect(hud).toContain('data-player-slot="top"');
    expect(hud).toContain('data-player-index="1"');
    expect(hud).toContain('table-3d-player-card--north');
    expect(hud).not.toMatch(/table-3d-player-frame--(east|west)/);
    const central = renderToStaticMarkup(<DuelCentralHud participants={participants} mapping={mapping} label="东1局" />);
    expect(central.match(/data-center-slot=/g)).toHaveLength(2);
    expect(central).toContain('table-3d-console-hud');
    expect(central).not.toContain('25,000');
  });
  it('keeps enlarged fixed tiles in a left panel and candidate actions in two bottom rows', () => {
    const state = createSeventeenPresentationFixture('last-turn');
    const html = renderToStaticMarkup(<SeventeenStepsScreen initialState={state} ruleConfig={getRulePreset('east-round')} onBack={() => {}} />);
    expect(html).toContain('class="seventeen-fixed-hand"');
    expect(html).toContain('seventeen-fixed-grid');
    expect(html).not.toContain('local-hand-area--screen-space');
    const hand = html.slice(html.indexOf('aria-label="固定手牌"'), html.indexOf('aria-label="17步麻将操作区"'));
    expect(hand.match(/<button/g)).toHaveLength(13);
    expect(hand.match(/disabled=""/g)).toHaveLength(13);
    expect(hand).toContain('seventeen-fixed-analysis');
    expect(hand).not.toContain('data-candidate-instance');
    expect(hand).not.toContain('drawn-tile-gap');
    expect(html.match(/data-candidate-instance=/g)).toHaveLength(5);
    expect(html.match(/data-dora-state="revealed"/g)).toHaveLength(state.doraIndicators.length);
    expect(html).not.toContain('data-dora-state="hidden"');
    expect(html).not.toContain('seventeen-steps-board-area');
    const css = readFileSync('src/presentation3d/participants/participantTable.css', 'utf8');
    expect(css).toMatch(/\.seventeen-battle-controls \{[^}]*position: fixed;/);
    expect(css).toContain('grid-template-columns: repeat(11, var(--candidate-tile-width))');
    expect(css).toContain('grid-template-rows: repeat(2, calc(var(--candidate-tile-width) * 1.405))');
    expect(css).toContain('grid-template-columns: repeat(7, var(--fixed-tile-width))');
    expect(css).not.toContain('overflow-x: auto');
    expect(css).not.toContain('minmax(250px, 27%)');
    const scene = readFileSync('src/presentation3d/participants/ParticipantScene.tsx', 'utf8');
    expect(scene).toContain('<FixedTableCamera /><TableEnvironment /><TableLighting />');
    expect(scene).not.toContain('HandAction3D');
  });
  it('keeps all 21 initial candidates separate from the display-only fixed hand', () => {
    const state = createSeventeenPresentationFixture('ron');
    const html = renderToStaticMarkup(<SeventeenStepsScreen initialState={state} ruleConfig={getRulePreset('east-round')} onBack={() => {}} />);
    const candidates = html.slice(html.indexOf('aria-label="弃牌候选池"'));
    expect(candidates.match(/data-candidate-instance=/g)).toHaveLength(21);
    for (const tile of state.players[0].discardCandidates) expect(candidates).toContain(`data-candidate-instance="${tile.instanceId}"`);
    for (const tile of state.players[0].fixedHand) expect(candidates).not.toContain(`data-candidate-instance="${tile.instanceId}"`);
    expect(html).toContain('17步麻将荣和操作');
    const css = readFileSync('src/presentation3d/participants/participantTable.css', 'utf8');
    expect(css).toContain('.seventeen-steps-battle > .game-prompt-layer');
    expect(css).toContain('--fixed-tile-width: clamp(49px, 3.2vw, 61px)');
  });
});
