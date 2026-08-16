import { useEffect, useMemo, useState } from 'react';
import {
  analyzeSeventeenStepsTenpai,
  advanceSeventeenStepsMatch,
  confirmBuild,
  createSeventeenStepsGame,
  declareSeventeenStepsRon,
  discardCandidate,
  moveFixedTile,
  passSeventeenStepsRon,
  selectFixedTile,
  toSeventeenStepsGameState,
  type SeventeenStepsState,
  type SeventeenStepsMatchConfig,
  DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG,
} from '../game/seventeenSteps';
import { createSeventeenStepsAI, createSeventeenStepsAIGame } from '../game/seventeenStepsAI';
import { tileLabel, windLabel } from '../game/tileUtils';
import type { Tile as TileModel, TileId, GameState } from '../game/types';
import { ActionPrompt } from './ActionPrompt';
import { ResultDialog } from './ResultDialog';
import { Tile } from './Tile';
import { AnalysisDrawer } from './game/AnalysisDrawer';
import { DoraIndicatorStack } from './game/DoraIndicatorStack';
import { GameTopBar } from './game/GameTopBar';
import { MahjongTable } from './game/MahjongTable';
import { RulesGuideScreen } from './rulesGuide/RulesGuideScreen';
import type { FullRuleConfig } from '../game/match/types';
import { useGamePresentationEvents } from '../presentation/gamePresentationEvents';
import { DEFAULT_PLAYER_PROFILE, type PlayerProfile } from '../profile/playerProfile';
import { PlayerAvatar } from './PlayerAvatar';

interface SeventeenStepsScreenProps {
  onBack: () => void;
  ruleConfig: FullRuleConfig;
  matchConfig?: SeventeenStepsMatchConfig;
  playerProfile?: PlayerProfile;
}

export function SeventeenStepsScreen({ onBack, ruleConfig, matchConfig = DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG, playerProfile = DEFAULT_PLAYER_PROFILE }: SeventeenStepsScreenProps) {
  const [state, setState] = useState<SeventeenStepsState>(() => createSeventeenStepsAIGame(createSeventeenStepsGame(matchConfig), {
    difficulty: matchConfig.aiDifficulty,
    personality: matchConfig.aiPersonality,
    seed: 0,
  }));
  const [rulesOpen, setRulesOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [hoveredTileType, setHoveredTileType] = useState<TileId | null>(null);
  const isBuildPhase = state.phase === 'build';
  const isLocalTurn = state.phase === 'active' && state.currentPlayerId === 0;
  const tableState = useMemo(() => toSeventeenStepsGameState(state), [state]);
  const opponentDrawAnalysis = state.phase === 'round-ended' && state.result?.type === 'draw'
    ? analyzeSeventeenStepsTenpai(state, 1)
    : undefined;
  useGamePresentationEvents(tableState);

  useEffect(() => {
    if (state.phase === 'active' && state.currentPlayerId === 1) {
      const timer = window.setTimeout(() => {
        const candidate = createSeventeenStepsAI({
          difficulty: state.matchConfig.aiDifficulty,
          personality: state.matchConfig.aiPersonality,
          seed: 0,
        }).discard(state, 1);
        if (candidate) setState((current) => discardCandidate(current, 1, candidate.instanceId));
      }, 350);
      return () => window.clearTimeout(timer);
    }
    if (state.phase === 'ron-window' && state.pendingRon?.winnerId === 1) {
      const timer = window.setTimeout(() => setState((current) => declareSeventeenStepsRon(current, 1)), 350);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [state]);

  return (
    <main className={`game-screen seventeen-steps-game ${isBuildPhase ? 'seventeen-steps-game--build' : ''}`} data-testid="game-screen">
      <GameTopBar
        gameState={tableState}
        analysisOpen={analysisOpen}
        modeLabel="17步麻将"
        phaseLabelOverride={phaseLabel(state)}
        onOpenRulesGuide={() => setRulesOpen(true)}
        onToggleAnalysis={() => setAnalysisOpen((open) => !open)}
        onReturnMenu={onBack}
      />
      {isBuildPhase ? (
        <SeventeenStepsBuildSummary
          state={state}
          gameState={tableState}
          playerProfile={playerProfile}
          hoveredTileType={hoveredTileType}
          onHoveredTileTypeChange={setHoveredTileType}
        />
      ) : null}
      {!isBuildPhase ? <div className="seventeen-steps-board-area">
        <PlayerProfileBadge profile={playerProfile} className="seventeen-steps-table-profile" />
        <MahjongTable
          gameState={tableState}
          activeSeats={['north', 'south']}
          bottomPlayerId={0}
          seatMapping={{ bottomPlayerId: 0, topPlayerId: 1, rightPlayerId: 2, leftPlayerId: 3 }}
          centerRemainingLabel={null}
          centerRoundLabel={`${windLabel(state.prevailingWind)}场 第${state.handInCycle + 1}局`}
          riverColumns={8}
          centerCornerLabels={{
            topLeft: `对家 ${state.players[1].discardCount} / 17`,
            bottomRight: `自己 ${state.players[0].discardCount} / 17`,
          }}
          hoveredTileType={hoveredTileType}
          doraGlowEnabled={matchConfig.displayOptions.doraGlowEnabled}
          sameTileHoverEnabled={matchConfig.displayOptions.sameTileHoverEnabled}
          onHoveredTileTypeChange={setHoveredTileType}
        />
        {!isBuildPhase ? (
          <FixedHandPanel
            state={state}
            gameState={tableState}
            hoveredTileType={hoveredTileType}
            onHoveredTileTypeChange={setHoveredTileType}
          />
        ) : null}
      </div> : null}
      <section className="seventeen-steps-action-area" aria-label="17步麻将操作区">
        {isBuildPhase ? (
          <BuildPanel
            state={state}
            doraIndicators={tableState.doraIndicators}
            hoveredTileType={hoveredTileType}
            onHoveredTileTypeChange={setHoveredTileType}
            onSelect={(instanceId) => setState((current) => selectFixedTile(current, 0, instanceId))}
            onMove={(instanceId, toFixedHand) => setState((current) => moveFixedTile(current, 0, instanceId, toFixedHand))}
            onConfirm={() => setState((current) => confirmBuild(current, 0))}
          />
        ) : (
          <>
            <DiscardPanel
              state={state}
              gameState={tableState}
              canDiscard={isLocalTurn}
              hoveredTileType={hoveredTileType}
              onHoveredTileTypeChange={setHoveredTileType}
              onDiscard={(instanceId) => setState((current) => discardCandidate(current, 0, instanceId))}
            />
          </>
        )}
      </section>
      {state.phase === 'ron-window' && state.pendingRon?.winnerId === 0 ? (
        <div className="game-prompt-layer">
          <ActionPrompt title={`可以荣和 ${tileLabel(state.pendingRon.tile)}`} ariaLabel="17步麻将荣和操作">
            <button type="button" onClick={() => setState((current) => declareSeventeenStepsRon(current, 0))}>荣和</button>
            <button type="button" onClick={() => setState((current) => passSeventeenStepsRon(current, 0))}>跳过</button>
          </ActionPrompt>
        </div>
      ) : null}
      {state.phase === 'round-ended' && state.result ? (
        <ResultDialog
          gameState={tableState}
          onReset={() => setState((current) => createSeventeenStepsAIGame(advanceSeventeenStepsMatch(current), {
            difficulty: current.matchConfig.aiDifficulty,
            personality: current.matchConfig.aiPersonality,
            seed: 0,
          }))}
          continueLabel={state.completedHands + 1 >= state.totalHands || (matchConfig.bankruptcyEndsMatch && state.scores.some((score) => score < 0)) ? '查看比赛结果' : '下一局'}
          doraGlowEnabled={matchConfig.displayOptions.doraGlowEnabled}
          displayPointDeltas={state.result.pointDeltas}
          showDoraIndicators={false}
          revealExhaustiveDrawPlayerIds={[1]}
          seventeenStepsDrawAnalysis={opponentDrawAnalysis}
          seventeenStepsKazoeYakumanMode={state.matchConfig.roundRuleConfig.kazoeYakumanMode}
          visiblePlayerIds={[0, 1]}
          scoreBefore={state.result.scoresBefore}
          scoreAfter={state.result.scoresAfter}
        />
      ) : null}
      {state.phase === 'match-ended' ? <SeventeenStepsMatchResult state={state} playerProfile={playerProfile} onNewMatch={() => setState(createSeventeenStepsAIGame(createSeventeenStepsGame(state.matchConfig), {
        difficulty: state.matchConfig.aiDifficulty,
        personality: state.matchConfig.aiPersonality,
        seed: 0,
      }))} onBack={onBack} /> : null}
      {rulesOpen ? <RulesGuideScreen embedded ruleConfig={ruleConfig} onBack={() => setRulesOpen(false)} /> : null}
      <AnalysisDrawer open={analysisOpen} gameState={tableState} onClose={() => setAnalysisOpen(false)} />
    </main>
  );
}

function SeventeenStepsBuildSummary({ state, gameState, playerProfile, hoveredTileType, onHoveredTileTypeChange }: { state: SeventeenStepsState; gameState: GameState; playerProfile: PlayerProfile; hoveredTileType: TileId | null; onHoveredTileTypeChange: (tileType: TileId | null) => void }) {
  const self = gameState.players[0];
  const opponent = gameState.players[1];
  const selfBuild = state.players[0];
  const opponentBuild = state.players[1];
  return (
    <section className="seventeen-steps-build-summary" aria-label="比赛摘要">
      <DoraIndicatorStack
        gameState={gameState}
        matchState={{ roundWind: state.prevailingWind, handNumber: state.handInCycle === 0 ? 1 : 2 }}
        hoveredTileType={hoveredTileType}
        sameTileHoverEnabled
        onHoveredTileTypeChange={onHoveredTileTypeChange}
      />
      <div className="seventeen-steps-build-summary-info">
        <div className="seventeen-steps-build-summary-players">
          <div className="seventeen-steps-build-summary-player">
            <PlayerAvatar avatarId={playerProfile.avatarId} className="player-avatar--compact" />
            <span title={playerProfile.nickname}>{playerProfile.nickname}</span>
            <strong>{windLabel(self.seatWind)}{state.dealerId === 0 ? ' · 庄家' : ''}</strong>
            <b>{self.score.toLocaleString()}</b>
            <em>{selfBuild.buildConfirmed ? '已确认' : '构筑中'}</em>
          </div>
          <div className="seventeen-steps-build-summary-player">
            <span>对手</span>
            <strong>{windLabel(opponent.seatWind)}{state.dealerId === 1 ? ' · 庄家' : ''}</strong>
            <b>{opponent.score.toLocaleString()}</b>
            <em>{opponentBuild.buildConfirmed ? '已确认' : '构筑中'}</em>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuildPanel({ state, doraIndicators, hoveredTileType, onHoveredTileTypeChange, onSelect, onMove, onConfirm }: { state: SeventeenStepsState; doraIndicators: TileModel[]; hoveredTileType: TileId | null; onHoveredTileTypeChange: (tileType: TileId | null) => void; onSelect: (instanceId: string) => void; onMove: (instanceId: string, toFixedHand: boolean) => void; onConfirm: () => void }) {
  const player = state.players[0];
  const fixedIds = new Set(player.fixedHand.map((tile) => tile.instanceId));
  const discardTiles = player.sourceTiles.filter((tile) => !fixedIds.has(tile.instanceId));
  const [draggedTileId, setDraggedTileId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<'discard' | 'hand' | null>(null);
  const dropTile = (toFixedHand: boolean) => {
    if (draggedTileId) onMove(draggedTileId, toFixedHand);
    setDraggedTileId(null);
    setDragOverZone(null);
  };
  return (
    <section className="seventeen-steps-build" aria-label="构筑手牌">
      <div className="seventeen-steps-build-copy">
        <div>
          <h2>构筑阶段</h2>
          <p>从你的 34 张私有牌中选择 13 张固定手牌。确认后，剩余 21 张将成为本局的弃牌候选池。</p>
        </div>
        <strong>{player.fixedHand.length} / 13</strong>
      </div>
      <div
        className={`seventeen-steps-build-zone seventeen-steps-build-zone--discard ${dragOverZone === 'discard' ? 'seventeen-steps-build-zone--drag-over' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragOverZone('discard'); }}
        onDragLeave={() => setDragOverZone(null)}
        onDrop={(event) => { event.preventDefault(); dropTile(false); }}
      >
        <div className="seventeen-steps-build-zone-title"><strong>弃牌区</strong><span>本局剩余 {discardTiles.length} 张候选牌</span></div>
        <BuildTileGrid tiles={discardTiles} selected={false} doraIndicators={doraIndicators} hoveredTileType={hoveredTileType} onHoveredTileTypeChange={onHoveredTileTypeChange} disabled={player.buildConfirmed} onClick={onSelect} onDragStart={setDraggedTileId} />
      </div>
      <div
        className={`seventeen-steps-build-zone seventeen-steps-build-zone--hand ${dragOverZone === 'hand' ? 'seventeen-steps-build-zone--drag-over' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragOverZone('hand'); }}
        onDragLeave={() => setDragOverZone(null)}
        onDrop={(event) => { event.preventDefault(); dropTile(true); }}
      >
        <div className="seventeen-steps-build-zone-title"><strong>手牌区</strong><span>准备保留为固定手牌（{player.fixedHand.length} / 13）</span></div>
        <BuildTileGrid tiles={player.fixedHand} selected doraIndicators={doraIndicators} hoveredTileType={hoveredTileType} onHoveredTileTypeChange={onHoveredTileTypeChange} disabled={player.buildConfirmed} onClick={onSelect} onDragStart={setDraggedTileId} />
      </div>
      <SeventeenStepsAnalysisCard state={state} onConfirm={onConfirm} />
    </section>
  );
}

function BuildTileGrid({ tiles, selected, doraIndicators, hoveredTileType, onHoveredTileTypeChange, disabled, onClick, onDragStart }: { tiles: TileModel[]; selected: boolean; doraIndicators: TileModel[]; hoveredTileType: TileId | null; onHoveredTileTypeChange: (tileType: TileId | null) => void; disabled: boolean; onClick: (instanceId: string) => void; onDragStart: (instanceId: string) => void }) {
  return (
    <div className="seventeen-steps-tile-grid seventeen-steps-build-tile-grid">
      {tiles.map((tile) => (
        <div
          key={tile.instanceId}
          className="seventeen-steps-build-tile"
          draggable={!disabled}
          onDragStart={() => onDragStart(tile.instanceId)}
        >
          <Tile tile={tile} compact selected={selected} interactive={!disabled} disabled={disabled} doraIndicators={doraIndicators} doraGlowEnabled hoveredTileType={hoveredTileType} sameTileHoverEnabled onHoveredTileTypeChange={onHoveredTileTypeChange} onClick={() => onClick(tile.instanceId)} />
        </div>
      ))}
    </div>
  );
}

function SeventeenStepsAnalysisCard({ state, onConfirm }: { state: SeventeenStepsState; onConfirm?: () => void }) {
  const waits = analyzeSeventeenStepsTenpai(state, 0);
  const player = state.players[0];
  return (
    <section className="seventeen-steps-analysis-card" aria-label="听牌分析">
      <div className="seventeen-steps-analysis-header">
        <strong>听牌分析</strong>
      </div>
      {player.fixedHand.length !== 13 ? <p>手牌区达到 13 张后实时显示听牌、番数、役种与番缚判定。</p> : waits.length === 0 ? <p>当前构筑未形成听牌。</p> : (
        <div className="seventeen-steps-analysis-list">
          {waits.map((wait) => (
            <div className="seventeen-steps-analysis-item" key={wait.id}>
              {(() => {
                const winValueLabel = wait.score.yakumanValue > 0
                  ? wait.score.yakumanValue === 1 ? '役满' : `${wait.score.yakumanValue}倍役满`
                  : wait.restrictionHan >= 13 && state.matchConfig.roundRuleConfig.kazoeYakumanMode === 'yakuman' ? '累计役满' : `${wait.restrictionHan}番`;
                return (
                  <>
              <div className="seventeen-steps-analysis-wait">
                <Tile id={wait.id} compact interactive={false} />
                <span>{tileLabel(wait.id)} · 剩余 {wait.remaining}</span>
              </div>
              <span>{winValueLabel} · 番缚计入宝牌 ×{wait.doraCount}{wait.redDoraOnly ? '（仅赤宝可满足）' : ''}</span>
              <span>{wait.score.yaku.map((yaku) => yaku.name).join('、') || '无役'}</span>
              <strong className={wait.meetsHanRestriction ? 'seventeen-steps-analysis-pass' : 'seventeen-steps-analysis-fail'}>{wait.meetsHanRestriction ? '番缚满足' : '番缚不足'}</strong>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      )}
      {onConfirm ? <button className="seventeen-steps-analysis-confirm" type="button" disabled={player.fixedHand.length !== 13 || player.buildConfirmed} onClick={onConfirm}>确认固定手牌</button> : null}
    </section>
  );
}

function FixedHandPanel({ state, gameState, hoveredTileType, onHoveredTileTypeChange }: { state: SeventeenStepsState; gameState: GameState; hoveredTileType: TileId | null; onHoveredTileTypeChange: (tileType: TileId | null) => void }) {
  const player = state.players[0];
  return (
    <aside className="seventeen-steps-fixed" aria-label="固定手牌与听牌信息">
      <div className="seventeen-steps-section-title"><h2>固定手牌</h2><strong>{player.fixedHand.length} 张</strong></div>
      <TileGrid
        tiles={player.fixedHand}
        className="seventeen-steps-fixed-grid"
        doraIndicators={gameState.doraIndicators}
        hoveredTileType={hoveredTileType}
        onHoveredTileTypeChange={onHoveredTileTypeChange}
      />
      <SeventeenStepsAnalysisCard state={state} />
      {player.permanentFuriten ? <p className="seventeen-steps-furiten">永久振听：本局不能再荣和。</p> : null}
    </aside>
  );
}

function DiscardPanel({ state, gameState, canDiscard, hoveredTileType, onHoveredTileTypeChange, onDiscard }: { state: SeventeenStepsState; gameState: GameState; canDiscard: boolean; hoveredTileType: TileId | null; onHoveredTileTypeChange: (tileType: TileId | null) => void; onDiscard: (instanceId: string) => void }) {
  const player = state.players[0];
  return (
    <section className="seventeen-steps-candidates" aria-label="弃牌候选池">
      <div className="seventeen-steps-section-title">
        <h2>弃牌候选</h2>
        <strong>{player.discardCandidates.length} 张 · 剩 {Math.max(0, 17 - player.discardCount)} 步</strong>
      </div>
      <TileGrid
        tiles={player.discardCandidates}
        className={`seventeen-steps-candidate-grid ${canDiscard ? '' : 'seventeen-steps-candidate-grid--waiting'}`}
        disabled={!canDiscard}
        onClick={onDiscard}
        doraIndicators={gameState.doraIndicators}
        hoveredTileType={hoveredTileType}
        onHoveredTileTypeChange={onHoveredTileTypeChange}
      />
    </section>
  );
}

function ResultPanel({ state, onReset }: { state: SeventeenStepsState; onReset: () => void }) {
  const result = state.result;
  if (!result) return null;
  return (
    <div className="result-backdrop" role="presentation">
      <section className="result-dialog" role="dialog" aria-modal="true" aria-label="17步麻将结果">
      {result.type === 'ron' ? (
        <>
          <h2>{result.winnerId === 0 ? '荣和成立' : '对手荣和'}</h2>
          <p>{result.winnerId === 0 ? '你' : '对手'} 荣和 {tileLabel(result.winningTile)}，{result.score.han} 番 {result.score.fu} 符，{result.score.points.limitName ?? '和牌'}。</p>
          <p>役种：{result.score.yaku.map((yaku) => yaku.name).join('、') || '无'}。</p>
        </>
      ) : (
        <>
          <h2>流局结算</h2>
          <p>有效听牌：玩家 {result.validTenpai[0] ? '是' : '否'}，对手 {result.validTenpai[1] ? '是' : '否'}。</p>
          <p>点数变化：玩家 {formatDelta(result.pointDeltas[0])}，对手 {formatDelta(result.pointDeltas[1])}。</p>
        </>
      )}
        <footer className="result-actions"><button type="button" onClick={onReset}>重新开始</button></footer>
      </section>
    </div>
  );
}

function SeventeenStepsMatchResult({ state, playerProfile, onNewMatch, onBack }: { state: SeventeenStepsState; playerProfile: PlayerProfile; onNewMatch: () => void; onBack: () => void }) {
  const [first, second] = state.scores;
  const firstWins = first >= second;
  return (
    <div className="result-backdrop" role="presentation">
      <section className="result-dialog seventeen-steps-match-result" role="dialog" aria-modal="true" aria-label="17步麻将比赛结果">
        <header className="result-header">
          <div>
            <h2>17步麻将 · 比赛结束</h2>
            <p>{state.totalHands}局 · {state.totalHands / 2}个来回 · 东场至{windLabel(state.prevailingWind)}场</p>
          </div>
        </header>
        <div className="result-body">
          <div className="seventeen-steps-match-score-row"><strong>{playerProfile.nickname}</strong><span>{first.toLocaleString()}</span><b>{firstWins ? '第1名' : '第2名'}</b></div>
          <div className="seventeen-steps-match-score-row"><strong>对手</strong><span>{second.toLocaleString()}</span><b>{firstWins ? '第2名' : '第1名'}</b></div>
        </div>
        <footer className="result-actions">
          <button type="button" onClick={onNewMatch}>再来一场</button>
          <button type="button" className="secondary" onClick={onBack}>返回菜单</button>
        </footer>
      </section>
    </div>
  );
}

function PlayerProfileBadge({ profile, className = '' }: { profile: PlayerProfile; className?: string }) {
  return (
    <div className={`player-profile-badge ${className}`.trim()} aria-label={`本地玩家：${profile.nickname}`}>
      <PlayerAvatar avatarId={profile.avatarId} />
      <span>本地玩家</span>
      <strong title={profile.nickname}>{profile.nickname}</strong>
    </div>
  );
}

function TileGrid({ tiles, selectedIds, disabled = false, onClick, className = '', firstTileSideways = false, doraIndicators = [], hoveredTileType = null, onHoveredTileTypeChange }: { tiles: TileModel[]; selectedIds?: Set<string>; disabled?: boolean; onClick?: (instanceId: string) => void; className?: string; firstTileSideways?: boolean; doraIndicators?: TileModel[]; hoveredTileType?: TileId | null; onHoveredTileTypeChange?: (tileType: TileId | null) => void }) {
  return (
    <div className={`seventeen-steps-tile-grid ${className}`}>
      {tiles.map((tile, index) => (
        <Tile key={tile.instanceId} tile={tile} compact sideways={firstTileSideways && index === 0} selected={selectedIds?.has(tile.instanceId)} disabled={disabled} interactive={Boolean(onClick) && !disabled} doraIndicators={doraIndicators} doraGlowEnabled hoveredTileType={hoveredTileType} sameTileHoverEnabled onHoveredTileTypeChange={onHoveredTileTypeChange} onClick={onClick ? () => onClick(tile.instanceId) : undefined} />
      ))}
    </div>
  );
}

function phaseLabel(state: SeventeenStepsState): string {
  if (state.phase === 'build') return '构筑阶段';
  if (state.phase === 'round-ended') return '本局结束';
  if (state.phase === 'ron-window') return state.pendingRon?.winnerId === 0 ? '响应荣和' : '等待对手处理';
  return state.currentPlayerId === 0 ? '你的回合' : '等待对手';
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}
