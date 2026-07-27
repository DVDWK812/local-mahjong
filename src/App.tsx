import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppScreen, RiichiLengthChoice, SetupSelection } from './app/navigation';
import { matchLengthForChoice, pathLabel, presetForChoice } from './app/navigation';
import { BackButton } from './components/BackButton';
import { Board } from './components/Board';
import { ExitGameDialog } from './components/ExitGameDialog';
import { GameTypeMenu } from './components/GameTypeMenu';
import { LocalModeMenu } from './components/LocalModeMenu';
import { MainMenu } from './components/MainMenu';
import { MatchResultDialog } from './components/MatchResultDialog';
import { MatchSettings } from './components/MatchSettings';
import { ReplayLibrary } from './components/ReplayLibrary';
import { ReplayScreen } from './components/ReplayScreen';
import { RiichiModeMenu } from './components/RiichiModeMenu';
import { RulesGuideScreen } from './components/rulesGuide/RulesGuideScreen';
import { advanceAIAction, isAIPlayer } from './game/ai';
import { declareKyuushuKyuuhai } from './game/abortiveDraw';
import { canPon, executePon, passCall } from './game/callChecker';
import { canChi, executeChi } from './game/chiChecker';
import { declareRiichi, declareRon, declareTsumo, discardTile, drawTile, passRon } from './game/engine';
import { hasDrawAction } from './game/interaction';
import { canChankan, canMinkan, declareChankanRon, executeKan, passChankan, type KanType } from './game/kanChecker';
import { applyFinishedGameToMatch, chooseAgariYame, chooseMatchEnd, startMatch } from './game/match/matchEngine';
import { getRulePreset, loadStoredRuleConfig, saveStoredRuleConfig, type RulePresetId } from './game/match/matchRules';
import type { FullRuleConfig, MatchState } from './game/match/types';
import { LocalStorageAdapter } from './game/persistence/saveManager';
import type { ReplayMetadata, SavedMatch } from './game/persistence/storageTypes';
import { CURRENT_SAVE_VERSION } from './game/persistence/storageTypes';
import { createInitialMatchLog } from './game/replay/eventRecorder';
import { createReplay, pause, play, seekToEvent, setPlaybackSpeed, stepBackward, stepForward, type Replay } from './game/replay/replayEngine';
import type { GameState, PlayerId, TileId } from './game/types';

interface ActiveGame {
  matchState: MatchState;
  gameState: GameState;
}

interface AppState {
  screen: AppScreen;
  activeGame: ActiveGame | null;
  ruleConfig: FullRuleConfig;
  presetId: RulePresetId;
  selection: SetupSelection;
  menuNotice: string | null;
  savedMatch: SavedMatch | null;
  replayMetas: ReplayMetadata[];
  replay: Replay | null;
  exitDialogOpen: boolean;
  exiting: boolean;
  exitSaveError: string | null;
  rulesGuideOpen: boolean;
}

const storage = typeof window === 'undefined' ? null : new LocalStorageAdapter(window.localStorage);
const EXIT_SAVE_TIMEOUT_MS = 3000;
const EXIT_SAVE_TIMEOUT_MESSAGE = '牌谱保存超时，可直接退出或重试保存。';
const EXIT_SAVE_ERROR_MESSAGE = '牌谱保存失败，可直接退出或重试保存。';

function withRules(gameState: GameState, config: FullRuleConfig): GameState {
  return { ...gameState, ruleConfig: config.round, matchRuleConfig: config.match };
}

function loadInitialRuleConfig(): FullRuleConfig {
  if (typeof window === 'undefined') return getRulePreset('east-round');
  return loadStoredRuleConfig(window.localStorage);
}

function createActiveGame(config: FullRuleConfig): ActiveGame {
  const matchState = startMatch(config.match);
  if (!matchState.currentGame) throw new Error('比赛未能创建东一局');
  return { matchState, gameState: withRules(matchState.currentGame, config) };
}

function createSavedMatch(activeGame: ActiveGame, ruleConfig: FullRuleConfig): SavedMatch {
  return {
    version: CURRENT_SAVE_VERSION,
    saveId: `save-${Date.now()}`,
    savedAt: new Date().toISOString(),
    matchState: activeGame.matchState,
    gameState: activeGame.gameState,
    matchLog: createInitialMatchLog({
      initialDealer: activeGame.matchState.initialDealer,
      initialScores: [ruleConfig.match.startingPoints, ruleConfig.match.startingPoints, ruleConfig.match.startingPoints, ruleConfig.match.startingPoints],
      ruleConfig,
    }),
    ruleConfig,
  };
}

export default function App() {
  const [state, setState] = useState<AppState>(() => ({
    screen: 'main-menu',
    activeGame: null,
    ruleConfig: loadInitialRuleConfig(),
    presetId: 'east-round',
    selection: {},
    menuNotice: null,
    savedMatch: null,
    replayMetas: [],
    replay: null,
    exitDialogOpen: false,
    exiting: false,
    exitSaveError: null,
    rulesGuideOpen: false,
  }));

  const mountedRef = useRef(false);
  const exitSaveInProgressRef = useRef(false);
  const pendingExitSaveRef = useRef<SavedMatch | null>(null);
  const activeGame = state.activeGame;
  const gameState = activeGame?.gameState;
  const matchState = activeGame?.matchState;
  const settingsPath = useMemo(() => pathLabel(state.selection), [state.selection]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!storage) return;
    void storage.loadCurrentMatch()
      .then((save) => {
        if (mountedRef.current) setState((current) => ({ ...current, savedMatch: save }));
      })
      .catch(() => {
        if (mountedRef.current) setState((current) => ({ ...current, savedMatch: null }));
      });
    void storage.listReplays()
      .then((replays) => {
        if (mountedRef.current) setState((current) => ({ ...current, replayMetas: replays }));
      })
      .catch(() => {
        if (mountedRef.current) setState((current) => ({ ...current, replayMetas: [] }));
      });
  }, []);

  useEffect(() => {
    if (state.screen !== 'game' || !gameState || !matchState || state.exitDialogOpen || state.exiting) return;
    if (matchState.phase === 'match-end-choice' && matchState.pendingEndChoice && isAIPlayer(matchState.pendingEndChoice.dealer)) {
      const timer = window.setTimeout(() => {
        setState((current) => {
          if (!current.activeGame) return current;
          const applied = chooseMatchEnd(current.activeGame.matchState, chooseAgariYame(current.activeGame.matchState));
          return {
            ...current,
            activeGame: {
              matchState: applied.match,
              gameState: applied.nextGameState ? withRules(applied.nextGameState, current.ruleConfig) : current.activeGame.gameState,
            },
          };
        });
      }, 300);
      return () => window.clearTimeout(timer);
    }

    const shouldAutoDrawHuman = gameState.currentPlayer === 0 && gameState.phase === 'draw';
    const shouldAutoRiichiTsumogiri = gameState.currentPlayer === 0
      && gameState.phase === 'discard'
      && gameState.players[0].riichi
      && !!gameState.players[0].drawnTile
      && !hasDrawAction(gameState, 0);
    const shouldAutoAdvanceAI = isAIPlayer(gameState.currentPlayer) && (gameState.phase === 'draw' || gameState.phase === 'discard');
    const shouldAutoPassCall = gameState.phase === 'call-window' && !canPon(gameState, 0) && !canChi(gameState, 0) && !canMinkan(gameState, 0);
    const shouldAutoChankan = gameState.phase === 'chankan-window' && !canChankan(gameState, 0);
    if (!shouldAutoDrawHuman && !shouldAutoRiichiTsumogiri && !shouldAutoAdvanceAI && !shouldAutoPassCall && !shouldAutoChankan) return;

    const timer = window.setTimeout(() => {
      setState((current) => {
        if (!current.activeGame || current.screen !== 'game' || current.exitDialogOpen || current.exiting) return current;
        const currentGame = current.activeGame.gameState;
        if (currentGame.currentPlayer === 0 && currentGame.phase === 'draw') {
          return { ...current, activeGame: { ...current.activeGame, gameState: drawTile(currentGame, { settleTsumo: false }) } };
        }
        if (
          currentGame.currentPlayer === 0
          && currentGame.phase === 'discard'
          && currentGame.players[0].riichi
          && currentGame.players[0].drawnTile
          && !hasDrawAction(currentGame, 0)
        ) {
          return { ...current, activeGame: { ...current.activeGame, gameState: discardTile(currentGame, 0, currentGame.players[0].drawnTile.instanceId) } };
        }
        return { ...current, activeGame: { ...current.activeGame, gameState: advanceAIAction(currentGame) } };
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [state.screen, state.exitDialogOpen, state.exiting, gameState?.currentPlayer, gameState?.phase, gameState?.turn, gameState?.players[0].drawnTile?.instanceId, matchState?.phase]);

  function setScreen(screen: AppScreen, patch: Partial<AppState> = {}) {
    setState((current) => ({ ...current, screen, menuNotice: null, ...patch }));
  }

  function updateGame(updater: (game: GameState) => GameState) {
    setState((current) => current.activeGame
      ? { ...current, activeGame: { ...current.activeGame, gameState: updater(current.activeGame.gameState) } }
      : current);
  }

  function handleRuleConfigChange(config: FullRuleConfig) {
    setState((current) => ({ ...current, ruleConfig: config, presetId: 'custom' }));
    if (typeof window !== 'undefined') saveStoredRuleConfig(config, window.localStorage);
  }

  function chooseLength(choice: RiichiLengthChoice) {
    const preset = presetForChoice(choice);
    const presetConfig = getRulePreset(preset);
    const config = {
      ...presetConfig,
      match: { ...presetConfig.match, matchLength: matchLengthForChoice(choice) },
    };
    setState((current) => ({
      ...current,
      screen: 'match-settings',
      presetId: preset,
      ruleConfig: config,
      selection: { ...current.selection, playerCount: 4, lengthChoice: choice },
      menuNotice: null,
    }));
  }

  function startConfiguredGame() {
    setState((current) => ({
      ...current,
      screen: 'game',
      activeGame: createActiveGame(current.ruleConfig),
      exitDialogOpen: false,
      exiting: false,
      exitSaveError: null,
      rulesGuideOpen: false,
      menuNotice: null,
    }));
  }

  function continueSavedMatch() {
    setState((current) => {
      if (!current.savedMatch) return { ...current, menuNotice: '没有可继续的对局。' };
      const matchState = current.savedMatch.matchState;
      const gameState = withRules(current.savedMatch.gameState ?? matchState.currentGame!, current.savedMatch.ruleConfig);
      return {
        ...current,
        screen: 'game',
        activeGame: { matchState, gameState },
        ruleConfig: current.savedMatch.ruleConfig,
        exitDialogOpen: false,
        exiting: false,
        exitSaveError: null,
        rulesGuideOpen: false,
        menuNotice: null,
      };
    });
  }

  function handleNextRoundOrResult() {
    setState((current) => {
      if (!current.activeGame?.gameState.result) return current;
      const applied = applyFinishedGameToMatch(current.activeGame.matchState, current.activeGame.gameState);
      return {
        ...current,
        activeGame: {
          matchState: applied.match,
          gameState: applied.nextGameState ? withRules(applied.nextGameState, current.ruleConfig) : current.activeGame.gameState,
        },
      };
    });
  }

  async function saveExitMatchWithTimeout(save: SavedMatch): Promise<'saved' | 'timeout'> {
    if (!storage) return 'saved';
    let timeoutId: ReturnType<typeof window.setTimeout> | null = null;
    try {
      return await Promise.race([
        storage.saveCurrentMatch(save).then(() => 'saved' as const),
        new Promise<'timeout'>((resolve) => {
          timeoutId = window.setTimeout(() => resolve('timeout'), EXIT_SAVE_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
  }

  function returnToMainMenu(savedMatch: SavedMatch | null = null) {
    pendingExitSaveRef.current = null;
    if (!mountedRef.current) return;
    setState((current) => ({
      ...current,
      screen: 'main-menu',
      activeGame: null,
      exitDialogOpen: false,
      exiting: false,
      exitSaveError: null,
      savedMatch: savedMatch ?? current.savedMatch,
      menuNotice: null,
    }));
  }

  async function confirmExitGame() {
    if (state.exiting || exitSaveInProgressRef.current) return;
    const snapshot = state.activeGame;
    const save = snapshot && snapshot.matchState.phase !== 'match-ended'
      ? pendingExitSaveRef.current ?? createSavedMatch(snapshot, state.ruleConfig)
      : null;
    pendingExitSaveRef.current = save;
    exitSaveInProgressRef.current = true;
    if (mountedRef.current) setState((current) => ({ ...current, exiting: true, exitSaveError: null }));
    try {
      if (save) {
        const result = await saveExitMatchWithTimeout(save);
        if (result === 'timeout') {
          if (mountedRef.current) setState((current) => ({ ...current, exitSaveError: EXIT_SAVE_TIMEOUT_MESSAGE }));
          return;
        }
      }
      returnToMainMenu(save);
    } catch {
      if (mountedRef.current) setState((current) => ({ ...current, exitSaveError: EXIT_SAVE_ERROR_MESSAGE }));
    } finally {
      exitSaveInProgressRef.current = false;
      if (mountedRef.current) setState((current) => ({ ...current, exiting: false }));
    }
  }

  function cancelExitGame() {
    pendingExitSaveRef.current = null;
    setState((current) => ({ ...current, exitDialogOpen: false, exiting: false, exitSaveError: null }));
  }

  function exitWithoutSaving() {
    returnToMainMenu(null);
  }

  async function openReplayLibrary() {
    if (!storage) {
      setScreen('replay-library', { replayMetas: [] });
      return;
    }
    const replays = await storage.listReplays().catch(() => []);
    if (mountedRef.current) setScreen('replay-library', { replayMetas: replays });
  }

  async function openReplay(id: string) {
    if (!storage) return;
    const log = await storage.loadReplay(id);
    if (log && mountedRef.current) setScreen('replay', { replay: createReplay(log) });
  }

  async function deleteReplay(id: string) {
    if (!storage) return;
    await storage.deleteReplay(id);
    const replays = await storage.listReplays().catch(() => []);
    if (mountedRef.current) setState((current) => ({ ...current, replayMetas: replays }));
  }

  if (state.screen === 'main-menu') {
    return (
      <MainMenu
        hasSave={!!state.savedMatch}
        notice={state.menuNotice}
        onContinue={continueSavedMatch}
        onLocalMode={() => setScreen('local-mode-menu')}
        onOnlineMode={() => setState((current) => ({ ...current, menuNotice: '联机模式敬请期待。' }))}
        onReplayStudy={() => void openReplayLibrary()}
      />
    );
  }

  if (state.screen === 'local-mode-menu') {
    return (
      <LocalModeMenu
        notice={state.menuNotice}
        onBack={() => setScreen('main-menu')}
        onRiichi={() => setScreen('riichi-player-count')}
        onComingSoon={(label) => setState((current) => ({ ...current, menuNotice: `${label}敬请期待。` }))}
      />
    );
  }

  if (state.screen === 'riichi-player-count') {
    return (
      <RiichiModeMenu
        notice={state.menuNotice}
        onBack={() => setScreen('local-mode-menu')}
        onFourPlayer={() => setScreen('riichi-four-player-length', { selection: { playerCount: 4 } })}
        onThreePlayer={() => setState((current) => ({ ...current, menuNotice: '三人间敬请期待。' }))}
        onRulesGuide={() => setScreen('rules-guide')}
      />
    );
  }

  if (state.screen === 'rules-guide') {
    return <RulesGuideScreen ruleConfig={state.ruleConfig} onBack={() => setScreen('riichi-player-count')} />;
  }

  if (state.screen === 'riichi-four-player-length') {
    return <GameTypeMenu onBack={() => setScreen('riichi-player-count')} onEast={() => chooseLength('four-east')} onSouth={() => chooseLength('four-south')} />;
  }

  if (state.screen === 'match-settings') {
    const matchTypeLabel = state.selection.lengthChoice === 'four-south' ? '四人南' : '四人东';
    return (
      <main className="menu-page">
        <section className="menu-panel menu-panel--wide">
          <p className="menu-path">{settingsPath}</p>
          <MatchSettings
            config={state.ruleConfig}
            pathLabel={settingsPath}
            matchTypeLabel={matchTypeLabel}
            onConfigChange={handleRuleConfigChange}
          />
          <div className="settings-footer">
            <button type="button" onClick={() => setScreen('riichi-four-player-length')}>返回</button>
            <button type="button" onClick={startConfiguredGame}>开始游戏</button>
          </div>
        </section>
      </main>
    );
  }

  if (state.screen === 'replay-library') {
    return (
      <main className="menu-page">
        <section className="menu-panel menu-panel--wide">
          <BackButton onClick={() => setScreen('main-menu')} />
          <p className="menu-path">主菜单 ＞ 牌谱研习</p>
          <ReplayLibrary replays={state.replayMetas} onOpen={(id) => void openReplay(id)} onDelete={(id) => void deleteReplay(id)} />
        </section>
      </main>
    );
  }

  if (state.screen === 'replay' && state.replay) {
    return (
      <main className="menu-page">
        <section className="menu-panel menu-panel--wide">
          <BackButton onClick={() => setScreen('replay-library', { replay: null })} />
          <p className="menu-path">主菜单 ＞ 牌谱研习 ＞ 回放</p>
          <ReplayScreen
            replay={state.replay}
            onPlay={() => setState((current) => current.replay ? { ...current, replay: play(current.replay) } : current)}
            onPause={() => setState((current) => current.replay ? { ...current, replay: pause(current.replay) } : current)}
            onStepForward={() => setState((current) => current.replay ? { ...current, replay: stepForward(current.replay) } : current)}
            onStepBackward={() => setState((current) => current.replay ? { ...current, replay: stepBackward(current.replay) } : current)}
            onSeek={(index) => setState((current) => current.replay ? { ...current, replay: seekToEvent(current.replay, index) } : current)}
            onSpeedChange={(speed) => setState((current) => current.replay ? { ...current, replay: setPlaybackSpeed(current.replay, speed) } : current)}
          />
        </section>
      </main>
    );
  }

  if (!activeGame || !gameState || !matchState) return null;

  return (
    <>
      {matchState.phase === 'match-end-choice' && matchState.pendingEndChoice ? (
        <section className="call-panel call-panel--overlay">
          <strong>{matchState.pendingEndChoice.type === 'agari-yame' ? '和牌止' : '听牌止'}选择</strong>
          <div className="call-actions">
            <button type="button" onClick={() => {
              const applied = chooseMatchEnd(matchState, true);
              setState((current) => current.activeGame ? {
                ...current,
                activeGame: {
                  matchState: applied.match,
                  gameState: applied.nextGameState ? withRules(applied.nextGameState, current.ruleConfig) : current.activeGame.gameState,
                },
              } : current);
            }}>结束比赛</button>
            <button type="button" onClick={() => {
              const applied = chooseMatchEnd(matchState, false);
              setState((current) => current.activeGame ? {
                ...current,
                activeGame: {
                  matchState: applied.match,
                  gameState: applied.nextGameState ? withRules(applied.nextGameState, current.ruleConfig) : current.activeGame.gameState,
                },
              } : current);
            }}>继续连庄</button>
          </div>
        </section>
      ) : null}
      <Board
        gameState={gameState}
        matchState={matchState}
        onTsumo={(playerId) => updateGame((current) => declareTsumo(current, playerId))}
        onRon={(playerId) => updateGame((current) => declareRon(current, playerId))}
        onPassRon={(playerId) => updateGame((current) => passRon(current, playerId))}
        onDiscard={(playerId, tileInstanceId) => updateGame((current) => discardTile(current, playerId, tileInstanceId))}
        onDeclareRiichi={(playerId, tileInstanceId) => updateGame((current) => {
          const riichiState = declareRiichi(current, playerId);
          return tileInstanceId ? discardTile(riichiState, playerId, tileInstanceId) : riichiState;
        })}
        onDeclareKyuushuKyuuhai={(playerId) => updateGame((current) => declareKyuushuKyuuhai(current, playerId))}
        onPon={(playerId) => updateGame((current) => executePon(current, playerId))}
        onChi={(playerId, optionIndex) => updateGame((current) => executeChi(current, playerId, optionIndex))}
        onKan={(playerId, kanType, tileId) => updateGame((current) => executeKan(current, playerId, kanType, tileId))}
        onChankanRon={(playerId) => updateGame((current) => declareChankanRon(current, playerId))}
        onPassChankan={(playerId) => updateGame((current) => passChankan(current, playerId))}
        onPassCall={() => updateGame((current) => passCall(current))}
        onSkipDrawActions={() => updateGame((current) => {
          const drawnTile = current.players[0].drawnTile;
          return current.players[0].riichi && current.currentPlayer === 0 && current.phase === 'discard' && drawnTile
            ? discardTile(current, 0, drawnTile.instanceId)
            : current;
        })}
        onReset={handleNextRoundOrResult}
        onOpenRulesGuide={() => setState((current) => ({ ...current, rulesGuideOpen: true }))}
        onReturnMenu={() => matchState.phase === 'match-ended' ? void confirmExitGame() : setState((current) => current.exitDialogOpen
          ? current
          : { ...current, exitDialogOpen: true, exitSaveError: null })}
      />
      {state.rulesGuideOpen ? (
        <RulesGuideScreen
          embedded
          ruleConfig={state.ruleConfig}
          onBack={() => setState((current) => ({ ...current, rulesGuideOpen: false }))}
        />
      ) : null}
      <MatchResultDialog matchState={matchState} onNewMatch={() => setState((current) => ({ ...current, screen: 'main-menu', activeGame: null }))} />
      {state.exitDialogOpen ? (
        <ExitGameDialog
          matchEnded={matchState.phase === 'match-ended'}
          saving={state.exiting}
          error={state.exitSaveError}
          onCancel={cancelExitGame}
          onConfirm={() => void confirmExitGame()}
          onRetry={() => void confirmExitGame()}
          onExitWithoutSaving={exitWithoutSaving}
        />
      ) : null}
    </>
  );
}

export type { KanType, PlayerId, TileId };
