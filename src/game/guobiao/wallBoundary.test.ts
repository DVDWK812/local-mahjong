import { describe, expect, it } from 'vitest';
import { applyGb, assertGbConservation, defaultGbAction, gbRemaining, legalGbActions, scoreGbPlayer } from './engine';
import { gbFixture } from './scenarios';
import type { GbState } from './types';

/** Allocate every removed wall instance to a public zone; retain a real, unique head-to-tail suffix. */
function retainWall(s: GbState, retained: number[]): GbState {
  const available = s.wall.order.slice(s.wall.head, s.wall.tail + 1);
  expect(retained.every(i => available.includes(i))).toBe(true);
  for (const index of available.filter(i => !retained.includes(i))) {
    if (s.wall.tiles[index].kind === 'flower') s.players[3].flowers.push(index);
    else s.players[3].river.push({ index, claimed: false, tsumogiri: false });
  }
  s.wall.order = [...s.wall.order.filter(i => !retained.includes(i)), ...retained];
  s.wall.head = 144 - retained.length;
  s.wall.tail = 143;
  assertGbConservation(s);
  return s;
}
function passAll(initial: GbState): GbState {
  let s = initial;
  for (const id of initial.response?.eligible ?? []) {
    const pass = legalGbActions(s, id).find(a => a.type === 'pass');
    expect(pass).toBeDefined();
    s = applyGb(s, id, pass!);
  }
  return s;
}
const flowersInWall = (s: GbState) => s.wall.order.slice(s.wall.head, s.wall.tail + 1).filter(i => s.wall.tiles[i].kind === 'flower');
const kongRoot = () => gbFixture({
  0: { hand: '1111m 234m 567p 789s 2p' },
  1: { hand: '123p 456s 789s EE NN' },
  2: { hand: '789m 789p 123s FF CC' },
  3: { hand: '456m 456p 789p SS WW' },
});

describe('GB 牌尾补花与杠补独立边界', () => {
  it.each([1, 2])('牌尾仅剩%i花：公开完整链后零支付流局，无虚构补牌', count => {
    const root = gbFixture({});
    const flowerIds = flowersInWall(root).slice(0, count);
    retainWall(root, flowerIds);
    const before = root.players[1].flowers.length;
    const s = passAll(applyGb(root, 0, defaultGbAction(root, 0)!));
    expect(s.result?.kind).toBe('draw');
    expect(s.players[1].flowers.length).toBe(before + count);
    expect(s.events.filter(e => e.type === 'flower').map(e => e.source)).toEqual(count === 1 ? ['live'] : ['live', 'flower']);
    expect(s.events.some(e => e.type === 'draw')).toBe(false);
    expect(s.result?.deltas).toEqual([0, 0, 0, 0]);
    expect(s.ledger).toEqual([]);
    expect(gbRemaining(s)).toBe(0);
    assertGbConservation(s);
  });

  it('暗杠补牌遇花：实际普通牌来源为flower，不计杠上开花', () => {
    const root = kongRoot();
    const available = root.wall.order.slice(root.wall.head, root.wall.tail + 1);
    const flower = flowersInWall(root)[0];
    const replacement = available.find(i => root.wall.tiles[i].kind === 'regular' && root.wall.tiles[i].id === 10)!;
    const head = available.find(i => i !== replacement && root.wall.tiles[i].kind === 'regular')!;
    retainWall(root, [head, replacement, flower]);
    const kan = legalGbActions(root, 0).find(a => a.type === 'ankan' && a.tile === 0)!;
    expect(kan).toBeDefined();
    const s = applyGb(root, 0, kan);
    expect(s.players[0].drawn).toBe(replacement);
    expect(s.players[0].source).toBe('flower');
    expect(s.events.filter(e => e.type === 'flower' || e.type === 'draw').map(e => [e.type, e.source])).toEqual([['flower', 'kong'], ['draw', 'flower']]);
    expect(gbRemaining(s)).toBe(1);
    const score = scoreGbPlayer(s, 0, replacement, null);
    expect(score.handShapeValid).toBe(true);
    expect(score.canHu).toBe(true);
    // 不求人4 + 暗杠2 + 幺九刻1 + 无字1 + 单吊将1；花分不补和牌门槛。
    expect(score.nonFlowerFan).toBe(9);
    expect(score.flowerFan).toBe(1);
    expect(score.totalFan).toBe(10);
    expect(score.fanItems.some(f => f.id === 'OUT_WITH_REPLACEMENT_TILE')).toBe(false);
    assertGbConservation(s);
  });

  it('暗杠后仅剩花：保留一次杠和公开花，不能补常规牌则流局', () => {
    const root = kongRoot();
    const flower = flowersInWall(root)[0];
    retainWall(root, [flower]);
    const kan = legalGbActions(root, 0).find(a => a.type === 'ankan' && a.tile === 0)!;
    const s = applyGb(root, 0, kan);
    expect(s.result?.kind).toBe('draw');
    expect(s.players[0].melds[0].kind).toBe('ankan');
    expect(s.players[0].flowers).toEqual([flower]);
    expect(s.players[0].drawn).toBeNull();
    expect(s.events.filter(e => e.type === 'kan')).toHaveLength(1);
    expect(s.events.filter(e => e.type === 'flower').map(e => e.source)).toEqual(['kong']);
    expect(s.events.some(e => e.type === 'draw')).toBe(false);
    expect(s.ledger).toEqual([]);
    expect(s.commands).toHaveLength(1);
    assertGbConservation(s);
  });
});
