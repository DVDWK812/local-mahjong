import type { GameState } from '../game/types';
import { formatShanten, recommendDiscards, shanten, ukeire } from '../game/shanten';
import { getVisibleTileCounts } from '../game/visibility';
import { evaluateWin, potentialYaku, type WinContext } from '../game/scoreCalculator';
import { Tile } from './Tile';

interface AnalysisPanelProps {
  gameState: GameState;
}

export function AnalysisPanel({ gameState }: AnalysisPanelProps) {
  const player = gameState.players[0];
  const visibleCounts = getVisibleTileCounts(gameState).map((count) => count.visible);
  const shantenResult = shanten(player.hand);
  const waits = ukeire(player.hand, visibleCounts);
  const recommendations = recommendDiscards(player.hand, visibleCounts);
  const context = createWinContext(gameState);
  const potential = potentialYaku(player.hand, context);
  const score = evaluateWin(player.hand, context);

  return (
    <section className="analysis-panel">
      <div className="panel-title">
        <strong>牌理分析</strong>
        <span>{formatShanten(shantenResult.best)}</span>
      </div>

      <div className="analysis-grid">
        <div>
          <h2>向听数</h2>
          <p>一般型 {formatShanten(shantenResult.standard)}</p>
          <p>七对子 {formatShanten(shantenResult.sevenPairs)}</p>
          <p>国士 {formatShanten(shantenResult.thirteenOrphans)}</p>
        </div>
        <div>
          <h2>有效牌</h2>
          {waits.length ? (
            <div className="analysis-tile-list" aria-label="有效牌列表">
              {waits.map((tile) => (
                <span key={tile.id} className="analysis-tile-item">
                  <Tile id={tile.id} compact />
                  <em>{tile.remaining}</em>
                </span>
              ))}
            </div>
          ) : (
            <p>暂无直接降向听有效牌</p>
          )}
        </div>
      </div>

      <div className="recommend-list">
        <h2>推荐打牌 Top 3</h2>
        {recommendations.map((item, index) => (
          <article key={item.tileId} className="recommend-row">
            <div className="recommend-tile-title">
              <b>{index + 1}.</b>
              <Tile id={item.tileId} compact />
            </div>
            <span>{formatShanten(item.shanten)} · 有效牌 {item.ukeireCount} 枚</span>
            <p>{item.reasons.join('；')}</p>
          </article>
        ))}
      </div>

      <div className="analysis-grid">
        <div>
          <h2>当前潜在役种</h2>
          <p>{potential.length ? potential.join('、') : '暂无明显役种方向'}</p>
        </div>
        <div>
          <h2>和牌预览</h2>
          {score.isWinning ? (
            <p>
              {score.yaku.map((item) => item.name).join('、') || '仅宝牌无役'} · {score.han} 番 {score.fu} 符 · {formatPoints(score)}
            </p>
          ) : (
            <p>当前手牌尚未和牌</p>
          )}
        </div>
      </div>
    </section>
  );
}

function createWinContext(gameState: GameState): WinContext {
  const player = gameState.players[0];
  const winTile = player.drawnTile ?? player.hand[player.hand.length - 1];
  return {
    winTile,
    isTsumo: true,
    isRiichi: player.riichi,
    isIppatsu: false,
    isMenzen: player.calls.length === 0,
    roundWind: gameState.roundWind,
    seatWind: player.seatWind,
    doraIndicators: gameState.doraIndicators,
    uraDoraIndicators: [],
    honba: gameState.honba,
    riichiSticks: gameState.riichiSticks,
  };
}

function formatPoints(score: ReturnType<typeof evaluateWin>): string {
  if (score.points.ron) return `${score.points.ron} 点`;
  if (score.points.tsumoDealer && score.points.tsumoChild) {
    return `亲 ${score.points.tsumoDealer} / 子 ${score.points.tsumoChild}`;
  }
  if (score.points.tsumoChild) return `每家 ${score.points.tsumoChild}`;
  return `${score.points.total} 点`;
}
