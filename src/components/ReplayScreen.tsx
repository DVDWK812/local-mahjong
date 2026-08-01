import { useEffect, useMemo, useState } from 'react';
import type { ReplayRecord } from '../game/persistence/storageTypes';
import { advancePlaybackStep, scheduleReplayAdvance, shouldHandleReplayShortcut } from '../game/replay/replayPlayback';
import { buildReplayState, initialScoresForRound, replayActions, replayPhaseLabel, resolveReplayFinalScores, type BuiltReplayState } from '../game/replay/roundReplay';
import type { ReplayController, RoundLog } from '../game/replay/types';
import type { PlayerId, RoundResult } from '../game/types';
import { convertReplayStepToTestScenario } from '../game/testMode/scenario';
import type { TestScenarioV1 } from '../game/testMode/types';
import { LocalHandArea } from './game/LocalHandArea';
import { MahjongTable, type TableSeatMapping } from './game/MahjongTable';
import { ReplayBottomBar } from './ReplayBottomBar';
import { ReplayTopBar } from './ReplayTopBar';
import { ReplayWallDrawer } from './ReplayWallDrawer';
import { ResultDialog } from './ResultDialog';

export interface ReplayPerspectiveState {
  cameraPlayerId: PlayerId;
  isOpenHands: boolean;
}

const DEFAULT_PERSPECTIVE: ReplayPerspectiveState = {
  cameraPlayerId: 0,
  isOpenHands: false,
};

interface ReplayScreenProps {
  replay: ReplayRecord;
  onBack?: () => void;
  testModeEnabled?: boolean;
  onConvertToTestScenario?: (scenario: TestScenarioV1) => void;
}

export function ReplayScreen({ replay, onBack = () => undefined, testModeEnabled = false, onConvertToTestScenario }: ReplayScreenProps) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplayController['speed']>(1);
  const [perspective, setPerspective] = useState<ReplayPerspectiveState>(DEFAULT_PERSPECTIVE);
  const [wallOpen, setWallOpen] = useState(false);
  const round = replay.log.rounds[roundIndex];
  const stepPlan = useMemo(() => replayStepPlan(round), [round]);
  const reconstructedStep = Math.min(stepIndex, stepPlan.realLastStep);
  const roundInitialScores = useMemo(() => initialScoresForRound(replay.log, roundIndex), [replay.log, roundIndex]);
  const built = useMemo(() => round
    ? buildReplayState(round, reconstructedStep, {
      scores: roundInitialScores,
      playerNames: replay.playerNames,
      ruleConfig: replay.log.ruleConfig,
    })
    : null, [replay, round, reconstructedStep, roundInitialScores]);
  const testScenarioConversion = useMemo(
    () => testModeEnabled ? convertReplayStepToTestScenario(replay, roundIndex, reconstructedStep) : null,
    [testModeEnabled, replay, roundIndex, reconstructedStep],
  );

  useEffect(() => {
    if (!playing || !built) return;
    if (stepIndex >= stepPlan.replayLastStep) {
      setPlaying(false);
      return;
    }
    return scheduleReplayAdvance(() => {
      const next = advancePlaybackStep(stepIndex, stepPlan.replayLastStep);
      setStepIndex(next.stepIndex);
      setPlaying(next.playing);
    }, speed);
  }, [playing, speed, stepIndex, built, stepPlan.replayLastStep]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && wallOpen) {
        event.preventDefault();
        setWallOpen(false);
        return;
      }
      if (!shouldHandleReplayShortcut(event.target)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPlaying(false);
        setStepIndex((current) => Math.max(0, current - 1));
      }
      if (event.key === 'ArrowRight' && built) {
        event.preventDefault();
        setPlaying(false);
        setStepIndex((current) => Math.min(stepPlan.replayLastStep, current + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [built, stepPlan.replayLastStep, wallOpen]);

  if (!round || !built) {
    return <p className="replay-empty">这份牌谱还没有可回放的局。</p>;
  }

  const controller: ReplayController = {
    status: playing ? 'playing' : stepIndex >= stepPlan.replayLastStep ? 'ended' : 'paused',
    currentEventIndex: stepIndex - 1,
    speed,
  };
  const pauseAnd = (action: () => void) => {
    setPlaying(false);
    action();
  };
  const switchRound = (nextRound: number) => {
    const selection = selectReplayRound(nextRound, replay.log.rounds.length);
    setPlaying(selection.playing);
    setRoundIndex(selection.roundIndex);
    setStepIndex(selection.stepIndex);
  };
  const isResultStep = stepPlan.hasResultStep && stepIndex === stepPlan.replayLastStep;
  const currentActionSummary = isResultStep
    ? roundResultSummary(round.result)
    : built.currentAction ? actionLabel(built.currentAction.type) : '配牌完成';
  const roundOptions = replay.log.rounds.map((entry, index) => {
    const initialScores = initialScoresForRound(replay.log, index);
    const reconstructed = buildReplayState(entry, replayActions(entry).length, {
      scores: initialScores,
      playerNames: replay.playerNames,
      ruleConfig: replay.log.ruleConfig,
    });
    const finalScores = resolveReplayFinalScores(entry, initialScores)
      ?? reconstructed.gameState.players.map((player) => player.score) as [number, number, number, number];
    return {
      id: entry.roundId,
      label: `${roundLabel(entry)} · ${entry.honba}本场`,
      summary: `${roundResultSummary(entry.result)} · ${scoreDeltaSummary(entry, initialScores, finalScores, replay.playerNames)}`,
    };
  });

  return (
    <main className="replay-screen" aria-label="牌谱逐步回放" data-testid="replay-screen">
      <ReplayTopBar
        roundLabel={`${roundLabel(round)} · ${round.honba}本场`}
        stepIndex={stepIndex}
        totalSteps={stepPlan.replayLastStep}
        actionSummary={currentActionSummary}
        playerNames={replay.playerNames}
        cameraPlayerId={perspective.cameraPlayerId}
        isOpenHands={perspective.isOpenHands}
        wallOpen={wallOpen}
        onBack={onBack}
        onPerspectiveChange={(playerId) => pauseAnd(() => setPerspective((current) => selectCameraPlayer(current, playerId)))}
        onToggleOpenHands={() => pauseAnd(() => setPerspective(toggleOpenHands))}
        onToggleWall={() => setWallOpen((current) => !current)}
        testModeEnabled={testModeEnabled}
        testModeConversionReason={testScenarioConversion && !testScenarioConversion.ok ? testScenarioConversion.reason : undefined}
        onConvertToTestScenario={testScenarioConversion?.ok && onConvertToTestScenario
          ? () => onConvertToTestScenario(testScenarioConversion.scenario)
          : undefined}
      />

      <section className="replay-table-viewport">
        <div className="replay-status-overlay" aria-live="polite">
          <strong>{currentActionSummary}</strong>
          <span>{replayPhaseLabel(built.gameState.phase)}</span>
        </div>
        <ReplayTable replayState={built} perspective={perspective} />
        <ReplayWallDrawer
          open={wallOpen}
          replayState={built}
          allOpen={perspective.isOpenHands}
          cameraPlayerId={perspective.cameraPlayerId}
          onClose={() => setWallOpen(false)}
        />
      </section>

      <ReplayBottomBar
        controller={controller}
        totalSteps={stepPlan.replayLastStep}
        stepIndex={stepIndex}
        rounds={roundOptions}
        roundIndex={roundIndex}
        onRoundChange={switchRound}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onStepForward={() => pauseAnd(() => setStepIndex((current) => Math.min(stepPlan.replayLastStep, current + 1)))}
        onStepBackward={() => pauseAnd(() => setStepIndex((current) => Math.max(0, current - 1)))}
        onSeekStart={() => pauseAnd(() => setStepIndex(0))}
        onSeekEnd={() => pauseAnd(() => setStepIndex(stepPlan.replayLastStep))}
        onSeekStep={(step) => pauseAnd(() => setStepIndex(Math.max(0, Math.min(step, stepPlan.replayLastStep))))}
        onSpeedChange={setSpeed}
      />
      <ReplayResultStepDialog
        visible={isResultStep}
        replayState={built}
        result={round.result}
        initialScores={roundInitialScores}
        onClose={() => pauseAnd(() => setStepIndex(stepPlan.realLastStep))}
      />
    </main>
  );
}

export function ReplayTable({ replayState, perspective }: { replayState: BuiltReplayState; perspective: ReplayPerspectiveState }) {
  const state = replayState.gameState;
  const seatMapping = getReplaySeatMapping(perspective.cameraPlayerId);
  return (
    <section
      className="replay-table-shell"
      data-replay-view={`player-${perspective.cameraPlayerId + 1}`}
      data-open-hands={perspective.isOpenHands ? 'true' : 'false'}
    >
      <MahjongTable
        gameState={state}
        matchState={{ roundWind: replayState.roundInfo.roundWind, handNumber: replayState.roundInfo.handNumber as 1 | 2 | 3 | 4 }}
        seatMapping={seatMapping}
        revealOpponentHands={perspective.isOpenHands}
        sameTileHoverEnabled={false}
        tsumoGiriDisplayEnabled
      />
      <LocalHandArea
        player={state.players[seatMapping.bottomPlayerId]}
        isCurrent={state.currentPlayer === seatMapping.bottomPlayerId}
        canDiscard={false}
        onDiscard={() => undefined}
        doraIndicators={state.doraIndicators}
        sameTileHoverEnabled={false}
        tsumoGiriDisplayEnabled
      />
    </section>
  );
}

export function ReplayResultStepDialog({
  visible,
  replayState,
  result,
  initialScores,
  onClose,
}: {
  visible: boolean;
  replayState: BuiltReplayState;
  result?: RoundResult;
  initialScores: [number, number, number, number];
  onClose: () => void;
}) {
  if (!visible || !result) return null;
  return (
    <ResultDialog
      gameState={{ ...replayState.gameState, result }}
      onReset={onClose}
      continueLabel="返回牌桌"
      displayPointDeltas={replayState.gameState.players.map((player, index) => player.score - initialScores[index])}
      resultRiichiSticks={replayState.settlementRiichiSticks ?? replayState.gameState.riichiSticks}
    />
  );
}

export function selectCameraPlayer(current: ReplayPerspectiveState, playerId: PlayerId): ReplayPerspectiveState {
  return {
    ...current,
    cameraPlayerId: playerId,
  };
}

export function toggleOpenHands(current: ReplayPerspectiveState): ReplayPerspectiveState {
  return {
    ...current,
    isOpenHands: !current.isOpenHands,
  };
}

export function getReplaySeatMapping(cameraPlayerId: PlayerId): TableSeatMapping {
  return {
    bottomPlayerId: cameraPlayerId,
    rightPlayerId: ((cameraPlayerId + 1) % 4) as PlayerId,
    topPlayerId: ((cameraPlayerId + 2) % 4) as PlayerId,
    leftPlayerId: ((cameraPlayerId + 3) % 4) as PlayerId,
  };
}

export function selectReplayRound(nextRound: number, roundCount: number) {
  return {
    playing: false,
    roundIndex: Math.max(0, Math.min(nextRound, Math.max(0, roundCount - 1))),
    stepIndex: 0,
  };
}

export interface ReplayStepPlan {
  realLastStep: number;
  replayLastStep: number;
  hasResultStep: boolean;
}

export function replayStepPlan(round?: RoundLog): ReplayStepPlan {
  const realLastStep = round ? replayActions(round).length : 0;
  const hasResultStep = Boolean(round?.result);
  return {
    realLastStep,
    replayLastStep: realLastStep + (hasResultStep ? 1 : 0),
    hasResultStep,
  };
}

function roundLabel(round: RoundLog): string {
  return `${{ east: '东', south: '南', west: '西', north: '北' }[round.roundWind]}${round.handNumber}局`;
}

function roundResultSummary(result?: RoundResult): string {
  if (!result) return '进行中';
  if (result.type === 'tsumo') return `自摸 · ${winnerNames(result)}`;
  if (result.type === 'ron') return `荣和 · ${winnerNames(result)}`;
  return '流局';
}

function winnerNames(result: Extract<RoundResult, { type: 'tsumo' | 'ron' }>): string {
  return result.winners.map((winner) => `玩家${winner.winner + 1}`).join('、');
}

export function scoreDeltaSummary(
  round: RoundLog,
  initialScores: [number, number, number, number],
  finalScores: [number, number, number, number],
  playerNames: [string, string, string, string],
): string {
  const winds = ['东家', '南家', '西家', '北家'];
  return finalScores.map((score, playerId) => {
    const delta = score - initialScores[playerId];
    const sign = delta > 0 ? '+' : delta < 0 ? '-' : '±';
    const seatWind = winds[(playerId - round.dealer + 4) % 4];
    return `${seatWind} ${playerNames[playerId]} ${sign}${Math.abs(delta).toLocaleString('zh-CN')}`;
  }).join(' / ');
}

function actionLabel(type: string): string {
  return {
    'tile-drawn': '摸牌',
    'tile-discarded': '弃牌',
    'chi-declared': '吃',
    'pon-declared': '碰',
    'minkan-declared': '大明杠',
    'ankan-declared': '暗杠',
    'kakan-declared': '加杠',
    'riichi-declared': '立直',
    'dora-revealed': '新增宝牌指示牌',
    'ron-declared': '荣和',
    'tsumo-declared': '自摸',
    'abortive-draw': '途中流局',
    'exhaustive-draw': '荒牌流局',
    'round-ended': '点数结算',
  }[type] ?? type;
}
