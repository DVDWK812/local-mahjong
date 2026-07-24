import { roundLabel } from '../game/match/roundTransition';
import type { MatchState } from '../game/match/types';
import type { GameState } from '../game/types';
import { windLabel } from '../game/tileUtils';

interface ScorePanelProps {
  gameState: GameState;
  matchState?: MatchState;
}

const phaseLabels: Record<GameState['phase'], string> = {
  draw: '摸牌',
  discard: '打牌',
  'ron-window': '荣和确认',
  'call-window': '鸣牌窗口',
  'kakan-declaration': '加杠宣告',
  'chankan-window': '抢杠窗口',
  'rinshan-draw': '岭上摸牌',
  'round-ended': '本局结束',
  'exhaustive-draw': '流局',
};

export function ScorePanel({ gameState, matchState }: ScorePanelProps) {
  const current = gameState.players[gameState.currentPlayer];
  const isHumanTurn = gameState.currentPlayer === 0;
  const phaseLabel = phaseLabels[gameState.phase];
  const roundText = matchState ? roundLabel(matchState) : `${windLabel(gameState.roundWind)}场`;

  return (
    <aside className="score-panel">
      <div>
        <h1>日本麻将训练器</h1>
        <p>
          {roundText} · {gameState.honba}本场 · 供托 {gameState.riichiSticks}
        </p>
      </div>
      <dl className="state-list">
        <div>
          <dt>当前</dt>
          <dd>{windLabel(current.seatWind)}家</dd>
        </div>
        <div>
          <dt>控制</dt>
          <dd>{isHumanTurn ? '玩家' : '电脑'}</dd>
        </div>
        <div>
          <dt>阶段</dt>
          <dd>{phaseLabel}</dd>
        </div>
        <div>
          <dt>牌山</dt>
          <dd>{gameState.wall.length} 枚</dd>
        </div>
        <div>
          <dt>巡目</dt>
          <dd>{gameState.turn}</dd>
        </div>
      </dl>
      <div className="turn-banner">
        {gameState.phase === 'exhaustive-draw'
          ? '牌山已空，本局荒牌流局'
          : `轮到 ${windLabel(current.seatWind)}家 ${current.name}，${phaseLabel}`}
      </div>
      <div className="score-list">
        {gameState.players.map((player) => (
          <div key={player.id} className={player.id === gameState.currentPlayer ? 'score-row score-row--active' : 'score-row'}>
            <span>{windLabel(player.seatWind)} {player.name}</span>
            <strong>{player.score.toLocaleString()}</strong>
          </div>
        ))}
      </div>
    </aside>
  );
}
