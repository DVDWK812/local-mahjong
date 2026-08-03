import { useMemo, useState } from 'react';
import { Board } from './Board';
import { TestModeDebugPanel } from './TestModeDebugPanel';
import { createReplayRecord } from '../game/persistence/replayRecord';
import type { MatchLog } from '../game/replay/types';
import { applyOfficialTestModeAction, createTestModeMatchLog, recordTestModeAction, type OfficialTestModeAction } from '../game/testMode/actions';
import { getChiihouExampleScenario } from '../game/testMode/builtInScenarios';
import { createImportedTestCase, filterTestCases, getTestCaseCatalog, getTestCaseStatus, summarizeTestCases, type TestCaseDefinition, type TestCaseFilters, type TestCaseOutcome, type TestCaseResult, type TestCaseStatus, type TestCaseType } from '../game/testMode/catalog';
import { TestCaseResultsStorage } from '../game/testMode/resultsStorage';
import { cloneTestScenario, countCompletedKans, loadTestScenarioState, parseTestScenarioJson, runtimeInvariantChecks, scenarioFromGameState, serializeTestScenario, stateSummary, TestScenarioValidationError, validateTestScenario } from '../game/testMode/scenario';
import type { TestModeActionLogEntry, TestScenarioV1 } from '../game/testMode/types';
import type { GameState, PlayerId } from '../game/types';

interface TestModeScreenProps {
  initialScenario?: TestScenarioV1 | null;
  onExit: () => void;
  testResultStorage?: Storage;
}

interface TestSession {
  testCase: TestCaseDefinition;
  initialScenario: TestScenarioV1;
  gameState: GameState;
  matchLog: MatchLog;
  controlPlayerId: PlayerId;
  actionLog: TestModeActionLogEntry[];
}

const typeLabels: Record<TestCaseType, string> = {
  automatic: '自动',
  visual: '视觉',
  hybrid: '混合',
};

const statusLabels: Record<TestCaseStatus, string> = {
  pending: '待测试',
  passed: '通过',
  failed: '失败',
  blocked: '阻塞',
  'needs-retest': '需复验',
};

export function TestModeScreen({ initialScenario = null, onExit, testResultStorage }: TestModeScreenProps) {
  const testCases = useMemo(getTestCaseCatalog, []);
  const chiihouExample = useMemo(getChiihouExampleScenario, []);
  const resultStore = useMemo(() => {
    const target = testResultStorage ?? (typeof window === 'undefined' ? null : window.localStorage);
    return target ? new TestCaseResultsStorage(target) : null;
  }, [testResultStorage]);
  const [results, setResults] = useState<Record<string, TestCaseResult>>(() => resultStore?.load() ?? {});
  const [session, setSession] = useState<TestSession | null>(() => initialScenario
    ? createSession(testCases.find((testCase) => testCase.id === initialScenario.id)
      ? { ...testCases.find((testCase) => testCase.id === initialScenario.id)!, scenario: initialScenario }
      : createImportedTestCase(initialScenario))
    : null);
  const [filters, setFilters] = useState<TestCaseFilters>({ type: 'all', status: 'all', keyword: '' });
  const [importText, setImportText] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [fullControlEnabled, setFullControlEnabled] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const checks = useMemo(() => session ? runtimeInvariantChecks(session.initialScenario, session.gameState) : [], [session]);
  const failedChecks = checks.filter((entry) => !entry.passed);
  const stats = summarizeTestCases(testCases, results);
  const visibleCases = filterTestCases(testCases, results, filters);

  const startTestCase = (testCase: TestCaseDefinition) => {
    const validation = validateTestScenario(testCase.scenario);
    if (!validation.valid) {
      setMessages(validation.issues.map((issue) => `${issue.path}: ${issue.message}`));
      return;
    }
    setSession(createSession(testCase));
    setMessages([]);
    setRuntimeError(null);
    setAllOpen(false);
    setDebugOpen(false);
  };

  const startImportedScenario = (scenario: TestScenarioV1) => startTestCase(createImportedTestCase(scenario));

  const recordOutcome = (outcome: TestCaseOutcome) => {
    if (!session) return;
    const testedAt = new Date().toISOString();
    const result: TestCaseResult = { caseId: session.testCase.id, caseVersion: session.testCase.version, outcome, testedAt };
    if (resultStore) {
      setResults(resultStore.save(session.testCase.id, session.testCase.version, outcome, testedAt));
    } else {
      setResults((current) => ({ ...current, [result.caseId]: result }));
    }
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
          controlPlayerId: resolveTestModeControlPlayer(fullControlEnabled, current.controlPlayerId, after),
          matchLog: recordTestModeAction(current.matchLog, before, after),
          actionLog: [...current.actionLog, { sequence, label, phase: after.phase, currentPlayer: after.currentPlayer }],
        };
      } catch (error) {
        setRuntimeError(`正式动作“${label}”抛出异常：${error instanceof Error ? error.message : '未知错误'}`);
        return current;
      }
    });
  };

  const validateImport = () => {
    try {
      const scenario = parseTestScenarioJson(importText);
      setMessages([`字段校验通过：${scenario.id}`]);
    } catch (error) {
      setMessages(importIssues(error));
    }
  };

  const formatImport = () => {
    try {
      setImportText(JSON.stringify(JSON.parse(importText), null, 2));
      setMessages([]);
    } catch {
      setMessages(['$: JSON 语法错误，无法格式化']);
    }
  };

  if (!session) {
    return (
      <main className="test-mode-library">
        <header className="test-mode-heading">
          <span className="test-environment-badge">测试环境</span>
          <div><h1>开发者测试模式</h1><p>测试结果与普通存档、普通牌谱完全隔离；场景动作继续使用正式引擎。</p></div>
          <button type="button" onClick={onExit}>返回主菜单</button>
        </header>

        <section className="test-mode-stats" aria-label="测试统计">
          <Stat label="通过" value={stats.passed} status="passed" />
          <Stat label="失败" value={stats.failed} status="failed" />
          <Stat label="待测试" value={stats.pending} status="pending" />
          <Stat label="阻塞" value={stats.blocked} status="blocked" />
        </section>

        <section className="test-mode-filters" aria-label="测试用例筛选">
          <label>类型
            <select aria-label="按类型筛选" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value as TestCaseFilters['type'] }))}>
              <option value="all">全部</option><option value="automatic">自动</option><option value="visual">视觉</option><option value="hybrid">混合</option>
            </select>
          </label>
          <label>状态
            <select aria-label="按状态筛选" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as TestCaseFilters['status'] }))}>
              <option value="all">全部</option><option value="pending">待测试</option><option value="passed">通过</option><option value="failed">失败</option><option value="blocked">阻塞</option><option value="needs-retest">需复验</option>
            </select>
          </label>
          <label>关键词
            <input aria-label="按关键词筛选" value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder="名称、ID、功能" />
          </label>
          <span>显示 {visibleCases.length} / {testCases.length}</span>
        </section>

        <section className="test-mode-scenario-grid" aria-label="内置测试场景">
          {visibleCases.map((testCase) => {
            const result = results[testCase.id];
            const status = getTestCaseStatus(testCase, result);
            const needsManualDetails = testCase.type === 'visual' || testCase.type === 'hybrid';
            return (
              <article key={testCase.id} className={`test-mode-scenario-card test-mode-scenario-card--${status}`}>
                <header><strong>{testCase.scenario.name}</strong><span className={`test-case-status test-case-status--${status}`}>{statusLabels[status]}</span></header>
                <div className="test-case-meta"><span>{typeLabels[testCase.type]}</span><span>v{testCase.version}</span><code>{testCase.id}</code></div>
                <p>{testCase.scenario.description}</p>
                <p className="test-case-tested-at">最后测试：{result ? formatTestedAt(result.testedAt) : '尚未测试'}</p>
                {needsManualDetails ? (
                  <div className="test-case-manual-details">
                    <TestCaseList title="操作步骤" items={testCase.steps} ordered />
                    <TestCaseList title="预期结果" items={testCase.expectedResults} />
                    <TestCaseList title="人工检查项" items={testCase.manualChecks} />
                  </div>
                ) : null}
                <button type="button" onClick={() => startTestCase(testCase)}>开始测试</button>
              </article>
            );
          })}
        </section>

        <details className="test-mode-import">
          <summary>导入或制作 TestScenario JSON</summary>
          <div className="test-mode-import-guide">
            <h2>制作说明</h2>
            <p>建议从内置示例或已运行场景导出开始修改。字段校验使用正式 TestScenarioV1 校验器，不接受猜写或缺失牌墙数据。</p>
            <label>示例选择
              <select aria-label="TestScenario 示例" defaultValue="" onChange={(event) => {
                if (event.target.value === 'chiihou') setImportText(serializeTestScenario(chiihouExample));
              }}>
                <option value="">请选择</option><option value="chiihou">地和（真实 TestScenarioV1）</option>
              </select>
            </label>
          </div>
          <textarea aria-label="TestScenario JSON" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="粘贴 TestScenarioV1 JSON" />
          <div className="test-mode-import-actions">
            <input aria-label="选择TestScenario文件" type="file" accept="application/json,.json" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void file.text().then(setImportText).catch(() => setMessages(['$: 无法读取所选文件']));
            }} />
            <button type="button" onClick={validateImport}>校验字段</button>
            <button type="button" onClick={formatImport}>格式化</button>
            <button type="button" onClick={() => void copyText(importText)}>复制 JSON</button>
            <button type="button" onClick={() => {
              try {
                startImportedScenario(parseTestScenarioJson(importText));
              } catch (error) {
                setMessages(importIssues(error));
              }
            }}>校验并加载</button>
          </div>
          {messages.length > 0 ? <ul className="test-mode-errors" role="status">{messages.map((message) => <li key={message}>{message}</li>)}</ul> : null}
        </details>
      </main>
    );
  }

  const currentScenario = scenarioFromSession(session);
  const currentResult = results[session.testCase.id];
  const currentStatus = getTestCaseStatus(session.testCase, currentResult);
  const failureReport = [
    stateSummary(session.initialScenario, session.gameState, session.actionLog.length),
    '',
    '最近动作:',
    ...session.actionLog.slice(-20).map((entry) => `#${entry.sequence} ${entry.label} ${entry.phase} player=${entry.currentPlayer}`),
    runtimeError ? `异常: ${runtimeError}` : '',
  ].filter(Boolean).join('\n');
  const replayRecord = createReplayRecord({
    log: session.matchLog,
    scores: session.gameState.players.map((player) => player.score) as [number, number, number, number],
    completed: session.gameState.phase === 'round-ended',
    title: `测试模式 · ${session.initialScenario.name}`,
    source: 'test-mode',
  });

  return (
    <div className="test-mode-session" data-testid="test-mode-session">
      <Board
        gameState={session.gameState}
        controlledPlayerId={session.controlPlayerId}
        tableBottomPlayerId={0}
        revealAllHands={allOpen}
        onDiscard={(playerId, tileInstanceId) => applyAction('弃牌', { type: 'discard', playerId, tileInstanceId })}
        onTsumo={(playerId) => applyAction('自摸', { type: 'tsumo', playerId })}
        onRon={(playerId) => applyAction('荣和', { type: 'ron', playerId })}
        onPassRon={(playerId) => applyAction('跳过荣和', { type: 'pass-ron', playerId })}
        onDeclareRiichi={(playerId, tileInstanceId) => applyAction('立直', { type: 'riichi', playerId, tileInstanceId })}
        onDeclareKyuushuKyuuhai={(playerId) => applyAction('九种九牌', { type: 'kyuushu-kyuuhai', playerId })}
        onPon={(playerId) => applyAction('碰', { type: 'pon', playerId })}
        onChi={(playerId, optionIndex) => applyAction('吃', { type: 'chi', playerId, optionIndex })}
        onKan={(playerId, kanType, tileId) => applyAction(kanType === 'ankan' ? '暗杠' : kanType === 'minkan' ? '明杠' : '加杠', { type: 'kan', playerId, kanType, tileId })}
        onChankanRon={(playerId) => applyAction('抢杠和', { type: 'chankan-ron', playerId })}
        onPassChankan={(playerId) => applyAction('跳过抢杠', { type: 'pass-chankan', playerId })}
        onPassCall={() => applyAction('跳过鸣牌', { type: 'pass-call' })}
        onSkipDrawActions={() => {
          const player = session.gameState.players[session.controlPlayerId];
          if (player.riichi && player.drawnTile) applyAction('立直后摸切', { type: 'discard', playerId: player.id, tileInstanceId: player.drawnTile.instanceId });
        }}
        onReset={() => setSession(createSession(session.testCase))}
        onReturnMenu={() => setSession(null)}
      />

      <header className="test-mode-toolbar" aria-label="测试模式工具栏">
        <span className="test-environment-badge">测试环境</span>
        <strong>{session.testCase.id}</strong>
        <span className={`test-case-status test-case-status--${currentStatus}`}>{statusLabels[currentStatus]}</span>
        <button type="button" onClick={() => setSession(null)}>返回用例库</button>
        <button type="button" onClick={() => { setSession(createSession(session.testCase)); setRuntimeError(null); }}>重置场景</button>
        <button type="button" onClick={() => recordOutcome('passed')}>判定通过</button>
        <button type="button" onClick={() => recordOutcome('failed')}>判定失败</button>
        <button type="button" onClick={() => recordOutcome('blocked')}>判定阻塞</button>
        <button type="button" onClick={() => downloadJson(`${currentScenario.id}.json`, serializeTestScenario(currentScenario))}>导出场景</button>
        <button type="button" onClick={() => downloadJson(`${replayRecord.id}.test-replay.json`, JSON.stringify(replayRecord, null, 2))}>导出生成的牌谱</button>
        <button type="button" onClick={() => void copyText(stateSummary(session.initialScenario, session.gameState, session.actionLog.length))}>复制状态摘要</button>
        <button type="button" aria-pressed={debugOpen} onClick={() => setDebugOpen((open) => !open)}>{debugOpen ? '收起详细调试' : '展开详细调试'}</button>
        <button type="button" aria-pressed={allOpen} onClick={() => setAllOpen((open) => !open)}>全牌公开</button>
        <button type="button" aria-pressed={fullControlEnabled} onClick={() => {
          const enabled = !fullControlEnabled;
          setFullControlEnabled(enabled);
          if (enabled) setSession((current) => current ? { ...current, controlPlayerId: current.gameState.currentPlayer } : current);
        }}>{fullControlEnabled ? '关闭完全控制' : '完全控制'}</button>
        <label>控制玩家
          <select disabled={fullControlEnabled} value={session.controlPlayerId} onChange={(event) => setSession((current) => current ? { ...current, controlPlayerId: Number(event.target.value) as PlayerId } : current)}>
            {session.gameState.players.map((player) => <option key={player.id} value={player.id}>玩家{player.id + 1} · {player.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={session.gameState.phase !== 'draw'} onClick={() => applyAction('摸牌', { type: 'draw' })}>摸牌</button>
        <button type="button" onClick={() => applyAction('执行下一AI动作', { type: 'ai-next' })}>执行下一AI动作</button>
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

      <TestModeDebugPanel open={debugOpen} scenario={session.initialScenario} gameState={session.gameState} matchLog={session.matchLog} actionLog={session.actionLog} checks={checks} />
    </div>
  );
}

export function resolveTestModeControlPlayer(fullControlEnabled: boolean, currentControlPlayerId: PlayerId, nextGameState: GameState): PlayerId {
  return fullControlEnabled ? nextGameState.currentPlayer : currentControlPlayerId;
}

function Stat({ label, value, status }: { label: string; value: number; status: 'passed' | 'failed' | 'pending' | 'blocked' }) {
  return <div className={`test-mode-stat test-mode-stat--${status}`}><span>{label}</span><strong>{value}</strong></div>;
}

function TestCaseList({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul';
  return <section><h3>{title}</h3><Tag>{items.map((item) => <li key={item}>{item}</li>)}</Tag></section>;
}

function createSession(testCase: TestCaseDefinition): TestSession {
  const initialScenario = cloneTestScenario(testCase.scenario);
  return {
    testCase,
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

function importIssues(error: unknown): string[] {
  return error instanceof TestScenarioValidationError
    ? error.issues.map((issue) => `${issue.path}: ${issue.message}`)
    : ['$: 导入失败'];
}

function formatTestedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间无效' : date.toLocaleString('zh-CN');
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
