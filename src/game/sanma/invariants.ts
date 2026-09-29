import { snapshotSanmaConfig } from './config';
import { assertWall } from './wall';
import { participantId } from './engine';
import { SANMA_SEATS, type SanmaState } from './types';

export function assertSanma(s: SanmaState): void {
  snapshotSanmaConfig(s.config); assertWall(s.wall);
  if (s.players.length !== 3 || s.players.some((p, i) => p.id !== i || p.participantId !== participantId(i as 0 | 1 | 2))) throw new Error('三人身份不一致');
  if (!SANMA_SEATS.includes(s.current) || !SANMA_SEATS.includes(s.dealer) || !['east', 'south', 'west'].includes(s.roundWind) || ![1, 2, 3].includes(s.handNumber)) throw new Error('三人局次无效');
  if (!Number.isSafeInteger(s.pot) || s.pot < 0 || s.pot % 1000 || s.players.some(p => !Number.isSafeInteger(p.score)) || s.players.reduce((n, p) => n + p.score, s.pot) !== s.config.startingPoints * 3) throw new Error('三人点棒与供托不守恒');
  const owned = s.players.flatMap(p => [...p.hand, ...p.north, ...p.melds.flatMap(m => m.tiles), ...p.river.filter(r => !r.claimed).map(r => r.index)]);
  if (owned.length !== s.wall.used.length || new Set(owned).size !== owned.length || owned.some(i => !s.wall.used.includes(i))) throw new Error('三人牌实例丢失或重复所有权');
  let kans = 0;
  for (const p of s.players) {
    if (p.drawn !== null && !p.hand.includes(p.drawn)) throw new Error('摸入牌不属于手牌');
    if (p.north.some(i => s.wall.tiles[i].id !== 30) || p.north.length > 4) throw new Error('拔北区非法');
    for (const m of p.melds) {
      if (!['pon', 'ankan', 'minkan', 'kakan'].includes(m.kind) || m.tiles.length !== (m.kind === 'pon' ? 3 : 4) || new Set(m.tiles.map(i => s.wall.tiles[i].id)).size !== 1) throw new Error('三人副露非法');
      if (m.kind !== 'pon') kans++;
      if (m.kind === 'ankan' ? m.called !== null : m.called === null || !m.tiles.includes(m.called) || !s.players[m.from].river.some(r => r.index === m.called && r.claimed)) throw new Error('鸣牌来源非法');
    }
    const expected = 13 - p.melds.length * 3 + (p.drawn !== null || s.phase === 'turn' && s.current === p.id ? 1 : 0);
    if (p.hand.length !== expected) throw new Error(`玩家${p.id}阶段牌数错误：${p.hand.length}/${expected}`);
    for (const r of p.river.filter(r => r.claimed)) if (!s.players.some(q => q.melds.some(m => m.called === r.index && m.from === p.id))) throw new Error('已鸣牌河缺少归属');
  }
  if (kans !== s.kanCount || kans > 4 || s.wall.replacementCount !== kans + s.players.reduce((n, p) => n + p.north.length, 0)) throw new Error('杠／拔北补牌计数不一致');
  if ((s.phase === 'response') !== (s.response !== null) || (s.phase === 'ended') !== (s.result !== null) || s.completed && !s.result) throw new Error('响应或结算阶段不一致');
  if (s.response) {
    const r = s.response;
    if (r.actor !== s.current || !s.wall.used.includes(r.tile) || Object.keys(r.eligible).some(id => Number(id) === r.actor || !SANMA_SEATS.includes(Number(id) as 0 | 1 | 2))
      || Object.entries(r.choices).some(([id, a]) => !r.eligible[Number(id) as 0 | 1 | 2]?.some(v => JSON.stringify(v) === JSON.stringify(a)))) throw new Error('响应快照损坏');
  }
  const scores = SANMA_SEATS.map(() => s.config.startingPoints); let pot = 0;
  s.ledger.forEach((e, i) => {
    if (e.id !== i + 1 || !Number.isSafeInteger(e.amount) || e.amount <= 0 || ![0, 1, 2, 'pot'].includes(e.from) || ![0, 1, 2, 'pot'].includes(e.to)) throw new Error('账本记录损坏');
    if (e.from === 'pot') pot -= e.amount; else scores[e.from] -= e.amount;
    if (e.to === 'pot') pot += e.amount; else scores[e.to] += e.amount;
    if (pot < 0) throw new Error('供托重复领取');
  });
  if (pot !== s.pot || scores.some((v, i) => v !== s.players[i].score)) throw new Error('账本无法重建点棒');
}
