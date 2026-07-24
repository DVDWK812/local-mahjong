import type React from 'react';
import type { AbortiveDrawReason, GameState, PlayerId, ResultYaku, Tile as TileModel, WinResultEntry } from '../game/types';
import { tileLabel, windLabel } from '../game/tileUtils';
import { Tile as TileView } from './Tile';

interface ResultDialogProps {
  gameState: GameState;
  onReset: () => void;
}

interface ResultShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onReset: () => void;
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

function HandPreview({ title, tiles }: { title: string; tiles: TileModel[] }) {
  return (
    <div className="result-hand">
      <span>{title}</span>
      <div className="result-hand-row">
        {tiles.map((tile) => <TileView key={tile.instanceId} tile={tile} compact />)}
      </div>
    </div>
  );
}

function playerNames(gameState: GameState, ids: PlayerId[]): string {
  return ids.length ? ids.map((id) => gameState.players[id].name).join('、') : '无人';
}

function drawReasonLabel(reason: AbortiveDrawReason): string {
  const labels: Record<string, string> = {
    'kyuushu-kyuuhai': '九种九牌',
    'suufon-renda': '四风连打',
    'suucha-riichi': '四家立直',
    'suukan-sanra': '四杠散了',
    sanchahou: '三家和了',
  };
  return labels[String(reason)] ?? '特殊流局';
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
  return name === '\u5b9d\u724c' || name === '\u91cc\u5b9d\u724c' || name === '\u8d64\u5b9d\u724c';
}

function doraYakuRows(win: WinResultEntry): ResultYaku[] {
  const rows: ResultYaku[] = [];
  if ((win.dora ?? 0) > 0) rows.push({ name: '\u5b9d\u724c', han: win.dora ?? 0 });
  if ((win.uraDora ?? 0) > 0) rows.push({ name: '\u91cc\u5b9d\u724c', han: win.uraDora ?? 0 });
  if ((win.redDora ?? 0) > 0) rows.push({ name: '\u8d64\u5b9d\u724c', han: win.redDora ?? 0 });
  return rows;
}

function ResultDeltas({ gameState, pointDeltas }: { gameState: GameState; pointDeltas: number[] }) {
  return (
    <section className="result-deltas">
      <h3>点数变化</h3>
      {gameState.players.map((player, index) => {
        const delta = pointDeltas[index] ?? 0;
        return (
          <div key={player.id} className="result-delta-row">
            <span>{windLabel(player.seatWind)} {player.name}</span>
            <strong className={delta >= 0 ? 'delta-positive' : 'delta-negative'}>
              {delta >= 0 ? '+' : ''}{delta.toLocaleString()}
            </strong>
          </div>
        );
      })}
    </section>
  );
}

export function ResultDialog({ gameState, onReset }: ResultDialogProps) {
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
          const winningHand = win.winType === 'tsumo' ? winner.hand : [...winner.hand, win.winTile];
          const hasYakuman = win.yaku.some((yaku) => yaku.yakuman);
          return (
            <article key={`${win.winner}-${win.winType}`} className="result-card">
              <div className="result-card-title">
                <strong>{windLabel(winner.seatWind)}家 {winner.name}</strong>
                <span>{win.winType === 'tsumo' ? '自摸' : `荣和${from ? ` ${windLabel(from.seatWind)}家` : ''}`}</span>
              </div>
              <HandPreview title="和牌手牌" tiles={winningHand} />
              <p>和牌：{tileLabel(win.winTile)}</p>
              <div className="result-yaku-list" aria-label="役种明细">
                {reconciledYakuRows(win).length ? reconciledYakuRows(win).map((yaku, index) => (
                  <div key={`${win.winner}-${yaku.name}-${index}`} className="result-yaku-row">
                    <span>{yaku.name}</span>
                    <strong>{yaku.yakuman ? (yaku.han > 1 ? `${yaku.han}倍役满` : '役满') : `${yaku.han}番`}</strong>
                  </div>
                )) : <p>无役</p>}
              </div>
              <div className="result-score-summary">
                <p>合计：{hasYakuman ? '役满' : `${win.han}番${win.fu}符`}</p>
                <p>基本点：{win.points.toLocaleString()}点</p>
                <p>本场：{gameState.honba}本场</p>
                <p>供托：{gameState.riichiSticks}根</p>
                <p>总计：{win.points.toLocaleString()}点</p>
              </div>
            </article>
          );
        })}
      </div>
      <ResultDeltas gameState={gameState} pointDeltas={result.pointDeltas} />
    </ResultShell>
  );
}
