import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppScreen, RiichiLengthChoice, SetupSelection } from './app/navigation';
import { matchLengthForChoice, pathLabel, presetForChoice } from './app/navigation';
import { APP_SETTINGS_LOAD_FAILURE_NOTICE, loadAppSettings, persistAppSettingsUpdate, type AppSettingsV1, type ResolutionPreset } from './app/appSettings';
import { BackButton } from './components/BackButton';
import { Board } from './components/Board';
import { ExitGameDialog } from './components/ExitGameDialog';
import { GameTypeMenu } from './components/GameTypeMenu';
import { LocalModeMenu } from './components/LocalModeMenu';
import { MainMenu } from './components/MainMenu';
import { MatchResultDialog } from './components/MatchResultDialog';
import { DEFAULT_AI_PLAYER_SETTINGS, MatchSettings, type AIPlayerSetting } from './components/MatchSettings';
import { ReplayLibrary } from './components/ReplayLibrary';
import { ReplayDetail } from './components/ReplayDetail';
import { TestModeScreen } from './components/TestModeScreen';
import { RiichiModeMenu } from './components/RiichiModeMenu';
import { RulesGuideScreen } from './components/rulesGuide/RulesGuideScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { AppResolutionViewport } from './components/layout/AppResolutionViewport';
import { DesktopTableViewport } from './components/layout/DesktopTableViewport';
import { advanceAIAction, isAIPlayer } from './game/ai';
import { declareKyuushuKyuuhai } from './game/abortiveDraw';
import { canPon, executePon, passCall } from './game/callChecker';
import { canChi, executeChi } from './game/chiChecker';
import { declareRiichi, declareRon, declareTsumo, discardTile, drawTile, passRon } from './game/engine';
import { hasDrawAction } from './game/interaction';
import { canChankan, canMinkan, declareChankanRon, executeKan, passChankan, type KanType } from './game/kanChecker';
import { applyFinishedGameToMatch, chooseAgariYame, chooseMatchEnd, startMatch } from './game/match/matchEngine';
import { createRuleConfigStorageAdapter, getRulePreset, loadStoredRuleConfig, persistRuleConfigUpdate, type RulePresetId } from './game/match/matchRules';
import type { FullRuleConfig, MatchState } from './game/match/types';
import { LocalStorageAdapter } from './game/persistence/saveManager';
import { createReplayRecord } from './game/persistence/replayRecord';
import type { ReplayMetadata, ReplayRecord, SavedMatch } from './game/persistence/storageTypes';
import { CURRENT_SAVE_VERSION } from './game/persistence/storageTypes';
import { createInitialMatchLog, finishMatchLog, recordGameStateTransition, startRoundInMatchLog } from './game/replay/eventRecorder';
import type { MatchLog } from './game/replay/types';
import type { GameState, PlayerId, TileId } from './game/types';
import { currentTestModeAvailability } from './game/testMode/availability';
import type { TestScenarioV1 } from './game/testMode/types';

interface ActiveGame {
  matchState: MatchState;
  gameState: GameState;
  matchLog: MatchLog;
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
  replay: ReplayRecord | null;
  exitDialogOpen: boolean;
  exiting: boolean;
  exitSaveError: string | null;
  rulesGuideOpen: boolean;
  doraGlowEnabled: boolean;
  sameTileHoverEnabled: boolean;
  showTenpaiWaitsEnabled: boolean;
  tsumoGiriDisplayEnabled: boolean;
  aiPlayerSettings: AIPlayerSetting[];
  testScenario: TestScenarioV1 | null;
  appSettings: AppSettingsV1;
  appSettingsNotice: string | null;
}

const browserLocalStorage = getBrowserLocalStorage();
const storage = browserLocalStorage ? new LocalStorageAdapter(browserLocalStorage) : null;
const ruleConfigStorage = browserLocalStorage ? createRuleConfigStorageAdapter(browserLocalStorage) : null;
const appSettingsStorage = ruleConfigStorage;
const EXIT_SAVE_TIMEOUT_MS = 3000;
const EXIT_SAVE_TIMEOUT_MESSAGE = '牌谱保存超时，可直接退出或重试保存。';
const EXIT_SAVE_ERROR_MESSAGE = '牌谱保存失败，可直接退出或重试保存。';

function getBrowserLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function withRules(gameState: GameState, config: FullRuleConfig): GameState {
  return { ...gameState, ruleConfig: config.round, matchRuleConfig: config.match };
}

function loadInitialRuleConfig(): FullRuleConfig {
  if (!ruleConfigStorage) return getRulePreset('east-round');
  return loadStoredRuleConfig(ruleConfigStorage);
}

function createActiveGame(config: FullRuleConfig): ActiveGame {
  const matchState = startMatch(config.match);
  if (!matchState.currentGame) throw new Error('比赛未能创建东一局');
  const gameState = withRules(matchState.currentGame, config);
  const emptyLog = createInitialMatchLog({
    playerNames: gameState.players.map((player) => player.name) as [string, string, string, string],
    initialDealer: matchState.initialDealer,
    initialScores: [...matchState.scores],
    ruleConfig: config,
  });
  return {
    matchState,
    gameState,
    matchLog: startRoundInMatchLog(emptyLog, gameState, matchState.handNumber),
  };
}

function updateActiveGameState(activeGame: ActiveGame, gameState: GameState): ActiveGame {
  return {
    ...activeGame,
    gameState,
    matchLog: recordGameStateTransition(activeGame.matchLog, activeGame.gameState, gameState),
  };
}

function applyMatchProgress(activeGame: ActiveGame, matchState: MatchState, nextGameState: GameState | undefined, config: FullRuleConfig): ActiveGame {
  if (matchState.phase === 'match-ended' && matchState.finalResult) {
    return {
      ...activeGame,
      matchState,
      matchLog: finishMatchLog(activeGame.matchLog, matchState.finalResult),
    };
  }
  if (nextGameState) {
    const gameState = withRules(nextGameState, config);
    return {
      matchState,
      gameState,
      matchLog: startRoundInMatchLog(activeGame.matchLog, gameState, matchState.handNumber),
    };
  }
  return { ...activeGame, matchState };
}

function createSavedMatch(activeGame: ActiveGame, ruleConfig: FullRuleConfig): SavedMatch {
  return {
    version: CURRENT_SAVE_VERSION,
    saveId: `save-${Date.now()}`,
    savedAt: new Date().toISOString(),
    matchState: activeGame.matchState,
    gameState: activeGame.gameState,
    matchLog: activeGame.matchLog,
    ruleConfig,
  };
}

export default function App() {
  const testModeAvailability = currentTestModeAvailability();
  const [state, setState] = useState<AppState>(() => {
    const appSettingsResult = loadAppSettings(appSettingsStorage ?? undefined);
    return {
      screen: testModeAvailability.requested ? 'test-mode' : 'main-menu',
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
      doraGlowEnabled: true,
      sameTileHoverEnabled: true,
      showTenpaiWaitsEnabled: true,
      tsumoGiriDisplayEnabled: true,
      aiPlayerSettings: DEFAULT_AI_PLAYER_SETTINGS.map((setting) => ({ ...setting })),
      testScenario: null,
      appSettings: appSettingsResult.settings,
      appSettingsNotice: appSettingsResult.ok ? null : APP_SETTINGS_LOAD_FAILURE_NOTICE,
    };
  });

  const mountedRef = useRef(false);
  const exitSaveInProgressRef = useRef(false);
  const pendingExitSaveRef = useRef<SavedMatch | null>(null);
  const pendingExitReplayRef = useRef<ReplayRecord | null>(null);
  const automaticallySavedReplayIdsRef = useRef(new Set<string>());
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
    if (!storage || !activeGame || matchState?.phase !== 'match-ended' || !matchState.finalResult) return;
    const completedLog = finishMatchLog(activeGame.matchLog, matchState.finalResult);
    if (automaticallySavedReplayIdsRef.current.has(completedLog.matchId)) return;
    const record = createReplayRecord({ log: completedLog, matchState, completed: true });
    void storage.saveReplay(record).then(async () => {
      automaticallySavedReplayIdsRef.current.add(record.id);
      await storage.deleteCurrentMatch();
      const replays = await storage.listReplays();
      if (mountedRef.current) {
        setState((current) => ({
          ...current,
          replayMetas: replays,
          savedMatch: null,
          activeGame: current.activeGame?.matchLog.matchId === completedLog.matchId
            ? { ...current.activeGame, matchLog: completedLog }
            : current.activeGame,
        }));
      }
    }).catch(() => undefined);
  }, [activeGame, matchState?.phase, matchState?.finalResult]);

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
            activeGame: applyMatchProgress(current.activeGame, applied.match, applied.nextGameState, current.ruleConfig),
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
          return { ...current, activeGame: updateActiveGameState(current.activeGame, drawTile(currentGame, { settleTsumo: false })) };
        }
        if (
          currentGame.currentPlayer === 0
          && currentGame.phase === 'discard'
          && currentGame.players[0].riichi
          && currentGame.players[0].drawnTile
          && !hasDrawAction(currentGame, 0)
        ) {
          return { ...current, activeGame: updateActiveGameState(current.activeGame, discardTile(currentGame, 0, currentGame.players[0].drawnTile.instanceId)) };
        }
        return { ...current, activeGame: updateActiveGameState(current.activeGame, advanceAIAction(currentGame)) };
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [state.screen, state.exitDialogOpen, state.exiting, gameState?.currentPlayer, gameState?.phase, gameState?.turn, gameState?.players[0].drawnTile?.instanceId, matchState?.phase]);

  function setScreen(screen: AppScreen, patch: Partial<AppState> = {}) {
    setState((current) => ({ ...current, screen, menuNotice: null, ...patch }));
  }

  function updateGame(updater: (game: GameState) => GameState) {
    setState((current) => {
      if (!current.activeGame) return current;
      const before = current.activeGame.gameState;
      const gameState = updater(before);
      return {
        ...current,
        activeGame: {
          ...current.activeGame,
          gameState,
          matchLog: recordGameStateTransition(current.activeGame.matchLog, before, gameState),
        },
      };
    });
  }

  function handleRuleConfigChange(config: FullRuleConfig) {
    const outcome = ruleConfigStorage
      ? persistRuleConfigUpdate(config, ruleConfigStorage)
      : { config, notice: null };
    setState((current) => ({
      ...current,
      ruleConfig: outcome.config,
      presetId: 'custom',
      menuNotice: outcome.notice,
    }));
  }

  function handleResolutionPresetChange(resolutionPreset: ResolutionPreset) {
    const settings: AppSettingsV1 = { ...state.appSettings, resolutionPreset };
    const outcome = persistAppSettingsUpdate(settings, appSettingsStorage ?? undefined);
    setState((current) => ({
      ...current,
      appSettings: outcome.settings,
      appSettingsNotice: outcome.notice,
    }));
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
      doraGlowEnabled: true,
      sameTileHoverEnabled: true,
      showTenpaiWaitsEnabled: true,
      tsumoGiriDisplayEnabled: true,
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
      const matchLog = current.savedMatch.matchLog.rounds.length > 0
        ? current.savedMatch.matchLog
        : startRoundInMatchLog(current.savedMatch.matchLog, gameState, matchState.handNumber);
      return {
        ...current,
        screen: 'game',
        activeGame: { matchState, gameState, matchLog },
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
        activeGame: applyMatchProgress(current.activeGame, applied.match, applied.nextGameState, current.ruleConfig),
      };
    });
  }

  async function saveExitMatchWithTimeout(save: SavedMatch | null, replayRecord: ReplayRecord): Promise<'saved' | 'timeout'> {
    if (!storage) return 'saved';
    let timeoutId: ReturnType<typeof window.setTimeout> | null = null;
    try {
      return await Promise.race([
        Promise.all([
          save ? storage.saveCurrentMatch(save) : storage.deleteCurrentMatch(),
          storage.saveReplay(replayRecord),
        ]).then(() => 'saved' as const),
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
    pendingExitReplayRef.current = null;
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
    const completedLog = snapshot?.matchState.finalResult
      ? finishMatchLog(snapshot.matchLog, snapshot.matchState.finalResult)
      : snapshot?.matchLog;
    const replayRecord = snapshot && completedLog
      ? pendingExitReplayRef.current ?? createReplayRecord({
        log: completedLog,
        matchState: snapshot.matchState,
        scores: snapshot.gameState.players.map((player) => player.score) as [number, number, number, number],
        completed: snapshot.matchState.phase === 'match-ended',
      })
      : null;
    if (!replayRecord) {
      returnToMainMenu(save);
      return;
    }
    pendingExitSaveRef.current = save;
    pendingExitReplayRef.current = replayRecord;
    exitSaveInProgressRef.current = true;
    if (mountedRef.current) setState((current) => ({ ...current, exiting: true, exitSaveError: null }));
    try {
      const result = await saveExitMatchWithTimeout(save, replayRecord);
      if (result === 'timeout') {
        if (mountedRef.current) setState((current) => ({ ...current, exitSaveError: EXIT_SAVE_TIMEOUT_MESSAGE }));
        return;
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
    pendingExitReplayRef.current = null;
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
    const record = await storage.getReplay(id).catch(() => null);
    if (record && mountedRef.current) setScreen('replay-detail', { replay: record });
  }

  async function deleteReplay(id: string) {
    if (!storage) return;
    if (typeof window !== 'undefined' && !window.confirm('确定删除这份牌谱吗？删除后无法恢复。')) return;
    await storage.deleteReplay(id);
    const replays = await storage.listReplays().catch(() => []);
    if (mountedRef.current) setState((current) => ({ ...current, replayMetas: replays }));
  }

  async function renameReplay(id: string) {
    if (!storage || typeof window === 'undefined') return;
    const currentTitle = state.replayMetas.find((replay) => replay.id === id)?.title ?? '';
    const title = window.prompt('请输入新的牌谱标题', currentTitle);
    if (title === null || !title.trim()) return;
    await storage.renameReplay(id, title);
    const replays = await storage.listReplays();
    if (mountedRef.current) setState((current) => ({ ...current, replayMetas: replays }));
  }

  async function exportReplay(id: string) {
    if (!storage || typeof window === 'undefined') return;
    const json = await storage.exportReplay(id);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderScreen(content: ReactNode) {
    return <AppResolutionViewport preset={state.appSettings.resolutionPreset}>{content}</AppResolutionViewport>;
  }

  if (state.screen === 'main-menu') {
    return renderScreen(
      <MainMenu
        hasSave={!!state.savedMatch}
        notice={state.menuNotice}
        onContinue={continueSavedMatch}
        onLocalMode={() => setScreen('local-mode-menu')}
        onOnlineMode={() => setState((current) => ({ ...current, menuNotice: '联机模式敬请期待。' }))}
        onReplayStudy={() => void openReplayLibrary()}
        onSettings={() => setScreen('settings')}
        testModeEnabled={testModeAvailability.enabled}
        onTestMode={() => setScreen('test-mode', { testScenario: null })}
      />
    );
  }

  if (state.screen === 'settings') {
    return renderScreen(
      <DesktopTableViewport surface="settings" onReturnMenu={() => setScreen('main-menu')}>
        <SettingsScreen
          settings={state.appSettings}
          notice={state.appSettingsNotice}
          onResolutionPresetChange={handleResolutionPresetChange}
          onBack={() => setScreen('main-menu')}
        />
      </DesktopTableViewport>
    );
  }

  if (state.screen === 'local-mode-menu') {
    return renderScreen(
      <LocalModeMenu
        notice={state.menuNotice}
        onBack={() => setScreen('main-menu')}
        onRiichi={() => setScreen('riichi-player-count')}
        onComingSoon={(label) => setState((current) => ({ ...current, menuNotice: `${label}敬请期待。` }))}
      />
    );
  }

  if (state.screen === 'riichi-player-count') {
    return renderScreen(
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
    return renderScreen(<RulesGuideScreen ruleConfig={state.ruleConfig} onBack={() => setScreen('riichi-player-count')} />);
  }

  if (state.screen === 'riichi-four-player-length') {
    return renderScreen(<GameTypeMenu onBack={() => setScreen('riichi-player-count')} onEast={() => chooseLength('four-east')} onSouth={() => chooseLength('four-south')} />);
  }

  if (state.screen === 'match-settings') {
    const matchTypeLabel = state.selection.lengthChoice === 'four-south' ? '四人南' : '四人东';
    return renderScreen(
      <main className="menu-page">
        <section className="menu-panel menu-panel--wide">
          <p className="menu-path">{settingsPath}</p>
          {state.menuNotice ? <p className="menu-notice" role="status">{state.menuNotice}</p> : null}
          <MatchSettings
            config={state.ruleConfig}
            pathLabel={settingsPath}
            matchTypeLabel={matchTypeLabel}
            doraGlowEnabled={state.doraGlowEnabled}
            sameTileHoverEnabled={state.sameTileHoverEnabled}
            showTenpaiWaitsEnabled={state.showTenpaiWaitsEnabled}
            tsumoGiriDisplayEnabled={state.tsumoGiriDisplayEnabled}
            aiPlayerSettings={state.aiPlayerSettings}
            onDoraGlowChange={(enabled) => setState((current) => ({ ...current, doraGlowEnabled: enabled }))}
            onSameTileHoverChange={(enabled) => setState((current) => ({ ...current, sameTileHoverEnabled: enabled }))}
            onShowTenpaiWaitsChange={(enabled) => setState((current) => ({ ...current, showTenpaiWaitsEnabled: enabled }))}
            onTsumoGiriDisplayChange={(enabled) => setState((current) => ({ ...current, tsumoGiriDisplayEnabled: enabled }))}
            onAIPlayerSettingsChange={(aiPlayerSettings) => setState((current) => ({ ...current, aiPlayerSettings }))}
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
    return renderScreen(
      <main className="menu-page">
        <section className="menu-panel menu-panel--wide">
          <BackButton onClick={() => setScreen('main-menu')} />
          <p className="menu-path">主菜单 ＞ 牌谱研习</p>
          <ReplayLibrary
            replays={state.replayMetas}
            onOpen={(id) => void openReplay(id)}
            onRename={(id) => void renameReplay(id)}
            onDelete={(id) => void deleteReplay(id)}
            onExport={(id) => void exportReplay(id)}
            onStartLocalMatch={() => setScreen('local-mode-menu')}
          />
        </section>
      </main>
    );
  }

  if (state.screen === 'replay-detail' && state.replay) {
    return renderScreen(
      <ReplayDetail
        replay={state.replay}
        onBack={() => state.replay?.source === 'test-mode'
          ? setScreen('test-mode', { replay: null, testScenario: null })
          : setScreen('replay-library', { replay: null })}
        testModeEnabled={testModeAvailability.enabled}
        onConvertToTestScenario={(scenario) => setScreen('test-mode', { replay: null, testScenario: scenario })}
      />
    );
  }

  if (state.screen === 'test-mode' && testModeAvailability.enabled) {
    return renderScreen(
      <TestModeScreen
        key={state.testScenario?.id ?? 'test-mode-library'}
        initialScenario={state.testScenario}
        onOpenReplay={(replay) => setScreen('replay-detail', { replay, testScenario: null })}
        onExit={() => setScreen('main-menu', { testScenario: null })}
      />
    );
  }

  if (!activeGame || !gameState || !matchState) return renderScreen(null);

  return renderScreen(
    <>
      {matchState.phase === 'match-end-choice' && matchState.pendingEndChoice ? (
        <section className="call-panel call-panel--overlay">
          <strong>{matchState.pendingEndChoice.type === 'agari-yame' ? '和牌止' : '听牌止'}选择</strong>
          <div className="call-actions">
            <button type="button" onClick={() => {
              const applied = chooseMatchEnd(matchState, true);
              setState((current) => current.activeGame ? {
                ...current,
                activeGame: applyMatchProgress(current.activeGame, applied.match, applied.nextGameState, current.ruleConfig),
              } : current);
            }}>结束比赛</button>
            <button type="button" onClick={() => {
              const applied = chooseMatchEnd(matchState, false);
              setState((current) => current.activeGame ? {
                ...current,
                activeGame: applyMatchProgress(current.activeGame, applied.match, applied.nextGameState, current.ruleConfig),
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
        doraGlowEnabled={state.doraGlowEnabled}
        sameTileHoverEnabled={state.sameTileHoverEnabled}
        showTenpaiWaitsEnabled={state.showTenpaiWaitsEnabled}
        tsumoGiriDisplayEnabled={state.tsumoGiriDisplayEnabled}
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
