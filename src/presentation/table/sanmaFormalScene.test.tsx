import { PerspectiveCamera } from 'three';
import { TABLE_CAMERA } from '../../presentation3d/camera/FixedTableCamera';
import { resolveNorthDomSource } from '../../presentation3d/animation/northDomSource';
import { projectHandContact } from '../../hand/handProjection';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { buildSanmaFormalScene } from './sanmaFormalScene';
import { createSanmaConfig } from '../../game/sanma/config';
import { createSanma, applySanma, legalSanmaActions } from '../../game/sanma/engine';
import { SANMA_CASES, loadSanmaCase, runSanmaCase } from '../../game/sanma/scenarios';
import { SANMA_SEATS } from '../../game/sanma/types';
import { presentSanma, publishSanmaTransition, sanmaHudPosition } from './sanmaPresentation';
import { presentationEventBus, type PresentationEvent } from '../PresentationEventBus';
import { resolveTableAnimation3DPlan } from '../../presentation3d/animation/tableAnimation3D';
import { DiscardSource3DStore } from '../../presentation3d/animation/DiscardSource3D';
import { prepareTableAnimation3DRenderState, transitionTableAnimation3DRenderState } from '../../presentation3d/animation/useTableAnimation3D';
import { Table3DHudView } from '../../presentation3d/Table3DHud';
import { sanmaWinnerRows } from './sanmaResultPresentation';
import { WinnerResultCards } from '../../components/ResultDialog';
import { parseSanmaSave, replaySanma, saveSanma } from '../../game/sanma/persistence';
import { readFileSync } from 'node:fs';
const config = createSanmaConfig();
const fixture = (id: string) => loadSanmaCase(SANMA_CASES.find(c => c.caseId === id)!, config, 308);

describe('real sanma production presentation adapter', () => {
  it.each(SANMA_SEATS)('maps viewer %i to three real seats and conceals both opponents', viewer => {
    const state = createSanma(config, 308), before = JSON.stringify(state), scene = buildSanmaFormalScene(state, viewer);
    expect(Object.keys(scene.seats)).toEqual(['bottom', 'right', 'top']);
    expect(scene.seats.left).toBeUndefined();
    expect(scene.seats.bottom!.playerId).toBe(viewer);
    expect(scene.seats.right!.playerId).toBe((viewer + 1) % 3);
    expect(scene.seats.top!.playerId).toBe((viewer + 2) % 3);
    for (const seat of ['right','top'] as const) expect(scene.seats[seat]!.hand.every(t => t.tile === undefined)).toBe(true);
    expect(scene.wall).toHaveLength(state.wall.live.length); expect(scene.deadWall).toHaveLength(14);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('renders exactly three production avatar frames, with the same slot anchors', () => {
    const view = presentSanma(createSanma(config, 308));
    const html = renderToStaticMarkup(createElement(Table3DHudView, { dora: null, players: view.mapping.map(m => ({ player: view.players[view.participants.find(p => p.id === m.participantId)!.appearanceSlot!], position: sanmaHudPosition(m.seat) })) }));
    expect(html.match(/data-player-slot=/g)).toHaveLength(3);
    expect(html).not.toContain('data-player-slot="left"');
    expect(html).toContain('table-3d-player-avatar');
    expect(html).toContain('--avatar-frame-offset-x');
  });

  it.each(SANMA_SEATS)('whole seats, HUD and north animation follow observer %i after restore/seek', viewer => {
    const root = fixture('SM-09-EIGHT');
    const archive = parseSanmaSave(JSON.stringify(saveSanma(root, undefined, root, true)));
    for (const state of [root, archive.state, replaySanma(archive), { ...root, dealer: ((root.dealer + 1) % 3) as typeof viewer }]) {
      const before = JSON.stringify(state), view = presentSanma(state, viewer), scene = buildSanmaFormalScene(state, viewer);
      expect(Object.keys(scene.seats)).toEqual(['bottom', 'right', 'top']); expect(scene.seats.left).toBeUndefined();
      for (const m of view.mapping) {
        const p = state.players.find(p => p.participantId === m.participantId)!, seat = scene.seats[m.seat]!;
        expect(seat.playerId).toBe(p.id); expect(seat.riichi).toBe(p.riichi);
        expect(seat.river).toHaveLength(p.river.length); expect(seat.melds).toHaveLength(p.melds.length); expect(seat.north).toHaveLength(p.north.length);
        const html = renderToStaticMarkup(createElement(Table3DHudView, { dora:null, players:[{ player:view.players[p.id], position:sanmaHudPosition(m.seat) }] }));
        expect(html).toContain(`data-player-slot="${m.seat}"`);
        if (p.north.length) {
          const tile = state.wall.tiles[p.north[0]];
          const plan = resolveTableAnimation3DPlan({type:'north_committed',eventId:'projection',sequence:1,playerId:p.id,tile,sourceIndex:0,sourceCount:14},scene,new DiscardSource3DStore(),'mapped')!;
          expect(plan.seat).toBe(m.seat); expect(plan.hiddenNorthKey).toContain(tile.instanceId);
        }
      }
      expect(JSON.stringify(state)).toBe(before);
    }
  });
  it('preserves the long river and committed north independently of melds', () => {
    const state = loadSanmaCase(SANMA_CASES.find(c => c.caseId === 'SM-18-LONG-RIVER')!, config, 100);
    const scene = buildSanmaFormalScene(state, 0);
    expect(Math.max(...Object.values(scene.seats).map(s => s!.river.length))).toBeGreaterThan(18);
    for (const seat of Object.values(scene.seats)) expect(seat!.river.filter(t => t.visible)).toHaveLength(state.players[seat!.playerId].river.filter(r => !r.claimed).length);
  });
  it('publishes no committed north or fake kan for a robbed declaration', () => {
    const before = fixture('SM-06-DOUBLE'), events: PresentationEvent[] = [];
    const off = presentationEventBus.subscribe(e => events.push(e));
    const action = legalSanmaActions(before, before.current).find(a => a.type === 'north')!;
    const after = applySanma(before, before.current, action); publishSanmaTransition(before, after); off();
    expect(after.phase).toBe('response');
    expect(events.some(e => e.type === 'north_committed' || e.type === 'meld_declared' || e.type === 'tile_drawn')).toBe(false);
    expect(buildSanmaFormalScene(after, 0).seats.bottom!.north).toHaveLength(0);
  });
  it('committed north uses the existing proxy lifecycle and releases its mask', () => {
    let state = createSanma(config, 308);
    for (let seed = 1; !legalSanmaActions(state, 0).some(a => a.type === 'north'); seed++) state = createSanma(config, seed);
    const events: PresentationEvent[] = []; const off = presentationEventBus.subscribe(e => events.push(e));
    const before = state; state = applySanma(state, 0, legalSanmaActions(state, 0).find(a => a.type === 'north')!); publishSanmaTransition(before, state);
    while (state.phase === 'response') { const seat = SANMA_SEATS.find(id => legalSanmaActions(state, id).some(a => a.type === 'pass'))!; const prev = state; state = applySanma(state, seat, { type:'pass' }); publishSanmaTransition(prev, state); }
    off(); const action = events.find(e => e.type === 'north_committed'); expect(action).toBeDefined();
    if (!action || action.type !== 'north_committed') throw new Error('missing north');
    expect(events.some(e => e.type === 'meld_declared')).toBe(false);
    const plan = resolveTableAnimation3DPlan(action, buildSanmaFormalScene(state, 0), new DiscardSource3DStore(), 'north')!;
    expect(plan.hiddenNorthKey).toContain(action.tile.instanceId);
    const camera = new PerspectiveCamera(TABLE_CAMERA.fov, 1280 / 720, TABLE_CAMERA.near, TABLE_CAMERA.far);
    camera.position.set(...TABLE_CAMERA.position); camera.lookAt(...TABLE_CAMERA.target); camera.updateMatrixWorld();
    const viewport = { left:0, top:0, width:1280, height:720 }, sourceRect = {left:500,top:620,width:48,height:66};
    const anchored = resolveNorthDomSource({...plan,action:{...action,sourceRect}},camera,viewport);
    const contact = projectHandContact(anchored.source,camera,viewport);
    expect(contact.x).toBeCloseTo(524,6); expect(contact.y).toBeCloseTo(653,6);

    const masks = prepareTableAnimation3DRenderState({active:null,hiddenHandKeys:new Set(),hiddenRiverKeys:new Set(),hiddenMeldTileKeys:new Set(),hiddenRiichiSeats:new Set()},plan);
    expect(masks.hiddenNorthKeys?.has(plan.hiddenNorthKey!)).toBe(true);
    expect(transitionTableAnimation3DRenderState(masks,plan,'retreat').hiddenNorthKeys?.size).toBe(0);
  });
  it('projects double winners into the actual production result cards without a fourth row', () => {
    const test = SANMA_CASES.find(c => c.caseId === 'SM-06-DOUBLE')!, state = runSanmaCase(test, config,308).state;
    const rows = sanmaWinnerRows(state); expect(rows).toHaveLength(2);
    const html = renderToStaticMarkup(createElement(WinnerResultCards,{winners:rows,gameState:{dealer:state.dealer,honba:state.honba,doraIndicators:presentSanma(state).dora},resultRiichiSticks:state.pot/1000,northBonus:Object.fromEntries(state.result!.winners.map(w=>[w.winner,w.score.northDora]))}));
    expect(html.match(/data-result-winner=/g)).toHaveLength(2); expect(html).toContain('拔北'); expect(html).toContain('和牌张');
  });
  it('keeps sanma dora identity and kakan stacking in the shared scene contract', () => {
    const state = createSanma(config, 308);
    const indicator = state.wall.tiles.find(t => t.id === 0)!;
    const nine = state.wall.tiles.findIndex(t => t.id === 8);
    state.wall.indicators[0] = state.wall.tiles.indexOf(indicator);
    state.players[0].hand = [nine]; state.players[0].drawn = nine;
    const projected = buildSanmaFormalScene(state, 0);
    expect(projected.seats.bottom!.hand[0].tile?.doraKind).toBe('tile--dora');
    const test = SANMA_CASES.find(c => c.caseId === 'SM-03-KAKAN')!;
    const final = runSanmaCase(test, config, 100).state;
    const kakan = Object.values(buildSanmaFormalScene(final, 0).seats).flatMap(s => s!.melds).find(m => m.callType === 'kakan')!;
    expect(kakan).toBeDefined(); expect(kakan.tiles.filter(t => t.stacked)).toHaveLength(1);
    expect(kakan.tiles.find(t => t.stacked)!.orientation).toBe('upright');
    expect(kakan.tiles.filter(t => t.called)).toHaveLength(1);
  });
  it('both live controllers mount the same full production layout and scene host', () => {
    const read = (p:string) => readFileSync(decodeURIComponent(new URL(p,import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'),'utf8');
    const four = read('../../components/game/GameScreen.tsx'), sanma = read('../../components/SanmaScreen.tsx'), renderer = read('../../presentation3d/TableRenderer.tsx');
    expect(four).toContain('<FormalGameScreen'); expect(sanma).toContain('<FormalGameScreen');
    expect(renderer).toContain('<FormalTable3D'); expect(sanma).toContain('<FormalTable3D');
    expect(sanma).not.toContain('ParticipantTable'); expect(sanma).not.toContain('useSanmaAnimation'); expect(sanma).not.toContain('as GameState');
    expect(sanma.match(/new MatchRuntime/g)).toHaveLength(1); expect(sanma.match(/preparePolicyCommand/g)).toHaveLength(1);
    expect(read('../../components/SanmaTestTab.tsx')).toContain('<SanmaScreen');
    expect(read('../../App.tsx')).toContain('<SanmaScreen');
  });
});
