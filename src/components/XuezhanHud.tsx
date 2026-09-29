import type { XzState } from '../game/xuezhan/types';
import type { PlayerState } from '../game/types';
import type { PlayerProfile } from '../profile/playerProfile';
import { Table3DHudView, Table3DCentralHudView } from '../presentation3d/Table3DHud';
import { TableCenterView } from './game/TableCenter';
const positions = ['south', 'east', 'north', 'west'] as const;
const slots = ['bottom', 'right', 'top', 'left'] as const;
const names = ['你', '右家', '对家', '左家'];
/** Consume the formal seat/card system, with the top card centered on its seat anchor. */
export function XuezhanHud({ state, players, profile }: { state: XzState; players: PlayerState[]; profile?: PlayerProfile }) {
  return <Table3DHudView playerProfile={profile} tsumoGiriDisplayEnabled={false} players={players.map(p => ({
    player: p, position: positions[p.id], anchorCentered: p.id === 2,
    status: <span className="table-3d-player-copy">{state.players[p.id].won !== null ? `第${state.players[p.id].won}胡` : state.players[p.id].missing === null ? state.config.rules.missing === 'dynamic' ? '自由打缺' : '待定缺' : `缺${['万', '筒', '条'][state.players[p.id].missing!]}`} · {p.score}分</span>,
  }))} />;
}

/** Read-only projection of the match state; no scoring or action decisions here. */
export function XuezhanCenter({ state: s }: { state: XzState }) {
  const exchange = s.config.rules.exchange === 0 ? '不换牌' : s.phase === 'exchange' ? `换${s.config.rules.exchange}张 ${Object.keys(s.exchanges).length}/4` : '换牌完成';
  const missing = s.config.rules.missing === 'dynamic' ? '自由打缺' : s.phase === 'exchange' ? '待定缺' : s.phase === 'missing' ? `定缺 ${Object.keys(s.declarations).length}/4` : '定缺完成';
  return <Table3DCentralHudView><div className="xz-center">
    <TableCenterView scores={s.players.map(p => ({ playerId: p.id, className: `center-score--${positions[p.id]}`, slot: slots[p.id], score: p.score, wind: 'east', current: s.current === p.id && s.phase !== 'ended', dealer: s.dealer === p.id,
      label: <span>{s.dealer === p.id && <b className="dealer-marker">庄</b>}{names[p.id]}{p.won !== null && <span className="xz-center-rank">第{p.won}胡</span>}</span>,
    }))} roundLabel="血战到底" remainingLabel={null}>
      <span>第{s.handNumber}/{s.config.rules.rounds}局</span>
      <span>余{s.wall.length} · 活跃{s.players.filter(p => p.won === null).length}</span>
    </TableCenterView>
    <div className="xz-center-stage"><span>{s.phase === 'ended' ? `${s.results.find(r => r.hand === s.handNumber)?.reason === 'wall' ? '流局清算' : '本局结束'} · 见账本` : `${exchange} · ${missing}`}</span></div>
  </div></Table3DCentralHudView>;
}
