import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Matrix4 } from 'three';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Table3DHudView } from '../Table3DHud';
import { LocalHandArea } from '../../components/game/LocalHandArea';
import { presentSanma } from '../../presentation/table/sanmaPresentation';
import { getAvatarFrameTuning, getLocalHandScreenOffset } from './tablePresentationTuning';
import { SANMA_UI_TUNING } from './sanmaUiTuning';
import type { SanmaUiTuning } from './sanmaUiTuningTypes';
import { applySanmaUiTuning } from './sanmaUiLayout';
import { regionMatrix, tunePoint } from '../coordinates/regionTuning';
import { getHandTileTransform, getRiverTileTransforms, getMeldTileTransforms, canonicalToSeat, TABLE_SCENE_LAYOUT } from '../coordinates/sceneTransforms';
import { northTileTransform } from '../meld/NorthTiles3D';
import { getFlatTileCenterY } from '../tile/tileGrounding';
import { MAHJONG_TILE_DIMENSIONS } from '../tile/tileGeometry';
import { TABLE_PRESENTATION_TUNING } from './tablePresentationTuning';
import { buildSanmaFormalScene } from '../../presentation/table/sanmaFormalScene';
import { SANMA_CASES, loadSanmaCase, runSanmaCase } from '../../game/sanma/scenarios';
import { resolveTableAnimation3DPlan, resolveTableAnimation3DMotion } from '../animation/tableAnimation3D';
import { DiscardSource3DStore } from '../animation/DiscardSource3D';
import { sanmaSeatMapping } from '../../presentation/table/sanmaPresentation';
import { getCentralConsoleLayout } from './centralConsoleLayout';

const seats = ['bottom', 'right', 'top'] as const;
const load = (id: string) => loadSanmaCase(SANMA_CASES.find(c => c.caseId === id)!);
const copy = (): SanmaUiTuning => structuredClone(SANMA_UI_TUNING);
const changed = (seat: 'bottom' | 'right' | 'top', region: 'river' | 'melds' | 'nuki') => {
  const config = copy();
  return { ...config, seats: { ...config.seats, [seat]: { ...config.seats[seat], [region]: {
    ...config.seats[seat][region], position: { x: 2, y: 0.4, z: -1 }, rotation: { x: 0.1, y: 0.2, z: 0.3 }, scale: 1.1,
  } } } };
};

describe('三麻集中 UI 微调', () => {
  it('只有三个屏幕席位，字段完整且全数字，不创建 left 玩家配置', () => {
    expect(Object.keys(SANMA_UI_TUNING.seats)).toEqual([...seats]);
    for (const seat of seats) {
      expect(Object.keys(SANMA_UI_TUNING.seats[seat])).toEqual(['hand', 'river', 'melds', 'nuki', 'avatar']);
      for (const region of ['river', 'melds', 'nuki'] as const) {
        expect(SANMA_UI_TUNING.seats[seat][region]).toEqual({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 });
      }
    }
    expect(SANMA_UI_TUNING.seats.bottom.hand).toEqual({ x: 0, y: 0, rotation: 0, scale: 1 });
  });

  it.each(['SM-06-DOUBLE', 'SM-09-EIGHT', 'SM-18-LONG-RIVER', 'SM-15-RESTORE', 'SM-16-REPLAY'])('%s 默认保留静态最终 transform 与全部牌实例', id => {
    const state = load(id), raw = buildSanmaFormalScene(state, 0);
    const before = JSON.stringify(raw), configBefore = JSON.stringify(SANMA_UI_TUNING);
    const tuned = applySanmaUiTuning(raw, SANMA_UI_TUNING);
    expect(tuned.seats.left).toBeUndefined();
    for (const seat of seats) {
      const a = raw.seats[seat]!, b = tuned.seats[seat]!;
      expect(b.hand).toBe(a.hand); expect(b.river).toBe(a.river); expect(b.melds).toBe(a.melds); expect(b.north).toBe(a.north);
      for (const region of Object.values(b.regionTuning!)) expect(regionMatrix(region).elements).toEqual(new Matrix4().elements);
      const hand = getHandTileTransform(seat, 0, a.hand.length, false).position;
      expect(tunePoint(hand, b.regionTuning?.hand)).toEqual(hand);
      for (const transform of getRiverTileTransforms(seat, a.river).values()) expect(tunePoint(transform.position, b.regionTuning?.river)).toEqual(transform.position);
      for (const transform of getMeldTileTransforms(seat, a.melds).flat()) expect(tunePoint(transform.position, b.regionTuning?.melds)).toEqual(transform.position);
      // Compare to pre-migration north formula, including all four tiles.
      for (let i = 0; i < 4; i++) {
        const scale = TABLE_PRESENTATION_TUNING.tileScale.meld;
        const old = canonicalToSeat(seat, [-TABLE_SCENE_LAYOUT.meldRightX + i * (MAHJONG_TILE_DIMENSIONS.width + 0.12) * scale, getFlatTileCenterY(scale), TABLE_SCENE_LAYOUT.meldZ + 2.5]);
        expect(northTileTransform(seat, i, b.northLane)).toEqual(old);
      }
    }
    expect(JSON.stringify(raw)).toBe(before); expect(JSON.stringify(SANMA_UI_TUNING)).toBe(configBefore);
  });

  it.each(['river', 'melds', 'nuki'] as const)('只改变 top.%s，包括 nuki/meld 相互隔离', region => {
    const raw = buildSanmaFormalScene(load('SM-09-EIGHT'), 0);
    const baseline = applySanmaUiTuning(raw, SANMA_UI_TUNING), tuned = applySanmaUiTuning(raw, changed('top', region));
    expect(tuned.seats.right).toEqual(baseline.seats.right);
    expect(tuned.seats.bottom).toEqual(baseline.seats.bottom);
    for (const key of ['hand', 'river', 'melds', 'nuki'] as const) {
      if (key !== region) expect(tuned.seats.top!.regionTuning![key]).toEqual(baseline.seats.top!.regionTuning![key]);
    }
    expect(regionMatrix(tuned.seats.top!.regionTuning![region]).elements).not.toEqual(new Matrix4().elements);
    // Scale/rotation pivot stays fixed apart from its explicit translation.
    const r = tuned.seats.top!.regionTuning![region]!;
    tunePoint(r.pivot, r).forEach((v, axis) => expect(v).toBeCloseTo(r.pivot[axis] + [2, .4, -1][axis], 10));
  });

  it.each([0, 1, 2] as const)('观察者%i：配置跟随 screen seat；换庄/恢复身份不交换', viewer => {
    const state = load('SM-18-LONG-RIVER'), tuning = changed('top', 'river');
    for (const source of [state, { ...structuredClone(state), dealer: 2 as const }]) {
      const scene = applySanmaUiTuning(buildSanmaFormalScene(source, viewer), tuning);
      const mapping = sanmaSeatMapping(viewer);
      expect(scene.seats.top!.regionTuning!.river!.offset).toBe(tuning.seats.top.river);
      expect(scene.seats.bottom!.playerId).toBe(viewer);
      expect(mapping.map(m => m.seat)).toEqual([...seats]);
      expect(scene.seats.top!.playerId).toBe((viewer + 2) % 3);
      expect(scene.seats.left).toBeUndefined();
    }
  });

  it.each(seats)('%s 拔北动画落点/旋转/缩放与调后静态矩阵相同', seat => {
    const state = runSanmaCase(SANMA_CASES.find(c => c.caseId === 'SM-09-EIGHT')!).state;
    const scene = applySanmaUiTuning(buildSanmaFormalScene(state, 0), changed(seat, 'nuki'));
    // Fixture actor0 owns the north tiles; remap observer to place it at each screen seat.
    const viewer = seat === 'bottom' ? 0 : seat === 'right' ? 2 : 1;
    const mapped = applySanmaUiTuning(buildSanmaFormalScene(state, viewer), changed(seat, 'nuki'));
    const owner = mapped.seats[seat]!, tile = state.wall.tiles[state.players[owner.playerId].north[0]];
    const plan = resolveTableAnimation3DPlan({ type: 'north_committed', eventId: 'tuning-north', sequence: 1,
      playerId: owner.playerId, tile, sourceIndex: 0, sourceCount: 14 }, mapped, new DiscardSource3DStore(), 'test');
    expect(plan).not.toBeNull();
    const motion = resolveTableAnimation3DMotion(plan!, 'release', 1);
    const expected = tunePoint(northTileTransform(seat, 0, scene.seats.bottom!.northLane).position, owner.regionTuning!.nuki);
    motion.tilePosition.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 10));
    expect(motion.tileScale).toBeCloseTo(TABLE_PRESENTATION_TUNING.tileScale.meld * 1.1);
    expect(motion.tileQuaternion).toHaveLength(4);
  });

  it('计分区增量仅留在三麻投影；共享 HUD resolver 不变', () => {
    const raw = buildSanmaFormalScene(load('SM-15-RESTORE'), 0), before = getCentralConsoleLayout();
    const tuning = { ...copy(), center: { scoreHud: { x: 1, y: 2, z: 3, scale: 1.2 } } };
    expect(applySanmaUiTuning(raw, tuning).scoreHudTuning).toEqual(tuning.center.scoreHud);
    expect(raw.scoreHudTuning).toBeUndefined();
    expect(getCentralConsoleLayout()).toEqual(before);
  });

  it('DOM 头像及本家手牌最终偏移叠加基线，不替换响应式尺寸', () => {
    const view = presentSanma(load('SM-15-RESTORE'), 0);
    const frame = getAvatarFrameTuning('top'), local = getLocalHandScreenOffset();
    const html = renderToStaticMarkup(createElement(Table3DHudView, { players: [{
      position: 'north', player: view.players[2], tuning: { x: 31, y: -17, scale: 1.2 },
    }] }));
    expect(html).toContain('--avatar-frame-offset-x:' + (frame.x + 31) + 'px');
    expect(html).toContain('--avatar-frame-offset-y:' + (frame.y - 17) + 'px');
    expect(html).toContain('--avatar-frame-size:' + (frame.size * 1.2));
    const hand = renderToStaticMarkup(createElement(LocalHandArea, {
      player: view.player, isCurrent: false, canDiscard: false, onDiscard: () => undefined, screenSpaceOverlay: true,
      screenTuning: { x: 31, y: -17, rotation: .2, scale: 1.1 },
    }));
    expect(hand).toContain('--local-hand-tuning-x:' + (local.x + 31) + 'px');
    expect(hand).toContain('--local-hand-tuning-y:' + (local.y - 17) + 'px');
    expect(hand).toContain('rotate:0.2rad'); expect(hand).toContain('scale:1.1');
  });

  it.each(['right', 'top'] as const)('%s 手牌可独立改变三轴旋转和缩放，牌河/另一家不变', seat => {
    const tuning = copy(), raw = buildSanmaFormalScene(load('SM-15-RESTORE'), 0);
    const config = { ...tuning, seats: { ...tuning.seats, [seat]: { ...tuning.seats[seat], hand: {
      position: { x: 2, y: 1, z: -1 }, rotation: { x: .2, y: .3, z: -.1 }, scale: 1.15,
    } } } };
    const scene = applySanmaUiTuning(raw, config), baseline = applySanmaUiTuning(raw, tuning);
    expect(scene.seats[seat]!.regionTuning!.river).toEqual(baseline.seats[seat]!.regionTuning!.river);
    expect(scene.seats[seat === 'top' ? 'right' : 'top']).toEqual(baseline.seats[seat === 'top' ? 'right' : 'top']);
    const hand = scene.seats[seat]!.regionTuning!.hand!;
    expect(tunePoint(hand.pivot, hand)).not.toEqual(hand.pivot);
    expect(regionMatrix(hand).determinant()).toBeCloseTo(1.15 ** 3);
  });

  it('只有三麻 controller 导入配置，四人/17步/血战及共享 resolver 不读取配置', () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap(name => name.includes('.') ? [resolve(dir, name)] : files(resolve(dir, name)));
    const consumers = files(resolve('src')).filter(p => /\.tsx?$/.test(p) && !p.includes('.test.') && !p.endsWith('sanmaUiTuning.ts'))
      .filter(p => /import\s+.*SANMA_UI_TUNING.*from/.test(readFileSync(p, 'utf8')));
    expect(consumers.map(p => p.split('\\').join('/').split('/src/')[1])).toEqual(['components/SanmaScreen.tsx']);
    const scene = readFileSync(resolve('src/presentation3d/Table3DScene.tsx'), 'utf8');
    for (const region of ['hand', 'river', 'melds', 'nuki']) expect(scene).toContain('tuning={seatState.regionTuning?.' + region + '}');
    expect(scene).toContain('tuning={sceneState.scoreHudTuning}');
  });
});
