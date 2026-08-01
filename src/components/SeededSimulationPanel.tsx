import { useRef, useState } from 'react';
import { getRulePreset } from '../game/match/matchRules';
import { compareSeededRuns, runSeededBatch, serializeSeededFailure, type SeededBatchResult } from '../game/testMode/seededSimulation';
import type { TestScenarioV1 } from '../game/testMode/types';

interface SeededSimulationPanelProps {
  onOpenFailureScenario: (scenario: TestScenarioV1) => void;
}

export function SeededSimulationPanel({ onOpenFailureScenario }: SeededSimulationPanelProps) {
  const [seed, setSeed] = useState('stab-010-manual');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('尚未运行');
  const [result, setResult] = useState<SeededBatchResult | null>(null);
  const [comparison, setComparison] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const ruleConfig = getRulePreset('east-round');

  const run = async (rounds: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setComparison(null);
    setProgress(`准备运行 ${rounds} 局`);
    const next = await runSeededBatch({
      seed,
      ruleConfig,
      rounds,
      signal: controller.signal,
      onProgress: (completed) => setProgress(`${completed} / ${rounds} 局`),
    });
    setResult(next);
    setProgress(next.failure ? `失败：${next.completedRounds} / ${rounds} 局` : next.paused ? `已暂停：${next.completedRounds} / ${rounds} 局` : `完成：${rounds} / ${rounds} 局`);
    setRunning(false);
  };

  const compare = () => {
    const compared = compareSeededRuns(seed, ruleConfig);
    setResult({ seed, requestedRounds: 2, completedRounds: 2, paused: false, failure: compared.first.failure ?? compared.second.failure, lastResult: compared.second });
    setComparison(compared.equal ? '两次同seed运行：牌墙、动作、最终状态和牌谱动作序列完全一致' : `两次运行不一致：${compared.differences.join('；')}`);
  };

  const failure = result?.failure;
  const steps = result?.lastResult?.invariantChecks ?? [];
  return (
    <section className="seeded-simulation-panel" aria-label="随机与压力">
      <h2>随机与压力</h2>
      <p>规则：四人东默认规则 · 策略：正式随机合法AI弃牌、跳过鸣牌 · 每动作检查不变量</p>
      <label>Seed
        <input value={seed} onChange={(event) => setSeed(event.target.value)} disabled={running} />
      </label>
      <div className="seeded-simulation-actions">
        {[1, 10, 100, 500].map((rounds) => <button type="button" key={rounds} disabled={running || !seed.trim()} onClick={() => void run(rounds)}>运行{rounds}局</button>)}
        <button type="button" disabled={!running} onClick={() => controllerRef.current?.abort()}>暂停</button>
        <button type="button" disabled={running || !seed.trim()} onClick={compare}>比较两次同seed运行</button>
        <button type="button" disabled={!failure} onClick={() => failure && downloadText(`${failure.seed}.failure.json`, serializeSeededFailure(failure))}>导出失败种子</button>
        <button type="button" disabled={!failure} onClick={() => failure && onOpenFailureScenario(failure.scenario)}>将失败状态转为TestScenarioV1</button>
      </div>
      <p role="status">{progress}</p>
      {comparison ? <p>{comparison}</p> : null}
      {failure ? <p role="alert">Seed {failure.seed} 在动作 {failure.actionIndex} 失败：{failure.reasons.join('；')}</p> : null}
      <details open={steps.length > 0}>
        <summary>每动作不变量（{steps.length}步）</summary>
        <ol>{steps.map((step) => (
          <li key={`${step.actionIndex}-${step.action}`}>
            <strong>#{step.actionIndex} {step.action}</strong>
            <span>{step.checks.map((check) => `${check.passed ? 'PASS' : 'FAIL'} ${check.label}`).join('；')}</span>
          </li>
        ))}</ol>
      </details>
    </section>
  );
}

function downloadText(filename: string, content: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
