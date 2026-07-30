import type React from 'react';
import type { AbortiveDrawReason, GameState, PlayerId, ResultYaku, Tile as TileModel, WinResultEntry, WinRoundResult } from '../game/types';
import { tileLabel, windLabel } from '../game/tileUtils';
import { PlayerMelds } from './PlayerMelds';
import { Tile as TileView } from './Tile';

interface ResultDialogProps {
  gameState: GameState;
  onReset: () => void;
  doraGlowEnabled?: boolean;
}

interface ResultShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onReset: () => void;
}

interface WinScoreBreakdown {
  handPoints: number;
  honbaBonus: number;
  stickBonus: number;
  total: number;
  paymentNote?: string;
}

function ResultShell({ title, subtitle, children, onReset }: ResultShellProps) {
  return (
    <div className="result-backdrop" role="presentation">
      <section className="result-dialog" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <header className="result-header">
          <div>
            <h2 id="result-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
        </header>
        <div className="result-body">{children}</div>
        <footer className="result-actions">
          <button type="button" onClick={onReset}>继续</button>
        </footer>
      </section>
    </div>
  );
}

function HandPreview({ title, tiles, doraIndicators = [], doraGlowEnabled = true }: { title: string; tiles: TileModel[]; doraIndicators?: TileModel[]; doraGlowEnabled?: boolean }) {
  return (
    <div className="result-hand">
      <span>{title}</span>
      <div className="result-hand-row">
        {tiles.map((tile) => <TileView key={tile.instanceId} tile={tile} compact doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} />)}
      </div>
    </div>
  );
}

function WinHandPreview({ gameState, winner, win, doraGlowEnabled = true }: { gameState: GameState; winner: GameState['players'][number]; win: WinResultEntry; doraGlowEnabled?: boolean }) {
  const concealedTiles = removeWinTileForDisplay(winner.hand, win.winTile, win.winType);
  const uraIndicators = winner.riichi ? activeUraDoraIndicators(gameState) : [];
  return (
    <div className="result-tile-sections" aria-label="和牌牌组">
      <section className="result-tile-section result-concealed-hand">
        <span>手牌</span>
        <div className="result-hand-row" aria-label="手牌">
          {concealedTiles.map((tile) => <TileView key={tile.instanceId} tile={tile} compact doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} />)}
        </div>
      </section>
      <section className="result-tile-section result-winning-tile">
        <span>和牌张</span>
        <div className="result-win-tile" aria-label="和牌张">
          <TileView tile={win.winTile} compact doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} />
        </div>
      </section>
      {winner.calls.length > 0 ? (
        <section className="result-tile-section result-melds" aria-label="副露">
          <span>副露</span>
          <PlayerMelds player={winner} seatClass="result-melds-seat" doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} />
        </section>
      ) : null}
      {uraIndicators.length > 0 ? (
        <section className="result-tile-section result-ura-dora" aria-label="里宝牌">
          <span>里宝牌</span>
          <div className="result-hand-row">
            {uraIndicators.map((tile) => <TileView key={tile.instanceId} tile={tile} compact doraGlowEnabled={false} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function activeUraDoraIndicators(state: GameState): TileModel[] {
  return state.doraIndicators
    .map((_, index) => state.deadWall[9 + index])
    .filter((tile): tile is TileModel => Boolean(tile));
}

function removeWinTileForDisplay(hand: TileModel[], winTile: TileModel, winType: 'tsumo' | 'ron'): TileModel[] {
  if (winType === 'ron') return hand;
  const instanceIndex = hand.findIndex((tile) => tile.instanceId === winTile.instanceId);
  if (instanceIndex !== -1) return hand.filter((_, index) => index !== instanceIndex);
  const idIndex = hand.findIndex((tile) => tile.id === winTile.id);
  return idIndex === -1 ? hand : hand.filter((_, index) => index !== idIndex);
}

function playerNames(gameState: GameState, ids: PlayerId[]): string {
  return ids.length ? ids.map((id) => gameState.players[id].name).join('、') : '无人';
}

function drawReasonLabel(reason: AbortiveDrawReason): string {
  const labels: Record<AbortiveDrawReason, string> = {
    'kyuushu-kyuuhai': '九种九牌',
    'suufon-renda': '四风连打',
    'suucha-riichi': '四家立直',
    'suukan-sanra': '四杠散了',
    sanchahou: '三家和了',
  };
  return labels[reason] ?? '特殊流局';
}

function reconciledYakuRows(win: WinResultEntry): ResultYaku[] {
  if (win.yaku.some((yaku) => yaku.yakuman)) return win.yaku;

  const explicitDoraFields = win.dora !== undefined || win.uraDora !== undefined || win.redDora !== undefined;
  if (!explicitDoraFields) return win.yaku;

  const baseRows = win.yaku.filter((yaku) => !isDoraYakuName(yaku.name));
  return [
    ...baseRows,
    ...doraYakuRows(win),
  ];
}

function isDoraYakuName(name: string): boolean {
  return name === '宝牌' || name === '里宝牌' || name === '赤宝牌';
}

function doraYakuRows(win: WinResultEntry): ResultYaku[] {
  const rows: ResultYaku[] = [];
  if ((win.dora ?? 0) > 0) rows.push({ name: '宝牌', han: win.dora ?? 0 });
  if ((win.uraDora ?? 0) > 0) rows.push({ name: '里宝牌', han: win.uraDora ?? 0 });
  if ((win.redDora ?? 0) > 0) rows.push({ name: '赤宝牌', han: win.redDora ?? 0 });
  return rows;
}

function formatPoints(points: number): string {
  return points.toLocaleString();
}

function limitLabel(win: WinResultEntry): string | null {
  const yakumanValue = win.yaku
    .filter((yaku) => yaku.yakuman)
    .reduce((sum, yaku) => sum + Math.max(1, yaku.han), 0);
  if (yakumanValue > 0) return yakumanValue > 1 ? `${yakumanValue}倍役满` : '役满';
  if (win.han >= 13) return '役满';
  if (win.han >= 11) return '三倍满';
  if (win.han >= 8) return '倍满';
  if (win.han >= 6) return '跳满';
  if (win.han >= 5) return '满贯';
  if (win.han === 4 && win.fu >= 40) return '满贯';
  if (win.han === 3 && win.fu >= 70) return '满贯';
  return null;
}

function isStickRecipient(result: WinRoundResult, win: WinResultEntry): boolean {
  return result.winners[0] === win;
}

function winScoreBreakdown(gameState: GameState, result: WinRoundResult, win: WinResultEntry): WinScoreBreakdown {
  const total = win.pointDeltas[win.winner] ?? win.points;
  const honbaBonus = gameState.honba * 300;
  const stickBonus = isStickRecipient(result, win) ? gameState.riichiSticks * 1000 : 0;
  const handPoints = Math.max(0, total - honbaBonus - stickBonus);
  const paymentNote = win.winType === 'tsumo' && gameState.honba > 0
    ? `支付明细：每家额外支付${gameState.honba * 100}点`
    : undefined;
  return { handPoints, honbaBonus, stickBonus, total, paymentNote };
}

function ResultDeltas({ gameState, pointDeltas }: { gameState: GameState; pointDeltas: number[] }) {
  return (
    <section className="result-deltas">
      <h3>点数变化</h3>
      {gameState.players.map((player, index) => {
        const delta = pointDeltas[index] ?? 0;
        return (
          <div key={player.id} className="result-delta-row">
            <span>{windLabel(player.seatWind)}家 {player.name}</span>
            <strong className={delta >= 0 ? 'delta-positive' : 'delta-negative'}>
              {delta >= 0 ? '+' : ''}{formatPoints(delta)}
            </strong>
          </div>
        );
      })}
    </section>
  );
}

function winDisplayDeltas(gameState: GameState, result: WinRoundResult): number[] {
  return result.pointDeltas.map((delta, index) => (
    gameState.players[index]?.riichi ? delta - 1000 : delta
  ));
}

export function ResultDialog({ gameState, onReset, doraGlowEnabled = true }: ResultDialogProps) {
  const result = gameState.result;
  if (!result) return null;

  if (result.type === 'exhaustive-draw') {
    return (
      <ResultShell title="荒牌流局" subtitle="听牌罚符结算" onReset={onReset}>
        <div className="result-card">
          <p>听牌：{playerNames(gameState, result.tenpaiPlayers)}</p>
          <p>未听：{playerNames(gameState, result.notenPlayers)}</p>
          <p>本场增加：{result.honbaIncrement}</p>
          <p>供托保留：{result.riichiSticksCarryOver ? '是' : '否'}</p>
          <p>庄家连庄：{result.dealerContinues ? '是' : '否'}</p>
          {result.tenpaiPlayers.map((playerId) => (
            <HandPreview key={playerId} title={`${gameState.players[playerId].name} 手牌`} tiles={gameState.players[playerId].hand} />
          ))}
        </div>
        <ResultDeltas gameState={gameState} pointDeltas={result.pointDeltas} />
      </ResultShell>
    );
  }

  if (result.type === 'abortive-draw') {
    const actor = result.declaredBy ?? result.triggeringPlayer;
    return (
      <ResultShell
        title={`特殊流局：${drawReasonLabel(result.reason)}`}
        subtitle={actor !== undefined ? `触发者：${gameState.players[actor].name}` : '本局途中流局'}
        onReset={onReset}
      >
        <div className="result-card">
          <p>点数变化：通常无</p>
          <p>供托保留：{result.riichiSticksCarryOver ? '是' : '否'}</p>
          <p>本场增加：{result.honbaIncrement}</p>
          <p>庄家连庄：{result.dealerContinues ? '是' : '否'}</p>
        </div>
        <ResultDeltas gameState={gameState} pointDeltas={result.pointDeltas} />
      </ResultShell>
    );
  }

  return (
    <ResultShell
      title={result.type === 'tsumo' ? '自摸' : '荣和'}
      subtitle={result.winners.length > 1 ? `${result.winners.length} 人荣和` : '本局结束'}
      onReset={onReset}
    >
      <div className="result-winners">
        {result.winners.map((win) => {
          const winner = gameState.players[win.winner];
          const from = win.from === null ? null : gameState.players[win.from];
          const hasYakuman = win.yaku.some((yaku) => yaku.yakuman);
          const yakuRows = reconciledYakuRows(win);
          const breakdown = winScoreBreakdown(gameState, result, win);
          const limit = limitLabel(win);
          return (
            <article key={`${win.winner}-${win.winType}`} className="result-card">
              <div className="result-card-title">
                <strong>{windLabel(winner.seatWind)}家 {winner.name}</strong>
                <span>{win.winType === 'tsumo' ? '自摸' : `荣和${from ? ` ${windLabel(from.seatWind)}家` : ''}`}</span>
              </div>
              <WinHandPreview gameState={gameState} winner={winner} win={win} doraGlowEnabled={doraGlowEnabled} />
              <p>和牌：{tileLabel(win.winTile)}</p>
              <div className="result-yaku-list" aria-label="役种明细">
                {yakuRows.length ? yakuRows.map((yaku, index) => (
                  <div key={`${win.winner}-${yaku.name}-${index}`} className="result-yaku-row">
                    <span>{yaku.name}</span>
                    <strong>{yaku.yakuman ? (yaku.han > 1 ? `${yaku.han}倍役满` : '役满') : `${yaku.han}番`}</strong>
                  </div>
                )) : <p>无役</p>}
              </div>
              <div className="result-score-summary">
                {limit ? <p className="result-limit-label">{limit}</p> : null}
                <p>合计：{hasYakuman ? '役满' : `${win.han}番${win.fu}符`}</p>
                <p>牌型得点：{formatPoints(breakdown.handPoints)}点</p>
                <p>本场奖励：{gameState.honba}本场 × 300点 = {formatPoints(breakdown.honbaBonus)}点</p>
                <p>供托奖励：{gameState.riichiSticks}根 × 1000点 = {formatPoints(breakdown.stickBonus)}点</p>
                {breakdown.paymentNote ? <p>{breakdown.paymentNote}</p> : null}
                <p>获得总计：{formatPoints(breakdown.total)}点</p>
              </div>
            </article>
          );
        })}
      </div>
      <ResultDeltas gameState={gameState} pointDeltas={winDisplayDeltas(gameState, result)} />
    </ResultShell>
  );
}
