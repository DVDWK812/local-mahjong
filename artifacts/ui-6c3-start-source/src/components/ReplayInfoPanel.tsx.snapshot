import type { ReplayState } from '../game/replay/types';

interface ReplayInfoPanelProps {
  state: ReplayState;
  debug?: boolean;
}

export function ReplayInfoPanel({ state, debug = false }: ReplayInfoPanelProps) {
  return (
    <section className="replay-info">
      <h3>{state.roundWind} {state.handNumber}局 · {state.honba}本场 · 供托{state.riichiSticks}</h3>
      {state.players.map((player, index) => (
        <p key={index}>Player {index + 1}: {player.score.toLocaleString()} 点 · 河牌 {player.river.length}{debug ? ` · 手牌 ${player.hand.length}` : ''}</p>
      ))}
      {state.lastEvent ? <p>当前事件：{state.lastEvent.type}</p> : null}
    </section>
  );
}
