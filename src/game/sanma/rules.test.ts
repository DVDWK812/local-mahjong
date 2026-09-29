import { describe, it, expect } from 'vitest';
import { applySanma, legalSanmaActions } from './engine';
import { fixtureTile, sanmaFixture, NORTH_HAND, NORTH_WAIT, NORTH_WAIT_2, NO_YAKU_NORTH_WAIT } from './fixtures';
import { assertSanma } from './invariants';
import { indicators, scoreSanma } from './scoring';
import type { SanmaAction, SanmaSeat, SanmaState } from './types';
import { sanmaWaits } from './hand';

function move(s: SanmaState, seat: SanmaSeat, action: SanmaAction) { const n = applySanma(s, seat, action); expect(n).not.toBe(s); assertSanma(n); return n; }
function passAll(s: SanmaState) { while (s.response) { const id = ([0, 1, 2] as const).find(i => legalSanmaActions(s, i).some(a => a.type === 'pass'))!; s = move(s, id, { type: 'pass' }); } return s; }
describe('SANMA-2 拔北与原子响应', () => {
  it('未立直可拔手中北；两次补牌不加杠、不翻宝牌、保持身份；先宣言后成立', () => {
    let s = sanmaFixture({ players: { 0: { hand: [...NORTH_HAND.slice(0, -2), 30, 30] } }, replacements: [27, 28] });
    const original = fixtureTile(s, 0, 30), dora = indicators(s).map(t => t.instanceId);
    s = move(s, 0, { type: 'north', tile: original }); s = passAll(s);
    expect(s.players[0].north.map(i => s.wall.tiles[i].instanceId)).toContain(original);
    expect(s.players[0].drawOrigin).toBe('north'); expect(s.kanCount).toBe(0); expect(indicators(s).map(t => t.instanceId)).toEqual(dora);
    s = move(s, 0, { type: 'north', tile: fixtureTile(s, 0, 30) }); s = passAll(s);
    expect(s.players[0].north).toHaveLength(2); expect(s.wall.live).toHaveLength(52);
  });
  it('碰后无摸牌、他人回合、补牌耗尽拒绝拔北', () => {
    const s = sanmaFixture({ drawn: false, players: { 0: { hand: [9, 10, 11, 18, 19, 20, 23, 24, 27, 27, 30], melds: [{ kind: 'pon', id: 31 }] } } });
    expect(legalSanmaActions(s, 0).some(a => a.type === 'north')).toBe(false);
    expect(legalSanmaActions(s, 1)).toEqual([]);
    const exhausted = sanmaFixture({ players: { 0: { hand: NORTH_HAND } }, liveCount: 0 });
    expect(legalSanmaActions(exhausted, 0).some(a => a.type === 'north' || a.type === 'ankan')).toBe(false);
  });
  it('抢北双响收齐才结算，次序无关，无错误拔北或补牌', () => {
    const initial = sanmaFixture({ players: { 0: { hand: NORTH_HAND }, 1: { hand: NORTH_WAIT }, 2: { hand: NORTH_WAIT_2 } }, pot: 1000, honba: 1 });
    const s = move(initial, 0, { type: 'north', tile: fixtureTile(initial, 0, 30) });
    expect(s.phase).toBe('response'); expect(s.players[0].north).toHaveLength(0); expect(s.wall.live.length).toBe(initial.wall.live.length);
    expect(legalSanmaActions(s, 1).map(a => a.type)).toEqual(['ron', 'pass']);
    const first = move(s, 2, { type: 'ron' }); expect(first.result).toBeNull();
    const a = move(first, 1, { type: 'ron' }), b = move(move(s, 1, { type: 'ron' }), 2, { type: 'ron' });
    expect(a.players.map(p => p.score)).toEqual(b.players.map(p => p.score)); expect(a.result?.winners).toHaveLength(2);
    expect(a.wall.replacementCount).toBe(0); expect(a.players[0].north).toHaveLength(0); expect(a.pot).toBe(0);
    expect(a.ledger.filter(l => l.reason === 'sticks')).toHaveLength(1); expect(a.ledger.find(l => l.reason === 'honba')?.to).toBe(1);
    expect(a.result!.winners.every(w => !w.score.yaku.some(y => y.id === 'chankan'))).toBe(true);
  });
  it('无役或振听不能抢北，也不会产生放过合法和牌振听', () => {
    let s = sanmaFixture({ players: { 0: { hand: NORTH_HAND }, 1: { hand: NO_YAKU_NORTH_WAIT }, 2: { hand: NORTH_WAIT_2, temporaryFuriten: true } } });
    s = move(s, 0, { type: 'north', tile: fixtureTile(s, 0, 30) });
    expect(s.phase).toBe('turn'); expect(s.players[1].temporaryFuriten).toBe(false); expect(s.players[0].north).toHaveLength(1);
  });
  it('放过抢北造成临时／立直振听，自己的拔北不是弃牌', () => {
    let s = sanmaFixture({ players: { 0: { hand: NORTH_HAND }, 1: { hand: NORTH_WAIT, riichi: true }, 2: { hand: NORTH_WAIT_2 } } });
    s = move(s, 0, { type: 'north', tile: fixtureTile(s, 0, 30) });
    s = move(s, 1, { type: 'pass' }); s = move(s, 2, { type: 'pass' });
    expect(s.players[1].permanentFuriten).toBe(true); expect(s.players[2].temporaryFuriten).toBe(true);
    expect(s.players[0].river).toHaveLength(0);
  });
  it('立直只可拔摸入北，补北后保持等待；北补牌计岭上、不计海底', () => {
    const hand = [9, 10, 11, 12, 13, 14, 18, 19, 20, 23, 24, 27, 27, 30];
    let s = sanmaFixture({ players: { 0: { hand, riichi: true, ippatsu: true } }, replacements: [25], liveCount: 1 });
    const beforeWaits = [...s.players[0].riichiWaits];
    s = move(s, 0, { type: 'north', tile: fixtureTile(s, 0, 30) }); s = passAll(s);
    const score = scoreSanma(s, 0, s.players[0].drawn!, 'tsumo')!;
    expect(score.yaku.map(y => y.id)).toContain('rinshan-kaihou'); expect(score.yaku.map(y => y.id)).not.toContain('haitei'); expect(score.yaku.map(y => y.id)).not.toContain('ippatsu');
    expect(s.players[0].riichiWaits).toEqual(beforeWaits);
    const retained = sanmaFixture({ players: { 0: { hand: [9, 10, 11, 12, 13, 14, 18, 19, 20, 23, 24, 30, 30, 27], riichi: true } } });
    expect(legalSanmaActions(retained, 0).some(a => a.type === 'north')).toBe(false);
  });
  it('北bonus和西指北普通／里宝牌叠加，普通北仍可留手和牌', () => {
    const s = sanmaFixture({ players: { 0: { hand: [9, 10, 11, 12, 13, 14, 18, 19, 20, 24, 25, 26, 27, 27], north: 2, riichi: true } }, indicators: [29, 29] });
    const score = scoreSanma(s, 0, s.players[0].drawn!, 'tsumo')!;
    expect(score.northDora).toBe(2); expect(score.dora).toBe(2); expect(score.uraDora).toBe(2);
    expect(sanmaWaits(NORTH_WAIT.map(id => ({ ...s.wall.tiles[0], id: id as 0, instanceId: String(id) })))).toContain(30);
  });
});
