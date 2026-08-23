import { useCallback, useSyncExternalStore } from 'react';
import type React from 'react';
import type { AbortiveDrawReason, GameState, PlayerId, ResultYaku, Tile as TileModel, WinResultEntry, WinRoundResult } from '../game/types';
import type { WinResultPresentationController, WinResultPresentationState } from '../audio/voice/WinResultPresentationController';
import type { SettlementPresentationCoordinator, SettlementPresentationState } from '../audio/voice/SettlementPresentationCoordinator';
import type { WinPresentationItem } from '../audio/voice/winVoiceSequence';
import type { SeventeenStepsWaitAnalysis } from '../game/seventeenSteps';
import { tileLabel, windLabel } from '../game/tileUtils';
import { PlayerMelds } from './PlayerMelds';
import { Tile as TileView } from './Tile';
import { activeUraDoraIndicators } from '../game/wall';

interface ResultDialogProps {
  gameState: GameState;
  onReset: () => void;
  doraGlowEnabled?: boolean;
  showDoraIndicators?: boolean;
  revealExhaustiveDrawPlayerIds?: PlayerId[];
  seventeenStepsDrawAnalysis?: SeventeenStepsWaitAnalysis[];
  seventeenStepsKazoeYakumanMode?: 'disabled' | 'sanbaiman' | 'yakuman';
  continueLabel?: string;
  displayPointDeltas?: number[];
  resultRiichiSticks?: number;
  visiblePlayerIds?: PlayerId[];
  scoreBefore?: number[];
  scoreAfter?: number[];
  /** Standard-game only: streams existing win presentation items before full settlement detail. */
  winPresentationController?: WinResultPresentationController;
  settlementPresentationCoordinator?: SettlementPresentationCoordinator;
}

interface ResultShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onReset: () => void;
  continueLabel: string;
}

interface WinScoreBreakdown {
  handPoints: number;
  honbaBonus: number;
  stickBonus: number;
  total: number;
  paymentNote?: string;
}

function ResultShell({ title, subtitle, children, onReset, continueLabel }: ResultShellProps) {
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
          <button type="button" onClick={onReset}>{continueLabel}</button>
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

function SeventeenStepsDrawAnalysis({ waits, kazoeYakumanMode }: { waits: SeventeenStepsWaitAnalysis[]; kazoeYakumanMode?: 'disabled' | 'sanbaiman' | 'yakuman' }) {
  return (
    <section className="seventeen-steps-analysis-card result-seventeen-steps-analysis" aria-label="听牌分析">
      <div className="seventeen-steps-analysis-header">
        <strong>听牌分析</strong>
      </div>
      {waits.length === 0 ? <p>当前未形成听牌。</p> : (
        <div className="seventeen-steps-analysis-list">
          {waits.map((wait) => {
            const winValueLabel = wait.score.yakumanValue > 0
              ? wait.score.yakumanValue === 1 ? '役满' : `${wait.score.yakumanValue}倍役满`
              : wait.restrictionHan >= 13 && kazoeYakumanMode === 'yakuman' ? '累计役满' : `${wait.restrictionHan}番`;
            return (
              <div className="seventeen-steps-analysis-item" key={wait.id}>
                <div className="seventeen-steps-analysis-wait">
                  <TileView id={wait.id} compact interactive={false} />
                  <span>{tileLabel(wait.id)} · 剩余 {wait.remaining}</span>
                </div>
                <span>{winValueLabel} · 番缚计入宝牌 ×{wait.doraCount}{wait.redDoraOnly ? '（仅赤宝可满足）' : ''}</span>
                <span>{wait.score.yaku.map((yaku) => yaku.name).join('、') || '无役'}</span>
                <strong className={wait.meetsHanRestriction ? 'seventeen-steps-analysis-pass' : 'seventeen-steps-analysis-fail'}>{wait.meetsHanRestriction ? '番缚满足' : '番缚不足'}</strong>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WinHandPreview({ gameState, winner, win, doraGlowEnabled = true, showDoraIndicators = true }: { gameState: GameState; winner: GameState['players'][number]; win: WinResultEntry; doraGlowEnabled?: boolean; showDoraIndicators?: boolean }) {
  const concealedTiles = removeWinTileForDisplay(winner.hand, win.winTile, win.winType);
  const uraIndicators = winner.riichi ? activeUraDoraIndicators(gameState.deadWall, gameState.doraIndicators.length) : [];
  return (
    <div className="result-tile-sections" aria-label="和牌牌组">
      {showDoraIndicators ? (
        <section className="result-tile-section result-dora-indicators" aria-label="宝牌指示牌">
          <span>宝牌指示牌</span>
          <div className="result-hand-row">
            {gameState.doraIndicators.map((tile) => <TileView key={tile.instanceId} tile={tile} compact doraGlowEnabled={false} />)}
          </div>
        </section>
      ) : null}
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
  // Batch 3 already computed these semantic fields. The UI must never infer a
  // limit from han/fu, points, translated names, or the number of yaku.
  if ((win.yakumanMultiplier ?? 0) > 0) {
    return win.yakumanMultiplier === 1 ? '役满' : `${win.yakumanMultiplier}倍役满`;
  }
  const labels = {
    mangan: '满贯', haneman: '跳满', baiman: '倍满', sanbaiman: '三倍满', 'counted-yakuman': '累计役满',
  } as const;
  if (win.limitTier !== undefined) {
    return win.limitTier !== 'none' && win.limitTier !== 'yakuman' ? labels[win.limitTier] : null;
  }
  // Compatibility for legacy saved/replay results created before Batch 3 added
  // semantic limit fields. Live engine results always take the branch above.
  if (win.han >= 13) return '役满';
  if (win.han >= 11) return '三倍满';
  if (win.han >= 8) return '倍满';
  if (win.han >= 6) return '跳满';
  if (win.han >= 5 || (win.han === 4 && win.fu >= 40) || (win.han === 3 && win.fu >= 70)) return '满贯';
  return null;
}

function isStickRecipient(result: WinRoundResult, win: WinResultEntry): boolean {
  return result.winners[0] === win;
}

function winScoreBreakdown(gameState: GameState, result: WinRoundResult, win: WinResultEntry, resultRiichiSticks: number): WinScoreBreakdown {
  const total = win.pointDeltas[win.winner] ?? win.points;
  const honbaBonus = gameState.honba * 300;
  const stickBonus = isStickRecipient(result, win) ? resultRiichiSticks * 1000 : 0;
  const handPoints = Math.max(0, total - honbaBonus - stickBonus);
  const paymentNote = win.winType === 'tsumo' && gameState.honba > 0
    ? `支付明细：每家额外支付${gameState.honba * 100}点`
    : undefined;
  return { handPoints, honbaBonus, stickBonus, total, paymentNote };
}

function ResultDeltas({ gameState, pointDeltas, visiblePlayerIds, scoreBefore, scoreAfter }: { gameState: GameState; pointDeltas: number[]; visiblePlayerIds?: PlayerId[]; scoreBefore?: number[]; scoreAfter?: number[] }) {
  return (
    <section className="result-deltas">
      <h3>点数变化</h3>
      {(visiblePlayerIds ?? gameState.players.map((player) => player.id)).map((playerId) => {
        const player = gameState.players[playerId];
        const index = playerId;
        const delta = pointDeltas[index] ?? 0;
        return (
          <div key={player.id} className="result-delta-row">
            <span>{windLabel(player.seatWind)}家 {player.name}</span>
            <strong className={delta >= 0 ? 'delta-positive' : 'delta-negative'}>
              {delta >= 0 ? '+' : ''}{formatPoints(delta)}
            </strong>
            {scoreBefore && scoreAfter ? <span className="result-score-after">{formatPoints(scoreBefore[index] ?? 0)} → {formatPoints(scoreAfter[index] ?? 0)}</span> : null}
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

const EMPTY_WIN_PRESENTATION: WinResultPresentationState = { sequences: [], activeSequenceId: null };

function useWinPresentation(controller: WinResultPresentationController | undefined): WinResultPresentationState {
  const subscribe = useCallback((listener: () => void) => (
    controller ? controller.subscribe(listener) : () => undefined
  ), [controller]);
  const getSnapshot = useCallback(() => controller?.getSnapshot() ?? EMPTY_WIN_PRESENTATION, [controller]);
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
}

const EMPTY_SETTLEMENT_PRESENTATION: SettlementPresentationState = { settlementId: null, phase: 'round-result', roundResultComplete: false, visibleSeatCount: 0, playerIds: [], pointRows: [] };

function useSettlementPresentation(controller: SettlementPresentationCoordinator | undefined): SettlementPresentationState {
  const subscribe = useCallback((listener: () => void) => (
    controller ? controller.subscribe(listener) : () => undefined
  ), [controller]);
  const getSnapshot = useCallback(() => controller?.getSnapshot() ?? EMPTY_SETTLEMENT_PRESENTATION, [controller]);
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
}

function presentationItemClassName(item: WinPresentationItem): string {
  switch (item.kind) {
    case 'win-action':
    case 'yaku':
    case 'dora':
      return 'result-presentation-item';
    case 'limit':
      return 'result-presentation-item result-presentation-item--limit';
    default:
      return unsupportedPresentationItemKind(item.kind);
  }
}

function unsupportedPresentationItemKind(kind: never): never {
  throw new Error(`Unsupported win presentation item kind: ${String(kind)}`);
}

function hasStreamedResultDetail(items: readonly WinPresentationItem[]): boolean {
  return items.some((item) => item.kind === 'yaku' || item.kind === 'dora' || item.kind === 'limit');
}

function PointSettlement({ gameState, presentation }: {
  gameState: GameState;
  presentation: SettlementPresentationState;
}) {
  return (
    <section className="point-settlement" aria-label="点棒结算">
      <h3>点棒变化</h3>
      {presentation.pointRows.slice(0, presentation.visibleSeatCount).map((row) => {
        const { playerId, beforePoints, delta, afterPoints } = row;
        const deltaLabel = delta > 0 ? `+${formatPoints(delta)}` : delta < 0 ? formatPoints(delta) : '±0';
        return (
          <div key={playerId} className="point-settlement-row">
            <strong>{windLabel(gameState.players[playerId].seatWind)}家 {gameState.players[playerId].name}</strong>
            <span>{formatPoints(beforePoints)}</span>
            <span className={delta > 0 ? 'delta-positive' : delta < 0 ? 'delta-negative' : 'delta-neutral'}>{deltaLabel}</span>
            <span>→</span>
            <strong>{formatPoints(afterPoints)}</strong>
          </div>
        );
      })}
    </section>
  );
}

export function ResultDialog({ gameState, onReset, doraGlowEnabled = true, showDoraIndicators = true, revealExhaustiveDrawPlayerIds = [], seventeenStepsDrawAnalysis, seventeenStepsKazoeYakumanMode, continueLabel = '继续', displayPointDeltas, resultRiichiSticks = gameState.riichiSticks, visiblePlayerIds, scoreBefore, scoreAfter, winPresentationController, settlementPresentationCoordinator }: ResultDialogProps) {
  const winPresentation = useWinPresentation(winPresentationController);
  const settlementPresentation = useSettlementPresentation(settlementPresentationCoordinator);
  const result = gameState.result;
  if (!result) return null;

  if (settlementPresentationCoordinator && settlementPresentation.phase === 'point-settlement') {
    return (
      <ResultShell title="点棒结算" subtitle="本局点数变化" onReset={onReset} continueLabel={continueLabel}>
        <PointSettlement
          gameState={gameState}
          presentation={settlementPresentation}
        />
      </ResultShell>
    );
  }

  const continueStage = settlementPresentationCoordinator ? () => settlementPresentationCoordinator.continue() : onReset;

  if (result.type === 'exhaustive-draw') {
    const revealedPlayerIds = [...new Set([...result.tenpaiPlayers, ...revealExhaustiveDrawPlayerIds])];
    return (
      <ResultShell title="荒牌流局" subtitle="听牌罚符结算" onReset={continueStage} continueLabel={continueLabel}>
        <div className="result-card">
          <p>听牌：{playerNames(gameState, result.tenpaiPlayers)}</p>
          <p>未听：{playerNames(gameState, result.notenPlayers)}</p>
          <p>本场增加：{result.honbaIncrement}</p>
          <p>供托保留：{result.riichiSticksCarryOver ? '是' : '否'}</p>
          <p>庄家连庄：{result.dealerContinues ? '是' : '否'}</p>
          {revealedPlayerIds.map((playerId) => (
            <HandPreview key={playerId} title={`${gameState.players[playerId].name} 手牌`} tiles={gameState.players[playerId].hand} />
          ))}
          {seventeenStepsDrawAnalysis ? <SeventeenStepsDrawAnalysis waits={seventeenStepsDrawAnalysis} kazoeYakumanMode={seventeenStepsKazoeYakumanMode} /> : null}
        </div>
        {!settlementPresentationCoordinator ? <ResultDeltas gameState={gameState} pointDeltas={displayPointDeltas ?? result.pointDeltas} visiblePlayerIds={visiblePlayerIds} scoreBefore={scoreBefore} scoreAfter={scoreAfter} /> : null}
      </ResultShell>
    );
  }

  if (result.type === 'abortive-draw') {
    const actor = result.declaredBy ?? result.triggeringPlayer;
    return (
      <ResultShell
        title={`特殊流局：${drawReasonLabel(result.reason)}`}
        subtitle={actor !== undefined ? `触发者：${gameState.players[actor].name}` : '本局途中流局'}
        onReset={continueStage}
        continueLabel={continueLabel}
      >
        <div className="result-card">
          <p>点数变化：通常无</p>
          <p>供托保留：{result.riichiSticksCarryOver ? '是' : '否'}</p>
          <p>本场增加：{result.honbaIncrement}</p>
          <p>庄家连庄：{result.dealerContinues ? '是' : '否'}</p>
        </div>
        {!settlementPresentationCoordinator ? <ResultDeltas gameState={gameState} pointDeltas={displayPointDeltas ?? result.pointDeltas} visiblePlayerIds={visiblePlayerIds} scoreBefore={scoreBefore} scoreAfter={scoreAfter} /> : null}
      </ResultShell>
    );
  }

  return (
    <ResultShell
      title={result.type === 'tsumo' ? '自摸' : '荣和'}
      subtitle={result.winners.length > 1 ? `${result.winners.length} 人荣和` : '本局结束'}
      onReset={continueStage}
      continueLabel={continueLabel}
    >
      <div className="result-winners">
        {result.winners.map((win) => {
          const sequence = winPresentation.sequences.find((candidate) => candidate.winnerId === win.winner);
          const winner = gameState.players[win.winner];
          const from = win.from === null ? null : gameState.players[win.from];
          const hasYakuman = win.yaku.some((yaku) => yaku.yakuman);
          const yakuRows = reconciledYakuRows(win);
          const breakdown = winScoreBreakdown(gameState, result, win, resultRiichiSticks);
          const limit = limitLabel(win);
          const sequenceComplete = winPresentationController ? sequence?.sequenceCompleted === true : true;
          const shouldShowWaiting = Boolean(sequence && !sequence.sequenceCompleted && !hasStreamedResultDetail(sequence.visibleItems));
          return (
            <article key={`${win.winner}-${win.winType}`} className="result-card">
              <div className="result-card-title">
                <strong>{winner.name} · {windLabel(winner.seatWind)} · {gameState.dealer === winner.id ? '庄' : '闲'}</strong>
                <span>{win.winType === 'tsumo' ? '自摸' : `荣和${from ? ` ${windLabel(from.seatWind)}家` : ''}`}</span>
              </div>
              <WinHandPreview gameState={gameState} winner={winner} win={win} doraGlowEnabled={doraGlowEnabled} showDoraIndicators={showDoraIndicators} />
              <p>和牌：{tileLabel(win.winTile)}</p>
              {winPresentationController ? (
                <div className="result-presentation-list" aria-label="和牌演出">
                  {sequence?.visibleItems.map((item, index) => (
                    <div key={`${sequence.sequenceId}-${index}-${item.voiceKey}`} className={presentationItemClassName(item)}>
                      <span>{item.displayLabel ?? item.voiceKey}</span>
                      {item.kind === 'yaku' && item.han !== undefined ? <strong>{item.han}番</strong> : null}
                      {item.kind === 'dora' && item.displayValue !== undefined ? <strong>{item.displayValue}</strong> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {sequenceComplete ? <div className="result-yaku-list" aria-label="役种明细">
                {yakuRows.length ? yakuRows.map((yaku, index) => (
                  <div key={`${win.winner}-${yaku.name}-${index}`} className="result-yaku-row">
                    <span>{yaku.name}</span>
                    <strong>{yaku.yakuman ? (yaku.han > 1 ? `${yaku.han}倍役满` : '役满') : `${yaku.han}番`}</strong>
                  </div>
                )) : <p>无役</p>}
              </div>
              : shouldShowWaiting ? <p className="result-presentation-waiting">役种播报中…</p> : null}
              {sequenceComplete ? <div className="result-score-summary">
                {limit ? <p className="result-limit-label">{limit}</p> : null}
                <p>合计：{hasYakuman ? '役满' : `${win.han}番${win.fu}符`}</p>
                <p>牌型得点：{formatPoints(breakdown.handPoints)}点</p>
                <p>本场奖励：{gameState.honba}本场 × 300点 = {formatPoints(breakdown.honbaBonus)}点</p>
                <p>供托奖励：{resultRiichiSticks}根 × 1000点 = {formatPoints(breakdown.stickBonus)}点</p>
                {breakdown.paymentNote ? <p>{breakdown.paymentNote}</p> : null}
                <p>获得总计：{formatPoints(breakdown.total)}点</p>
              </div> : null}
            </article>
          );
        })}
      </div>
      {!settlementPresentationCoordinator && (!winPresentationController || result.winners.every((win) => winPresentation.sequences.find((sequence) => sequence.winnerId === win.winner)?.sequenceCompleted === true))
        ? <ResultDeltas gameState={gameState} pointDeltas={displayPointDeltas ?? winDisplayDeltas(gameState, result)} visiblePlayerIds={visiblePlayerIds} scoreBefore={scoreBefore} scoreAfter={scoreAfter} />
        : null}
    </ResultShell>
  );
}
