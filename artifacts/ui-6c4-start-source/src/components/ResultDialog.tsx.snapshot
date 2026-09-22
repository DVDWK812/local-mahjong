import { useCallback, useSyncExternalStore } from 'react';
import type React from 'react';
import type { GameState, PlayerId, Tile as TileModel } from '../game/types';
import type { WinResultPresentationController, WinResultPresentationState } from '../audio/voice/WinResultPresentationController';
import type { SettlementPresentationCoordinator, SettlementPresentationState } from '../audio/voice/SettlementPresentationCoordinator';
import type { WinPresentationItem } from '../audio/voice/winVoiceSequence';
import type { SeventeenStepsWaitAnalysis } from '../game/seventeenSteps';
import { tileLabel, windLabel } from '../game/tileUtils';
import { PlayerMelds } from './PlayerMelds';
import { Tile as TileView } from './Tile';
import {
  buildResultViewModel,
  type PlayerScoreChangeViewModel,
  type WinnerResultViewModel,
} from '../presentation/result/resultViewModel';

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

function WinHandPreview({ gameState, winner, doraGlowEnabled = true, showDoraIndicators = true }: { gameState: GameState; winner: WinnerResultViewModel; doraGlowEnabled?: boolean; showDoraIndicators?: boolean }) {
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
          {winner.concealedTiles.map((tile) => <TileView key={tile.instanceId} tile={tile} compact doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} />)}
        </div>
      </section>
      <section className="result-tile-section result-winning-tile">
        <span>和牌张</span>
        <div className="result-win-tile" aria-label="和牌张">
          <TileView tile={winner.winningTile} compact doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} />
        </div>
      </section>
      {winner.player.calls.length > 0 ? (
        <section className="result-tile-section result-melds" aria-label="副露">
          <span>副露</span>
          <PlayerMelds player={winner.player} seatClass="result-melds-seat" doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} />
        </section>
      ) : null}
      {winner.uraDoraIndicators.length > 0 ? (
        <section className="result-tile-section result-ura-dora" aria-label="里宝牌">
          <span>里宝牌</span>
          <div className="result-hand-row">
            {winner.uraDoraIndicators.map((tile) => <TileView key={tile.instanceId} tile={tile} compact doraGlowEnabled={false} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatPoints(points: number): string {
  return points.toLocaleString();
}

function formatDelta(points: number): string {
  if (points > 0) return `+${formatPoints(points)}`;
  if (points < 0) return formatPoints(points);
  return '±0';
}

function ResultDeltas({ rows }: { rows: readonly PlayerScoreChangeViewModel[] }) {
  return (
    <section className="result-deltas" aria-label="四家点数变化">
      <h3>点数变化</h3>
      <div className="result-delta-grid">
      {rows.map((row) => {
        const delta = row.delta;
        return (
          <div key={row.playerId} className="result-delta-row">
            <span>{row.label}</span>
            <strong className={delta > 0 ? 'delta-positive' : delta < 0 ? 'delta-negative' : 'delta-neutral'}>
              {delta > 0 ? '+' : ''}{formatPoints(delta)}
            </strong>
            {row.scoreBefore !== undefined && row.scoreAfter !== undefined ? <span className="result-score-after">{formatPoints(row.scoreBefore)} → {formatPoints(row.scoreAfter)}</span> : null}
          </div>
        );
      })}
      </div>
    </section>
  );
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
  const viewModel = buildResultViewModel(gameState, {
    pointDeltas: displayPointDeltas,
    visiblePlayerIds,
    scoreBefore,
    scoreAfter,
    revealExhaustiveDrawPlayerIds,
  });
  if (!viewModel) return null;

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

  if (viewModel.kind === 'draw') {
    return (
      <ResultShell title={viewModel.title} subtitle={viewModel.subtitle} onReset={continueStage} continueLabel={continueLabel}>
        <section className="result-draw-overview" aria-label="流局状态">
          <div className="result-round-facts">
            <span>本场增加 <strong>{viewModel.honbaIncrement}</strong></span>
            <span>供托保留 <strong>{viewModel.riichiSticksCarryOver ? '是' : '否'}</strong></span>
            <span>庄家连庄 <strong>{viewModel.dealerContinues ? '是' : '否'}</strong></span>
          </div>
          <div className="result-draw-players">
            {viewModel.players.map((player) => (
              <article key={player.playerId} className="result-draw-player">
                <div className="result-draw-player-heading">
                  <strong>{player.label}</strong>
                  <span className={player.status === '听牌' ? 'result-tenpai' : 'result-noten'}>{player.status}</span>
                  <b className={player.delta > 0 ? 'delta-positive' : player.delta < 0 ? 'delta-negative' : 'delta-neutral'}>{formatDelta(player.delta)}</b>
                </div>
                {player.revealedHand ? <HandPreview title="公开手牌" tiles={[...player.revealedHand]} /> : null}
              </article>
            ))}
          </div>
          {seventeenStepsDrawAnalysis ? <SeventeenStepsDrawAnalysis waits={seventeenStepsDrawAnalysis} kazoeYakumanMode={seventeenStepsKazoeYakumanMode} /> : null}
        </section>
        {!settlementPresentationCoordinator ? <ResultDeltas rows={viewModel.scoreChanges} /> : null}
      </ResultShell>
    );
  }

  if (viewModel.kind === 'abortive-draw') {
    return (
      <ResultShell
        title={viewModel.title}
        subtitle={viewModel.actorLabel ? `${viewModel.reasonLabel} · 触发者：${viewModel.actorLabel}` : viewModel.reasonLabel}
        onReset={continueStage}
        continueLabel={continueLabel}
      >
        <section className="result-abortive-card" aria-label="特殊流局详情">
          <strong>{viewModel.reasonLabel}</strong>
          <div className="result-round-facts">
            <span>本场增加 <strong>{viewModel.honbaIncrement}</strong></span>
            <span>供托保留 <strong>{viewModel.riichiSticksCarryOver ? '是' : '否'}</strong></span>
            <span>庄家连庄 <strong>{viewModel.dealerContinues ? '是' : '否'}</strong></span>
          </div>
        </section>
        {!settlementPresentationCoordinator ? <ResultDeltas rows={viewModel.scoreChanges} /> : null}
      </ResultShell>
    );
  }

  return (
    <ResultShell
      title={viewModel.title}
      subtitle={viewModel.subtitle}
      onReset={continueStage}
      continueLabel={continueLabel}
    >
      <div className="result-winners">
        {viewModel.winners.map((winner) => {
          const win = winner.source;
          const sequence = winPresentation.sequences.find((candidate) => candidate.winnerId === win.winner);
          const hasYakuman = win.yaku.some((yaku) => yaku.yakuman) || (win.yakumanMultiplier ?? 0) > 0;
          const sequenceComplete = winPresentationController ? sequence?.sequenceCompleted === true : true;
          const shouldShowWaiting = Boolean(sequence && !sequence.sequenceCompleted && !hasStreamedResultDetail(sequence.visibleItems));
          return (
            <article key={winner.key} className="result-card result-winner-card" data-result-winner={win.winner}>
              <div className="result-card-title">
                <div>
                  <span className="result-winner-action">{winner.actionLabel}</span>
                  <strong>{winner.playerLabel} · {gameState.dealer === winner.player.id ? '庄' : '闲'}</strong>
                </div>
                <span>{winner.fromLabel ? `放铳：${winner.fromLabel}` : '自摸和牌'}</span>
              </div>
              <WinHandPreview gameState={gameState} winner={winner} doraGlowEnabled={doraGlowEnabled} showDoraIndicators={showDoraIndicators} />
              <p className="result-winning-tile-label">和牌张：{tileLabel(winner.winningTile)}</p>
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
              {sequenceComplete ? (
                <div className="result-detail-grid">
                  <section className="result-yaku-panel" aria-label="役种明细">
                    <h3>役种</h3>
                    <div className="result-yaku-list">
                      {winner.yaku.length ? winner.yaku.map((yaku, index) => (
                        <div key={`${win.winner}-${yaku.id ?? yaku.name}-${index}`} className="result-yaku-row">
                          <span>{yaku.name}</span>
                          <strong>{yaku.yakuman ? (yaku.han > 1 ? `${yaku.han}倍役满` : '役满') : `${yaku.han}番`}</strong>
                        </div>
                      )) : <p>无役种明细</p>}
                    </div>
                  </section>
                  <section className="result-score-panel" aria-label="番符与得点">
                    <h3>番符与得点</h3>
                    {winner.limitLabel ? <p className="result-limit-label">{winner.limitLabel}</p> : null}
                    <div className="result-score-metrics">
                      <span><small>总番</small><strong>{hasYakuman ? '役满' : `${winner.han}番`}</strong></span>
                      <span><small>符</small><strong>{hasYakuman || winner.fu <= 0 ? '—' : `${winner.fu}符`}</strong></span>
                      <span><small>结果得点</small><strong>{formatPoints(winner.resultPoints)}</strong></span>
                    </div>
                    <div className="result-dora-summary" aria-label="宝牌信息">
                      <span>宝牌 <strong>{winner.dora.available ? winner.dora.dora ?? 0 : '—'}</strong></span>
                      <span>里宝牌 <strong>{winner.dora.available ? winner.dora.uraDora ?? 0 : '—'}</strong></span>
                      <span>赤宝牌 <strong>{winner.dora.available ? winner.dora.redDora ?? 0 : '—'}</strong></span>
                      <span>合计 <strong>{winner.dora.available ? winner.dora.totalDora ?? '—' : '未提供'}</strong></span>
                    </div>
                    <div className="result-authoritative-total">
                      <span>本局点数变化</span>
                      <strong className={winner.winnerDelta > 0 ? 'delta-positive' : winner.winnerDelta < 0 ? 'delta-negative' : 'delta-neutral'}>{formatDelta(winner.winnerDelta)}</strong>
                    </div>
                    <p className="result-round-context">本场 {gameState.honba} · 供托 {resultRiichiSticks} 根；最终支付以点数变化为准。</p>
                  </section>
                </div>
              ) : shouldShowWaiting ? <p className="result-presentation-waiting">役种播报中…</p> : null}
            </article>
          );
        })}
      </div>
      {!settlementPresentationCoordinator && (!winPresentationController || viewModel.winners.every((winner) => winPresentation.sequences.find((sequence) => sequence.winnerId === winner.source.winner)?.sequenceCompleted === true))
        ? <ResultDeltas rows={viewModel.scoreChanges} />
        : null}
    </ResultShell>
  );
}
