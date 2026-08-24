import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppScreen, RiichiLengthChoice, SetupSelection } from './app/navigation';
import { advanceAutomaticGameState } from './app/automaticGameProgression';
import { matchLengthForChoice, pathLabel, presetForChoice } from './app/navigation';
import { AudioManager, type PlaybackSnapshot } from './audio/AudioManager';
import { AudioPresentationConsumer } from './audio/AudioPresentationConsumer';
import { normalizeAudioSettings, type AudioSettings } from './audio/audioSettings';
import { loadAudioSettings, saveAudioSettings } from './audio/audioSettingsStorage';
import { VOICE_PACK_REPOSITORY } from './audio/voice/VoicePackRepository';
import { VoiceDirector } from './audio/voice/VoiceDirector';
import { SettlementPresentationCoordinator } from './audio/voice/SettlementPresentationCoordinator';
import { VoicePresentationRuntime } from './audio/voice/VoicePresentationRuntime';
import { resolveSelectedVoicePackId, resolveVoiceSeatAssignments } from './audio/voice/voicePreferences';
import type { VoicePackSummary } from './audio/voice/types';
import { MusicLibrary, type MusicAddResult } from './audio/musicLibrary';
import type { GameSfxGroup, MusicCategory, MusicTrackDefinition, MusicTrackId, PlaybackMode } from './audio/musicTypes';
import { AudioSettingsDialog } from './components/AudioSettingsDialog';
import { VoiceManagementScreen } from './components/voice/VoiceManagementScreen';
import { CreateVoicePackScreen } from './components/voice/CreateVoicePackScreen';
import type { CreateVoicePackResult } from './audio/voice/VoicePackService';
import { BackButton } from './components/BackButton';
import { Board } from './components/Board';
import { ExitGameDialog } from './components/ExitGameDialog';
import { GameTypeMenu } from './components/GameTypeMenu';
import { LocalModeMenu } from './components/LocalModeMenu';
import { MainMenu } from './components/MainMenu';
import { PlayerProfileDialog } from './components/PlayerProfileDialog';
import { MatchResultDialog } from './components/MatchResultDialog';
import { DEFAULT_AI_PLAYER_SETTINGS, MatchSettings, type AIPlayerSetting } from './components/MatchSettings';
import { ReplayLibrary } from './components/ReplayLibrary';
import { ReplayDetail } from './components/ReplayDetail';
import { TestModeScreen } from './components/TestModeScreen';
import { RiichiModeMenu } from './components/RiichiModeMenu';
import { RiichiVariantPlaceholder } from './components/RiichiVariantPlaceholder';
import { SeventeenStepsScreen } from './components/SeventeenStepsScreen';
import { SeventeenStepsMatchSettings } from './components/SeventeenStepsMatchSettings';
import { RulesGuideScreen } from './components/rulesGuide/RulesGuideScreen';
import { isAIPlayer } from './game/ai';
import { declareKyuushuKyuuhai } from './game/abortiveDraw';
import { canPon, executePon, passCall } from './game/callChecker';
import { canChi, executeChi } from './game/chiChecker';
import { declareRiichi, declareRon, declareTsumo, discardTile, passRon } from './game/engine';
import { hasDrawAction } from './game/interaction';
import { canChankan, canMinkan, declareChankanRon, executeKan, passChankan, type KanType } from './game/kanChecker';
import { applyFinishedGameToMatch, chooseAgariYame, chooseMatchEnd, startMatch } from './game/match/matchEngine';
import { getRulePreset, loadStoredRuleConfig, saveStoredRuleConfig, type RulePresetId } from './game/match/matchRules';
import type { FullRuleConfig, MatchState } from './game/match/types';
import { LocalStorageAdapter } from './game/persistence/saveManager';
import { createReplayRecord } from './game/persistence/replayRecord';
import type { ReplayMetadata, ReplayRecord, SavedMatch } from './game/persistence/storageTypes';
import { CURRENT_SAVE_VERSION } from './game/persistence/storageTypes';
import { createInitialMatchLog, finishMatchLog, recordGameStateTransition, startRoundInMatchLog } from './game/replay/eventRecorder';
import type { MatchLog } from './game/replay/types';
import type { GameState, PlayerId, TileId } from './game/types';
import { currentTestModeAvailability } from './game/testMode/availability';
import { loadStoredSeventeenStepsMatchConfig, saveStoredSeventeenStepsMatchConfig } from './game/seventeenStepsMatch';
import type { SeventeenStepsMatchConfig } from './game/seventeenSteps';
import type { TestScenarioV1 } from './game/testMode/types';
import { normalizePlayerProfile, type PlayerProfile } from './profile/playerProfile';
import { loadPlayerProfile, savePlayerProfile } from './profile/playerProfileStorage';
import { presentationPacingGate } from './presentation/pacing/PresentationPacingGate';
import { runPacedAutomaticAction } from './presentation/pacing/automaticActionPacing';
import { useMatchPresentationEvents } from './presentation/matchPresentationEvents';

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
  seventeenStepsConfig: SeventeenStepsMatchConfig;
  testScenario: TestScenarioV1 | null;
  playerProfile: PlayerProfile;
}

const storage = typeof window === 'undefined' ? null : new LocalStorageAdapter(window.localStorage);
const EXIT_SAVE_TIMEOUT_MS = 3000;
const EXIT_SAVE_TIMEOUT_MESSAGE = '牌谱保存超时，可直接退出或重试保存。';
const EXIT_SAVE_ERROR_MESSAGE = '牌谱保存失败，可直接退出或重试保存。';
function isRealtimeAudioScreen(screen: AppScreen): boolean {
  return screen === 'game' || screen === 'riichi-17-steps';
}

function bgmForScreen(screen: AppScreen): 'home' | 'game' | null {
  if (isRealtimeAudioScreen(screen)) return 'game';
  if (screen === 'replay-library' || screen === 'replay-detail' || screen === 'test-mode') return null;
  return 'home';
}

export function resolveBgmScene(
  screen: AppScreen,
  hasRiichi: boolean,
  riichiEnabled: boolean,
): 'home' | 'game' | 'riichi' | null {
  if (isRealtimeAudioScreen(screen)) {
    return hasRiichi && riichiEnabled ? 'riichi' : 'game';
  }
  return bgmForScreen(screen);
}

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
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [audioDialogOpen, setAudioDialogOpen] = useState(() => typeof window !== 'undefined' && window.sessionStorage.getItem('local-mahjong.pending-voice-pack-manager') !== null);
  const [voiceManagementPackId, setVoiceManagementPackId] = useState<string | null>(() => typeof window === 'undefined' ? null : window.sessionStorage.getItem('local-mahjong.pending-voice-pack-manager'));
  const [voicePackCreationOpen, setVoicePackCreationOpen] = useState(false);
  const [musicRevision, setMusicRevision] = useState(0);
  const [previewTrackId, setPreviewTrackId] = useState<MusicTrackId | null>(null);
  const [musicNotice, setMusicNotice] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackSnapshot>({
    source: null,
    trackId: null,
    trackName: null,
    category: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackMode: undefined,
  });
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => {
    const storage = typeof window === 'undefined' ? undefined : window.localStorage;
    const loaded = loadAudioSettings(storage);
    const packs = VOICE_PACK_REPOSITORY.listPacks();
    const selectedVoicePackId = resolveSelectedVoicePackId(loaded.selectedVoicePackId, packs);
    const voicePackBySeat = resolveVoiceSeatAssignments(loaded.voicePackBySeat, packs);
    const resolved = { ...loaded, selectedVoicePackId, voicePackBySeat };
    if (storage && (selectedVoicePackId !== loaded.selectedVoicePackId || voicePackBySeat.some((packId, seat) => packId !== loaded.voicePackBySeat[seat]))) saveAudioSettings(resolved, storage);
    return resolved;
  });
  const [state, setState] = useState<AppState>(() => ({
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
    seventeenStepsConfig: loadStoredSeventeenStepsMatchConfig(typeof window === 'undefined' ? undefined : window.localStorage),
    testScenario: null,
    playerProfile: loadPlayerProfile(typeof window === 'undefined' ? undefined : window.localStorage),
  }));

  const mountedRef = useRef(false);
  const exitSaveInProgressRef = useRef(false);
  const pendingExitSaveRef = useRef<SavedMatch | null>(null);
  const pendingExitReplayRef = useRef<ReplayRecord | null>(null);
  const automaticallySavedReplayIdsRef = useRef(new Set<string>());
  const activeGame = state.activeGame;
  const gameState = activeGame?.gameState;
  const matchState = activeGame?.matchState;
  const voicePlayerCount: 2 | 3 | 4 = gameState?.players.length === 2 ? 2
    : gameState?.players.length === 3 ? 3
      : state.screen === 'riichi-17-steps' || state.screen === 'riichi-17-steps-settings' ? 2
        : state.selection.playerCount === 3 ? 3 : 4;
  const settingsPath = useMemo(() => pathLabel(state.selection), [state.selection]);
  const audioManagerRef = useRef<AudioManager | null>(null);
  if (!audioManagerRef.current) audioManagerRef.current = new AudioManager(audioSettings);
  const audioManager = audioManagerRef.current;
  const voiceDirectorRef = useRef<VoiceDirector | null>(null);
  if (!voiceDirectorRef.current) voiceDirectorRef.current = new VoiceDirector(VOICE_PACK_REPOSITORY, audioManager, audioSettings);
  const voiceDirector = voiceDirectorRef.current;
  const audioScreenRef = useRef(state.screen);
  audioScreenRef.current = state.screen;
  const voicePresentationRuntimeRef = useRef<VoicePresentationRuntime | null>(null);
  if (!voicePresentationRuntimeRef.current) {
    voicePresentationRuntimeRef.current = new VoicePresentationRuntime(
      voiceDirector,
      undefined,
      () => isRealtimeAudioScreen(audioScreenRef.current),
    );
  }
  const voicePresentationRuntime = voicePresentationRuntimeRef.current;
  const winPresentationController = voicePresentationRuntime.controller;
  const settlementPresentationRef = useRef<SettlementPresentationCoordinator | null>(null);
  if (!settlementPresentationRef.current) settlementPresentationRef.current = new SettlementPresentationCoordinator(winPresentationController);
  const settlementPresentationCoordinator = settlementPresentationRef.current;
  const musicLibraryRef = useRef<MusicLibrary | null>(null);
  if (!musicLibraryRef.current) {
    musicLibraryRef.current = new MusicLibrary(
      undefined,
      typeof window === 'undefined' ? undefined : window.localStorage,
    );
  }
  const musicLibrary = musicLibraryRef.current;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (voiceManagementPackId && VOICE_PACK_REPOSITORY.getPack(voiceManagementPackId) && typeof window !== 'undefined') window.sessionStorage.removeItem('local-mahjong.pending-voice-pack-manager');
  }, [voiceManagementPackId]);

  useEffect(() => {
    audioManager.activate();
    return () => audioManager.dispose();
  }, [audioManager]);

  useEffect(() => {
    voicePresentationRuntime.start();
    return () => {
      voiceDirector.stop();
      voicePresentationRuntime.stop();
    };
  }, [voiceDirector, voicePresentationRuntime]);
  useEffect(() => () => settlementPresentationCoordinator.dispose(), [settlementPresentationCoordinator]);

  useEffect(() => {
    const players = gameState?.players ?? [];
    voiceDirector.setActorSeatContext({ playerIds: players.map((player) => player.id), playerCount: players.length });
  }, [voiceDirector, gameState?.players]);

  // This observes committed MatchState only. Voice playback stays behind the runtime EventBus consumer.
  useMatchPresentationEvents(activeGame && matchState && gameState ? {
    matchId: activeGame.matchLog.matchId,
    matchState,
    activePlayerIds: gameState.players.map((player) => player.id),
  } : undefined);

  useEffect(() => {
    let cancelled = false;
    void musicLibrary.initialize().then(() => {
      if (cancelled) return;
      audioManager.setMusicLibrary(musicLibrary);
      setMusicRevision((revision) => revision + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [audioManager, musicLibrary]);

  useEffect(() => {
    const consumer = new AudioPresentationConsumer(
      audioManager,
      undefined,
      () => isRealtimeAudioScreen(audioScreenRef.current),
    );
    return () => consumer.dispose();
  }, [audioManager]);

  useEffect(() => {
    const sync = () => setPlayback(audioManager.getPlaybackSnapshot());
    sync();
    return audioManager.subscribePlayback(sync);
  }, [audioManager]);

  useEffect(() => {
    const hasRiichi = state.activeGame?.gameState.players.some((player) => player.riichi) ?? false;
    const track = resolveBgmScene(state.screen, hasRiichi, audioSettings.riichiMusicEnabled);
    if (track) {
      audioManager.playBgm(track);
    } else {
      audioManager.stopBgm();
    }
  }, [audioManager, state.screen, musicRevision, audioSettings.riichiMusicEnabled, state.activeGame?.gameState.players]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const resumeAudio = () => audioManager.resume();
    window.addEventListener('pointerdown', resumeAudio, { once: true });
    window.addEventListener('keydown', resumeAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
  }, [audioManager]);

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

    let cancelled = false;
    void runPacedAutomaticAction(() => {
      setState((current) => {
        if (!current.activeGame || current.screen !== 'game' || current.exitDialogOpen || current.exiting) return current;
        const currentGame = current.activeGame.gameState;
        return { ...current, activeGame: updateActiveGameState(current.activeGame, advanceAutomaticGameState(currentGame)) };
      });
    }, {
      gate: presentationPacingGate,
      isCancelled: () => cancelled,
    });
    return () => {
      cancelled = true;
    };
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
    setState((current) => ({ ...current, ruleConfig: config, presetId: 'custom' }));
    if (typeof window !== 'undefined') saveStoredRuleConfig(config, window.localStorage);
  }

  function handlePlayerProfileChange(profile: PlayerProfile) {
    const normalized = normalizePlayerProfile(profile);
    setState((current) => ({ ...current, playerProfile: normalized }));
    if (typeof window !== 'undefined') savePlayerProfile(normalized, window.localStorage);
  }

  function handleAudioSettingsChange(settings: AudioSettings) {
    const normalizedSettings = normalizeAudioSettings(settings);
    const packs = VOICE_PACK_REPOSITORY.listPacks();
    const normalized = {
      ...normalizedSettings,
      selectedVoicePackId: resolveSelectedVoicePackId(normalizedSettings.selectedVoicePackId, packs),
      voicePackBySeat: resolveVoiceSeatAssignments(normalizedSettings.voicePackBySeat, packs),
    };
    audioManager.setSettings(normalized);
    voiceDirector.setSettings(normalized);
    setAudioSettings(normalized);
    if (typeof window !== 'undefined') saveAudioSettings(normalized, window.localStorage);
  }

  function refreshMusicLibrary() {
    audioManager.setMusicLibrary(musicLibrary);
    setMusicRevision((revision) => revision + 1);
  }

  function musicAddNotice(result: MusicAddResult): string {
    if (result.added.length === 0) {
      return result.rejected.length > 0
        ? `没有可导入的音乐（仅支持 MP3 / WAV）。${result.rejected[0]}`
        : '没有可导入的音乐（仅支持 MP3 / WAV）。';
    }
    if (result.rejected.length > 0) {
      return `已导入 ${result.added.length} 首；跳过 ${result.rejected.length} 个不支持的文件（仅支持 MP3 / WAV）。`;
    }
    return `已导入 ${result.added.length} 首音乐。`;
  }

  function handleAddCopiedMusic(category: MusicCategory, gameSfxGroup: GameSfxGroup | undefined, files: FileList) {
    void musicLibrary.addCopiedFiles(category, Array.from(files), gameSfxGroup).then((result) => {
      refreshMusicLibrary();
      setMusicNotice(musicAddNotice(result));
    });
  }

  function handleAddLinkedMusic(category: MusicCategory, gameSfxGroup?: GameSfxGroup) {
    void musicLibrary.addLinkedViaPicker(category, gameSfxGroup).then((result) => {
      refreshMusicLibrary();
      setMusicNotice(musicAddNotice(result));
    });
  }

  function handleRemoveMusicTrack(category: MusicCategory, trackId: MusicTrackId) {
    if (previewTrackId === trackId) {
      audioManager.stopTemporary();
      setPreviewTrackId(null);
    }
    void musicLibrary.removeTrack(trackId).then(() => {
      refreshMusicLibrary();
    });
  }

  function handleReauthorizeMusic(category: MusicCategory, trackId: MusicTrackId) {
    void musicLibrary.reauthorizeTrack(trackId).then(() => {
      refreshMusicLibrary();
    });
  }

  function handleRelinkMusic(category: MusicCategory, trackId: MusicTrackId) {
    void musicLibrary.relinkViaPicker(trackId).then((result) => {
      refreshMusicLibrary();
      if (result.rejected.length > 0) setMusicNotice(`重新选择失败（仅支持 MP3 / WAV）。`);
    });
  }

  function handleReorderMusic(category: MusicCategory, orderedIds: MusicTrackId[]) {
    musicLibrary.reorder(category, orderedIds);
    refreshMusicLibrary();
  }

  function handleReorderSfxGroup(group: GameSfxGroup, orderedIds: MusicTrackId[]) {
    musicLibrary.reorderSfxGroup(group, orderedIds);
    refreshMusicLibrary();
  }

  function handleSfxPlaybackModeChange(group: GameSfxGroup, mode: PlaybackMode) {
    musicLibrary.setSfxPlaybackMode(group, mode);
    refreshMusicLibrary();
  }

  function handlePlaybackModeChange(category: MusicCategory, mode: PlaybackMode) {
    musicLibrary.setPlaybackMode(category, mode);
    refreshMusicLibrary();
  }

  function handlePreviewMusic(track: MusicTrackDefinition) {
    audioManager.playTemporary(track);
    setPreviewTrackId(track.id);
  }

  function handleStopPreviewMusic() {
    audioManager.stopTemporary();
    setPreviewTrackId(null);
  }

  function handleTogglePlayback() {
    if (audioManager.getPlaybackSnapshot().isPlaying) {
      audioManager.pauseCurrentPlayback();
    } else {
      audioManager.resumeCurrentPlayback();
    }
  }

  function handleSeekPlayback(time: number) {
    audioManager.seekCurrentPlayback(time);
  }

  function handlePreviousTrack() {
    audioManager.previousTrack();
  }

  function handleNextTrack() {
    audioManager.nextTrack();
  }

  function openAudioSettings() {
    setProfileDialogOpen(false);
    setMusicNotice(null);
    void musicLibrary.refresh().then(() => {
      audioManager.setMusicLibrary(musicLibrary);
      audioManager.setTemporaryReturnPolicy('resume-suspended-track');
      const snapshot = audioManager.getPlaybackSnapshot();
      setPreviewTrackId(snapshot.source === 'temporary' ? snapshot.trackId : null);
      setMusicRevision((revision) => revision + 1);
      setAudioDialogOpen(true);
    });
  }

  function closeAudioDialog() {
    audioManager.setTemporaryReturnPolicy('restart-runtime-playlist');
    setVoicePackCreationOpen(false);
    setVoiceManagementPackId(null);
    setAudioDialogOpen(false);
  }

  function openVoiceManagement(packId: string) {
    handleAudioSettingsChange({ ...audioSettings, selectedVoicePackId: packId });
    setVoiceManagementPackId(packId);
  }

  function handleVoicePackCreated(result: CreateVoicePackResult) {
    // The current bundle cannot discover the newly created Pack until reload, so do not
    // resolve this ID against its stale repository before persisting it.
    const settingsForNewPack = { ...normalizeAudioSettings(audioSettings), selectedVoicePackId: result.pack.id };
    setAudioSettings(settingsForNewPack);
    if (typeof window !== 'undefined') saveAudioSettings(settingsForNewPack, window.localStorage);
    setVoicePackCreationOpen(false);
    setVoiceManagementPackId(result.pack.id);
    // VoiceManagementScreen fetches this just-created Pack through the local
    // Bridge. Do not reload: Vite's static glob can remain stale until restart.
    if (typeof window !== 'undefined') window.sessionStorage.removeItem('local-mahjong.pending-voice-pack-manager');
  }

  function handleVoicePackDeleted(_deletedPackId: string, remainingPacks: readonly VoicePackSummary[]) {
    const normalizedSettings = normalizeAudioSettings(audioSettings);
    const normalized = {
      ...normalizedSettings,
      selectedVoicePackId: resolveSelectedVoicePackId(normalizedSettings.selectedVoicePackId, remainingPacks),
      voicePackBySeat: resolveVoiceSeatAssignments(normalizedSettings.voicePackBySeat, remainingPacks),
    };
    audioManager.setSettings(normalized);
    voiceDirector.setSettings(normalized);
    setAudioSettings(normalized);
    if (typeof window !== 'undefined') saveAudioSettings(normalized, window.localStorage);
  }

  function renderAudioSettingsDialog() {
    if (voicePackCreationOpen) return <CreateVoicePackScreen onBack={() => setVoicePackCreationOpen(false)} onCreated={handleVoicePackCreated} />;
    if (voiceManagementPackId) {
      return <VoiceManagementScreen packId={voiceManagementPackId} voiceVolume={audioSettings.voiceVolume} onBack={() => setVoiceManagementPackId(null)} />;
    }
    if (!audioDialogOpen) return null;
    return (
      <AudioSettingsDialog
        settings={audioSettings}
        onChange={handleAudioSettingsChange}
        onClose={closeAudioDialog}
        library={musicLibrary}
        playback={playback}
        previewTrackId={previewTrackId}
        notice={musicNotice}
        onAddLinked={handleAddLinkedMusic}
        onAddCopied={handleAddCopiedMusic}
        onRemoveTrack={handleRemoveMusicTrack}
        onReauthorize={handleReauthorizeMusic}
        onRelink={handleRelinkMusic}
        onReorderSfxGroup={handleReorderSfxGroup}
        onSfxPlaybackModeChange={handleSfxPlaybackModeChange}
        onReorder={handleReorderMusic}
        onPlaybackModeChange={handlePlaybackModeChange}
        onPreview={handlePreviewMusic}
        onStopPreview={handleStopPreviewMusic}
        onTogglePlayback={handleTogglePlayback}
        onSeekPlayback={handleSeekPlayback}
        onPreviousTrack={handlePreviousTrack}
        onNextTrack={handleNextTrack}
        onManageVoicePack={openVoiceManagement}
        onCreateVoicePack={() => setVoicePackCreationOpen(true)}
        voicePlayerCount={voicePlayerCount}
        onVoicePackDeleted={handleVoicePackDeleted}
      />
    );
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

  async function renameReplay(id: string, title: string) {
    if (!storage || !title.trim()) return;
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

  if (state.screen === 'main-menu') {
    return (
      <>
        <MainMenu
          hasSave={!!state.savedMatch}
          playerProfile={state.playerProfile}
          notice={state.menuNotice}
          onContinue={continueSavedMatch}
          onLocalMode={() => setScreen('local-mode-menu')}
          onOnlineMode={() => setState((current) => ({ ...current, menuNotice: '联机模式敬请期待。' }))}
          onReplayStudy={() => void openReplayLibrary()}
          onOpenPlayerSettings={() => {
            setAudioDialogOpen(false);
            setProfileDialogOpen(true);
          }}
          onOpenAudioSettings={openAudioSettings}
          testModeEnabled={testModeAvailability.enabled}
          onTestMode={() => setScreen('test-mode', { testScenario: null })}
        />
        {profileDialogOpen ? (
          <PlayerProfileDialog
            profile={state.playerProfile}
            onChange={handlePlayerProfileChange}
            onClose={() => setProfileDialogOpen(false)}
          />
        ) : null}
        {renderAudioSettingsDialog()}
      </>
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
        on17Steps={() => setScreen('riichi-17-steps-settings')}
        onWashizu={() => setScreen('riichi-washizu')}
        onSuperpower={() => setScreen('riichi-superpower')}
        onRulesGuide={() => setScreen('rules-guide')}
      />
    );
  }

  if (state.screen === 'riichi-17-steps-settings') {
    return (
      <SeventeenStepsMatchSettings
        config={state.seventeenStepsConfig}
        onBack={() => setScreen('riichi-player-count')}
        onConfigChange={(config) => {
          setState((current) => ({ ...current, seventeenStepsConfig: config }));
          if (typeof window !== 'undefined') saveStoredSeventeenStepsMatchConfig(config, window.localStorage);
        }}
        onStart={() => setScreen('riichi-17-steps')}
      />
    );
  }

  if (state.screen === 'riichi-17-steps') {
    return (
      <>
        <SeventeenStepsScreen matchConfig={state.seventeenStepsConfig} ruleConfig={state.ruleConfig} playerProfile={state.playerProfile} onBack={() => setScreen('riichi-17-steps-settings')} onOpenAudioSettings={openAudioSettings} />
        {renderAudioSettingsDialog()}
      </>
    );
  }

  if (state.screen === 'riichi-washizu') {
    return <RiichiVariantPlaceholder variant="washizu" onBack={() => setScreen('riichi-player-count')} />;
  }

  if (state.screen === 'riichi-superpower') {
    return <RiichiVariantPlaceholder variant="superpower" onBack={() => setScreen('riichi-player-count')} />;
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
    return (
      <main className="menu-page">
        <section className="menu-panel menu-panel--wide">
          <BackButton onClick={() => setScreen('main-menu')} />
          <p className="menu-path">主菜单 ＞ 牌谱研习</p>
          <ReplayLibrary
            replays={state.replayMetas}
            onOpen={(id) => void openReplay(id)}
            onRename={(id, title) => void renameReplay(id, title)}
            onDelete={(id) => void deleteReplay(id)}
            onExport={(id) => void exportReplay(id)}
            onStartLocalMatch={() => setScreen('local-mode-menu')}
          />
        </section>
      </main>
    );
  }

  if (state.screen === 'replay-detail' && state.replay) {
    return (
      <ReplayDetail
        replay={state.replay}
        onBack={() => setScreen('replay-library', { replay: null })}
        testModeEnabled={testModeAvailability.enabled}
        onConvertToTestScenario={(scenario) => setScreen('test-mode', { replay: null, testScenario: scenario })}
      />
    );
  }

  if (state.screen === 'test-mode' && testModeAvailability.enabled) {
    return (
      <TestModeScreen
        key={state.testScenario?.id ?? 'test-mode-library'}
        initialScenario={state.testScenario}
        onExit={() => setScreen('main-menu', { testScenario: null })}
      />
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
        winPresentationController={winPresentationController}
        settlementPresentationCoordinator={settlementPresentationCoordinator}
        playerProfile={state.playerProfile}
        matchState={matchState}
        onTsumo={(playerId) => updateGame((current) => declareTsumo(current, playerId))}
        onRon={(playerId) => updateGame((current) => declareRon(current, playerId))}
        onPassRon={(playerId) => updateGame((current) => passRon(current, playerId))}
        onDiscard={(playerId, tileInstanceId) => updateGame((current) => discardTile(current, playerId, tileInstanceId))}
        onDeclareRiichi={(playerId, tileInstanceId) => updateGame((current) => declareRiichi(current, playerId, tileInstanceId))}
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
        onOpenAudioSettings={openAudioSettings}
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
      {renderAudioSettingsDialog()}
    </>
  );
}

export type { KanType, PlayerId, TileId };
