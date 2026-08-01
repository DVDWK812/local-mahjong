import { useMemo, useState } from 'react';
import { Board } from './Board';
import { TestModeDebugPanel } from './TestModeDebugPanel';
import { createReplayRecord } from '../game/persistence/replayRecord';
import type { MatchLog } from '../game/replay/types';
import { applyOfficialTestModeAction, createTestModeMatchLog, recordTestModeAction, type OfficialTestModeAction } from '../game/testMode/actions';
import { getBuiltInTestScenarios } from '../game/testMode/builtInScenarios';
import { cloneTestScenario, countCompletedKans, loadTestScenarioState, parseTestScenarioJson, runtimeInvariantChecks, scenarioFromGameState, serializeTestScenario, stateSummary, TestScenarioValidationError, validateTestScenario } from '../game/testMode/scenario';
import type { TestModeActionLogEntry, TestScenarioV1 } from '../game/testMode/types';
import type { GameState, PlayerId } from '../game/types';

interface TestModeScreenProps {
  initialScenario?: TestScenarioV1 | null;
  onExit: () => void;
}

interface TestSession {
  initialScenario: TestScenarioV1;
  gameState: GameState;
  matchLog: MatchLog;
  controlPlayerId: PlayerId;
  actionLog: TestModeActionLogEntry[];
}

export function TestModeScreen({ initialScenario = null, onExit }: TestModeScreenProps) {
  const [session, setSession] = useState<TestSession | null>(() => initialScenario ? createSession(initialScenario) : null);
  const [importText, setImportText] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [debugOpen, setDebugOpen] = useState(true);
  const [allOpen, setAllOpen] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const builtIns = useMemo(getBuiltInTestScenarios, []);
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
          <div><h1>开发者测试模式</h1><p>加载确定性场景后，所有操作继续使用正式牌桌、规则引擎与事件记录器。</p></div>
          <button type="button" onClick={onExit}>返回主菜单</button>
        </header>
        <section className="test-mode-scenario-grid" aria-label="内置测试场景">
          {builtIns.map((scenario) => (
            <article key={scenario.id} className="test-mode-scenario-card">
              <strong>{scenario.name}</strong>
              <code>{scenario.id}</code>
              <p>{scenario.description}</p>
              <ol>{scenario.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
              <button type="button" onClick={() => startScenario(scenario)}>加载场景</button>
            </article>
          ))}
        </section>
        <section className="test-mode-import">
          <h2>导入 TestScenario JSON</h2>
          <textarea aria-label="TestScenario JSON" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="粘贴 TestScenarioV1 JSON" />
          <div>
            <input aria-label="选择TestScenario文件" type="file" accept="application/json,.json" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void file.text().then(setImportText).catch(() => setMessages(['$: 无法读取所选文件']));
            }} />
            <button type="button" onClick={() => {
              try {
                startScenario(parseTestScenarioJson(importText));
              } catch (error) {
                setMessages(error instanceof TestScenarioValidationError
                  ? error.issues.map((issue) => `${issue.path}: ${issue.message}`)
                  : ['$: 导入失败']);
              }
            }}>校验并加载</button>
          </div>
          {messages.length > 0 ? <ul className="test-mode-errors" role="alert">{messages.map((message) => <li key={message}>{message}</li>)}</ul> : null}
        </section>
      </main>
    );
  }

  const currentScenario = scenarioFromSession(session);
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
      />
    </div>
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
