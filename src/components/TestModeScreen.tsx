import { useMemo, useState } from 'react';
import { Board } from './Board';
import { TestModeDebugPanel } from './TestModeDebugPanel';
import { SeededSimulationPanel } from './SeededSimulationPanel';
import { DialogKeyboardLab } from './DialogKeyboardLab';
import { DesktopTableViewport } from './layout/DesktopTableViewport';
import { createReplayRecord } from '../game/persistence/replayRecord';
import type { MatchLog } from '../game/replay/types';
import { applyOfficialTestModeAction, createTestModeMatchLog, recordTestModeAction, type OfficialTestModeAction } from '../game/testMode/actions';
import { cloneTestScenario, countCompletedKans, loadTestScenarioState, parseTestScenarioJson, runtimeInvariantChecks, scenarioFromGameState, serializeTestScenario, stateSummary, TestScenarioValidationError, validateTestScenario } from '../game/testMode/scenario';
import { createMemoryTestStorage, executeTestCase, failureReportFromResult, getBuiltInTestCases, parseTestCaseDefinitionJson, playableTestCaseFromScenario, TEST_CASE_CATEGORY_LABELS, TEST_CASE_KIND_LABELS, TEST_CASE_STATUS_LABELS, type TestStorageFailureMode } from '../game/testMode/testCases';
import { TEST_CASE_CATEGORIES, type TestCaseCategory, type TestCaseDefinitionV1, type TestCaseRunResultV1, type TestCaseRunStatus, type TestModeActionLogEntry, type TestScenarioV1 } from '../game/testMode/types';
import type { ReplayRecord } from '../game/persistence/storageTypes';
import { p0PersistenceRunners } from '../game/testMode/p0RegressionCases';
import { stab007PersistenceRunners } from '../game/testMode/stab007Cases';
import { stab008PersistenceRunners } from '../game/testMode/stab008Cases';
import { p0ReplayRunners } from './TestModeP0ReplayRunner';
import { getRulePreset } from '../game/match/matchRules';
import { runSeededBatch, serializeSeededFailure } from '../game/testMode/seededSimulation';
import type { GameState, PlayerId } from '../game/types';

interface TestModeScreenProps {
  initialScenario?: TestScenarioV1 | null;
  onExit: () => void;
  onOpenReplay?: (replay: ReplayRecord) => void;
}

interface TestSession {
  initialScenario: TestScenarioV1;
  gameState: GameState;
  matchLog: MatchLog;
  controlPlayerId: PlayerId;
  actionLog: TestModeActionLogEntry[];
}

interface TestCaseRuntimeState {
  status: TestCaseRunStatus;
  result?: TestCaseRunResultV1;
}

export function TestModeScreen({ initialScenario = null, onExit, onOpenReplay }: TestModeScreenProps) {
  const [session, setSession] = useState<TestSession | null>(() => initialScenario ? createSession(initialScenario) : null);
  const [importText, setImportText] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [importedCases, setImportedCases] = useState<TestCaseDefinitionV1[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | TestCaseCategory>('all');
  const [caseStates, setCaseStates] = useState<Record<string, TestCaseRuntimeState>>({});
  const [debugOpen, setDebugOpen] = useState(true);
  const [allOpen, setAllOpen] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [storageFailureMode, setStorageFailureMode] = useState<TestStorageFailureMode>('none');
  const builtIns = useMemo(getBuiltInTestCases, []);
  const testStorage = useMemo(() => createMemoryTestStorage(storageFailureMode), [storageFailureMode]);
  const testCases = useMemo(() => [...builtIns, ...importedCases], [builtIns, importedCases]);
  const visibleCases = selectedCategory === 'all' ? testCases : testCases.filter((testCase) => testCase.category === selectedCategory);
  const checks = useMemo(() => session ? runtimeInvariantChecks(session.initialScenario, session.gameState) : [], [session]);
  const failedChecks = checks.filter((entry) => !entry.passed);

  const startScenario = (scenario: TestScenarioV1) => {
    const validation = validateTestScenario(scenario);
    if (!validation.valid) {
      setMessages(validation.issues.map((issue) => `${issue.path}: ${issue.message}`));
      return;
    }
    setSession(createSession(scenario));
    setMessages([]);
    setRuntimeError(null);
    setAllOpen(false);
    setDebugOpen(true);
  };

  const runTestCase = async (testCase: TestCaseDefinitionV1) => {
    if (testCase.kind === 'playable') {
      startScenario(testCase.scenario);
      return;
    }
    setCaseStates((current) => ({ ...current, [testCase.id]: { status: 'running' } }));
    try {
      const result = await executeTestCase(testCase, {
        storage: testStorage,
        persistenceRunners: { ...p0PersistenceRunners, ...stab007PersistenceRunners, ...stab008PersistenceRunners },
        replayRunners: p0ReplayRunners,
        seededRunner: async (seededCase) => {
          const batch = await runSeededBatch({
            seed: seededCase.seed,
            ruleConfig: getRulePreset('east-round'),
            rounds: seededCase.iterations,
          });
          if (batch.failure) throw new Error(serializeSeededFailure(batch.failure));
          return [
            `seed=${seededCase.seed}`,
            `完成${batch.completedRounds}/${batch.requestedRounds}局`,
            '每动作不变量全部通过',
          ];
        },
      });
      setCaseStates((current) => ({ ...current, [testCase.id]: { status: result.status, result } }));
    } catch (error) {
      const result: TestCaseRunResultV1 = {
        version: 1,
        caseId: testCase.id,
        relatedAuditId: testCase.relatedAuditId ?? null,
        status: 'failed',
        currentStep: '执行用例',
        expected: [...testCase.expectedResults],
        actual: [error instanceof Error ? error.message : '未知执行错误'],
        stateSummary: '执行器抛出未处理异常，测试中心已保留失败结果。',
        artifacts: [{ name: `${testCase.id}.test-case.json`, mediaType: 'application/json', content: JSON.stringify(testCase, null, 2) }],
      };
      setCaseStates((current) => ({ ...current, [testCase.id]: { status: 'failed', result } }));
    }
  };

  const markManualResult = (testCase: TestCaseDefinitionV1, status: 'passed' | 'failed') => {
    const previous = caseStates[testCase.id]?.result;
    const result: TestCaseRunResultV1 = {
      version: 1,
      caseId: testCase.id,
      relatedAuditId: testCase.relatedAuditId ?? null,
      status,
      currentStep: previous?.currentStep ?? '人工确认',
      expected: [...testCase.expectedResults],
      actual: [status === 'passed' ? '人工确认通过' : '人工确认失败'],
      stateSummary: previous?.stateSummary ?? '人工验收结果',
      artifacts: previous?.artifacts ?? [{ name: `${testCase.id}.test-case.json`, mediaType: 'application/json', content: JSON.stringify(testCase, null, 2) }],
    };
    setCaseStates((current) => ({ ...current, [testCase.id]: { status, result } }));
  };

  const applyAction = (label: string, action: OfficialTestModeAction) => {
    setSession((current) => {
      if (!current) return current;
      try {
        const before = current.gameState;
        const after = applyOfficialTestModeAction(before, action);
        if (after === before) {
          setRuntimeError(`正式引擎未执行“${label}”：当前状态或候选不合法。`);
          return current;
        }
        setRuntimeError(null);
        const sequence = current.actionLog.length + 1;
        return {
          ...current,
          gameState: after,
          matchLog: recordTestModeAction(current.matchLog, before, after),
          actionLog: [...current.actionLog, { sequence, label, phase: after.phase, currentPlayer: after.currentPlayer }],
        };
      } catch (error) {
        setRuntimeError(`正式动作“${label}”抛出异常：${error instanceof Error ? error.message : '未知错误'}`);
        return current;
      }
    });
  };

  if (!session) {
    return (
      <main className="test-mode-library">
        <header className="test-mode-heading">
          <span className="test-environment-badge">测试环境</span>
          <div><h1>开发者测试用例中心</h1><p>统一管理对局、牌谱、存档、版本、随机性和界面测试；可操作对局继续使用正式引擎。</p></div>
          <button type="button" onClick={onExit}>返回主菜单</button>
        </header>
        <nav className="test-case-categories" aria-label="测试用例分类">
          <button type="button" aria-pressed={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')}>全部</button>
          {TEST_CASE_CATEGORIES.map((category) => (
            <button type="button" key={category} aria-pressed={selectedCategory === category} onClick={() => setSelectedCategory(category)}>
              {TEST_CASE_CATEGORY_LABELS[category]}
            </button>
          ))}
        </nav>
        <section className="test-storage-failure-panel" aria-label="模拟存储失败">
          <h2>模拟存储失败</h2>
          <label>测试适配器故障
            <select value={storageFailureMode} onChange={(event) => setStorageFailureMode(event.target.value as TestStorageFailureMode)}>
              <option value="none">不模拟</option>
              <option value="get-error">读取 SecurityError</option>
              <option value="set-security">写入 SecurityError</option>
              <option value="set-quota">写入 QuotaExceededError</option>
              <option value="set-error">写入普通 Error</option>
              <option value="remove-error">删除 SecurityError</option>
            </select>
          </label>
          <p>故障仅注入测试中心内存适配器，不读取或修改 window.localStorage。</p>
        </section>
        <SeededSimulationPanel onOpenFailureScenario={startScenario} />
        <DialogKeyboardLab />
        <section className="test-mode-scenario-grid" aria-label="测试用例库">
          {visibleCases.map((testCase) => {
            const runtime = caseStates[testCase.id] ?? { status: 'not-run' as const };
            const report = runtime.result ? failureReportFromResult(testCase, runtime.result) : '';
            return (
              <article key={testCase.id} className="test-mode-scenario-card" data-case-kind={testCase.kind}>
                <header className="test-case-card-header">
                  <strong>{testCase.name}</strong>
                  <span className={`test-case-status is-${runtime.status}`}>{TEST_CASE_STATUS_LABELS[runtime.status]}</span>
                </header>
                <code>{testCase.id}</code>
                <span>{TEST_CASE_CATEGORY_LABELS[testCase.category]} · {TEST_CASE_KIND_LABELS[testCase.kind]}</span>
                <p>{testCase.description}</p>
                <p>预期：{testCase.expectedResults.join('；') || '按人工步骤确认'}</p>
                {testCase.manualSteps.length > 0 ? <ol>{testCase.manualSteps.map((step) => <li key={step}>{step}</li>)}</ol> : null}
                <div className="test-case-tags">{testCase.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                <button type="button" disabled={runtime.status === 'running'} onClick={() => void runTestCase(testCase)}>
                  {testCase.kind === 'playable' ? '进入正式牌桌' : runtime.status === 'running' ? '运行中…' : '运行用例'}
                </button>
                {testCase.kind === 'replay' && testCase.replay && onOpenReplay ? (
                  <button type="button" onClick={() => onOpenReplay(testCase.replay!)}>人工查看附带牌谱</button>
                ) : null}
                {runtime.result ? (
                  <section className="test-case-result" aria-label={`${testCase.id}运行结果`}>
                    <span>当前步骤：{runtime.result.currentStep}</span>
                    <span>实际：{runtime.result.actual.join('；')}</span>
                    <span>状态摘要：{runtime.result.stateSummary}</span>
                    {runtime.status === 'manual-confirmation' ? <div><button type="button" onClick={() => markManualResult(testCase, 'passed')}>标记通过</button><button type="button" onClick={() => markManualResult(testCase, 'failed')}>标记失败</button></div> : null}
                    {runtime.status === 'failed' ? <div><button type="button" onClick={() => void copyText(report)}>复制失败报告</button><button type="button" onClick={() => downloadJson(`${testCase.id}.failure.json`, report)}>导出相关JSON</button></div> : null}
                  </section>
                ) : null}
              </article>
            );
          })}
        </section>
        <section className="test-mode-import">
          <h2>导入 TestScenario 或 TestCase JSON</h2>
          <textarea aria-label="TestScenario或TestCase JSON" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="粘贴 TestScenarioV1 或 TestCaseDefinitionV1 JSON" />
          <div>
            <input aria-label="选择测试JSON文件" type="file" accept="application/json,.json" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void file.text().then(setImportText).catch(() => setMessages(['$: 无法读取所选文件']));
            }} />
            <button type="button" onClick={() => {
              try {
                const raw = JSON.parse(importText) as { kind?: unknown };
                if (raw?.kind) {
                  const testCase = parseTestCaseDefinitionJson(importText);
                  setImportedCases((current) => [...current.filter((entry) => entry.id !== testCase.id), testCase]);
                  setSelectedCategory(testCase.category);
                  setMessages([`${testCase.id}：已注册到测试用例中心`]);
                } else {
                  startScenario(parseTestScenarioJson(importText));
                }
              } catch (error) {
                setMessages(error instanceof TestScenarioValidationError
                  ? error.issues.map((issue) => `${issue.path}: ${issue.message}`)
                  : [error instanceof Error ? `$: ${error.message}` : '$: 导入失败']);
              }
            }}>校验并导入</button>
          </div>
          {messages.length > 0 ? <ul className="test-mode-errors" role="alert">{messages.map((message) => <li key={message}>{message}</li>)}</ul> : null}
        </section>
      </main>
    );
  }

  const currentScenario = scenarioFromSession(session);
  const playableCase = playableTestCaseFromScenario(session.initialScenario);
  const failureResult: TestCaseRunResultV1 = {
    version: 1,
    caseId: playableCase.id,
    relatedAuditId: playableCase.relatedAuditId ?? null,
    status: 'failed',
    currentStep: `正式动作 #${session.actionLog.length}`,
    expected: [...playableCase.expectedResults],
    actual: [...(runtimeError ? [runtimeError] : []), ...failedChecks.map((entry) => `${entry.label}：${entry.detail}`)],
    stateSummary: stateSummary(session.initialScenario, session.gameState, session.actionLog.length),
    artifacts: [{ name: `${currentScenario.id}.json`, mediaType: 'application/json', content: serializeTestScenario(currentScenario) }],
  };
  const failureReport = failureReportFromResult(playableCase, failureResult);
  const replayRecord = createReplayRecord({
    log: session.matchLog,
    scores: session.gameState.players.map((player) => player.score) as [number, number, number, number],
    completed: session.gameState.phase === 'round-ended',
    title: `测试模式 · ${session.initialScenario.name}`,
    source: 'test-mode',
  });

  return (
    <DesktopTableViewport surface="test-mode" onReturnMenu={() => setSession(null)}>
      <div className="test-mode-session" data-testid="test-mode-session">
      <Board
        gameState={session.gameState}
        controlledPlayerId={session.controlPlayerId}
        revealAllHands={allOpen}
        onDiscard={(playerId, tileInstanceId) => applyAction('弃牌', { type: 'discard', playerId, tileInstanceId })}
        onTsumo={(playerId) => applyAction('自摸', { type: 'tsumo', playerId })}
        onRon={(playerId) => applyAction('荣和', { type: 'ron', playerId })}
        onPassRon={(playerId) => applyAction('跳过荣和', { type: 'pass-ron', playerId })}
        onDeclareRiichi={(playerId, tileInstanceId) => applyAction('立直', { type: 'riichi', playerId, tileInstanceId })}
        onDeclareKyuushuKyuuhai={(playerId) => applyAction('九种九牌', { type: 'kyuushu-kyuuhai', playerId })}
        onPon={(playerId) => applyAction('碰', { type: 'pon', playerId })}
        onChi={(playerId, optionIndex) => applyAction('吃', { type: 'chi', playerId, optionIndex })}
        onKan={(playerId, kanType, tileId) => applyAction(kanType === 'ankan' ? '暗杠' : kanType === 'minkan' ? '大明杠' : '加杠', { type: 'kan', playerId, kanType, tileId })}
        onChankanRon={(playerId) => applyAction('抢杠和', { type: 'chankan-ron', playerId })}
        onPassChankan={(playerId) => applyAction('跳过抢杠', { type: 'pass-chankan', playerId })}
        onPassCall={() => applyAction('跳过鸣牌', { type: 'pass-call' })}
        onSkipDrawActions={() => {
          const player = session.gameState.players[session.controlPlayerId];
          if (player.riichi && player.drawnTile) applyAction('立直后摸切', { type: 'discard', playerId: player.id, tileInstanceId: player.drawnTile.instanceId });
        }}
        onReset={() => setSession(createSession(session.initialScenario))}
        onReturnMenu={() => setSession(null)}
        desktopViewport={false}
      />

      <header className="test-mode-toolbar" aria-label="测试模式工具栏">
        <span className="test-environment-badge">测试环境</span>
        <strong>{session.initialScenario.id}</strong>
        <button type="button" onClick={() => setSession(null)}>返回场景库</button>
        <button type="button" onClick={() => { setSession(createSession(session.initialScenario)); setRuntimeError(null); }}>重置场景</button>
        <button type="button" onClick={() => downloadJson(`${currentScenario.id}.json`, serializeTestScenario(currentScenario))}>导出场景</button>
        <button type="button" onClick={() => downloadJson(`${replayRecord.id}.test-replay.json`, JSON.stringify(replayRecord, null, 2))}>导出生成的牌谱</button>
        <button type="button" onClick={() => void copyText(stateSummary(session.initialScenario, session.gameState, session.actionLog.length))}>复制状态摘要</button>
        <button type="button" aria-pressed={debugOpen} onClick={() => setDebugOpen((open) => !open)}>{debugOpen ? '关闭调试面板' : '打开调试面板'}</button>
        <button type="button" aria-pressed={allOpen} onClick={() => setAllOpen((open) => !open)}>全牌公开</button>
        <label>控制玩家
          <select value={session.controlPlayerId} onChange={(event) => setSession((current) => current ? { ...current, controlPlayerId: Number(event.target.value) as PlayerId } : current)}>
            {session.gameState.players.map((player) => <option key={player.id} value={player.id}>玩家{player.id + 1} · {player.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={session.gameState.phase !== 'draw'} onClick={() => applyAction('摸牌', { type: 'draw' })}>摸牌</button>
        <button type="button" onClick={() => applyAction('执行下一AI动作', { type: 'ai-next' })}>执行下一AI动作</button>
        <button type="button" onClick={onExit}>结束测试</button>
      </header>

      {runtimeError || failedChecks.length > 0 ? (
        <section className="test-mode-warning" role="alert">
          <strong>测试状态检查失败</strong>
          {runtimeError ? <span>{runtimeError}</span> : null}
          {failedChecks.map((entry) => <span key={entry.id}>{entry.label}：{entry.detail}</span>)}
          <button type="button" onClick={() => void copyText(failureReport)}>复制失败报告</button>
          <button type="button" onClick={() => downloadJson(`${currentScenario.id}.failure.json`, serializeTestScenario(currentScenario))}>导出场景</button>
        </section>
      ) : null}

      <TestModeDebugPanel
        open={debugOpen}
        scenario={session.initialScenario}
        gameState={session.gameState}
        matchLog={session.matchLog}
        actionLog={session.actionLog}
        checks={checks}
        viewerPlayerId={session.controlPlayerId}
      />
      </div>
    </DesktopTableViewport>
  );
}

function createSession(scenario: TestScenarioV1): TestSession {
  const initialScenario = cloneTestScenario(scenario);
  return {
    initialScenario,
    gameState: loadTestScenarioState(initialScenario),
    matchLog: createTestModeMatchLog(initialScenario),
    controlPlayerId: initialScenario.gameState.currentPlayer,
    actionLog: [],
  };
}

function scenarioFromSession(session: TestSession): TestScenarioV1 {
  const scenario = scenarioFromGameState({
    id: `${session.initialScenario.id}-current`,
    name: `${session.initialScenario.name}（当前状态）`,
    description: `从${session.initialScenario.id}执行${session.actionLog.length}个正式动作后导出。`,
    relatedAuditId: session.initialScenario.relatedAuditId,
    ruleConfig: session.initialScenario.ruleConfig,
    handNumber: session.initialScenario.handNumber,
    gameState: session.gameState,
    manualPlayerIds: session.initialScenario.manualPlayerIds,
    initialTotalPoints: session.initialScenario.initialTotalPoints,
    usedRinshanCount: countCompletedKans(session.gameState),
    instructions: session.initialScenario.instructions,
  });
  scenario.expectedCheckpoints = session.initialScenario.expectedCheckpoints;
  return scenario;
}

function downloadJson(filename: string, json: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyText(value: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) await navigator.clipboard.writeText(value);
}
