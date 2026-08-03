import type { ReactNode } from 'react';
import type { MatchLog } from '../game/replay/types';
import { countCompletedKans, legalActionSummary } from '../game/testMode/scenario';
import type { InvariantCheck, TestModeActionLogEntry, TestScenarioV1 } from '../game/testMode/types';
import type { GameState } from '../game/types';
import { tileLabel } from '../game/tileUtils';
import { deadWallSlotRole, DORA_INDICATOR_SLOT_INDICES, URA_DORA_INDICATOR_SLOT_INDICES } from '../game/wall';

interface TestModeDebugPanelProps {
  open: boolean;
  scenario: TestScenarioV1;
  gameState: GameState;
  matchLog: MatchLog;
  actionLog: TestModeActionLogEntry[];
  checks: InvariantCheck[];
}

const roleLabels = {
  rinshan: '岭上牌',
  'dora-indicator': '表宝牌指示牌',
  'ura-dora-indicator': '里宝牌指示牌',
} as const;

export function TestModeDebugPanel({ open, scenario, gameState, matchLog, actionLog, checks }: TestModeDebugPanelProps) {
  if (!open) return null;
  const usedRinshanCount = countCompletedKans(gameState);
  const recentEvents = matchLog.rounds.flatMap((round) => round.events).slice(-8);
  const legalActions = legalActionSummary(gameState);
  const passedChecks = checks.filter((entry) => entry.passed).length;

  return (
    <aside className="test-mode-debug test-mode-debug--open" aria-label="测试模式调试面板">
      <header>
        <strong>状态摘要</strong>
        <span>{scenario.id}{scenario.relatedAuditId ? ` · ${scenario.relatedAuditId}` : ''}</span>
      </header>
      <p className="test-mode-debug__compact-summary">
        玩家{gameState.currentPlayer + 1} · {gameState.phase} · 动作 {actionLog.length} · 不变量 {passedChecks}/{checks.length}
      </p>

      <div className="test-mode-debug__details">
          <DebugGroup title="摘要">
            <dl className="test-mode-debug__summary">
              <div><dt>当前玩家</dt><dd>玩家{gameState.currentPlayer + 1}</dd></div>
              <div><dt>阶段</dt><dd>{gameState.phase}</dd></div>
              <div><dt>动作序号</dt><dd>{actionLog.length}</dd></div>
              <div><dt>活牌墙剩余</dt><dd>{gameState.wall.length}</dd></div>
              <div><dt>岭上已使用</dt><dd>{usedRinshanCount}</dd></div>
              <div><dt>表宝已公开</dt><dd>{gameState.doraIndicators.length}</dd></div>
              <div><dt>当前表宝槽</dt><dd>{DORA_INDICATOR_SLOT_INDICES.slice(0, gameState.doraIndicators.length).join(', ')}</dd></div>
              <div><dt>当前里宝槽</dt><dd>{URA_DORA_INDICATOR_SLOT_INDICES.slice(0, gameState.doraIndicators.length).join(', ')}</dd></div>
              <div><dt>供托</dt><dd>{gameState.riichiSticks}</dd></div>
              <div><dt>四家分数</dt><dd>{gameState.players.map((player) => player.score).join(' / ')}</dd></div>
            </dl>
          </DebugGroup>

          <DebugGroup title="不变量">
            <ul>{checks.map((entry) => <li key={entry.id} className={entry.passed ? 'is-pass' : 'is-fail'}>{entry.passed ? '通过' : '失败'} · {entry.label}：{entry.detail}</li>)}</ul>
          </DebugGroup>

          <DebugGroup title="合法动作">
            <p>{legalActions.join('、') || '无（终局或异常）'}</p>
          </DebugGroup>

          <DebugGroup title="日志">
            <h4>最近测试动作</h4>
            <ol>{actionLog.slice(-8).map((entry) => <li key={entry.sequence}>#{entry.sequence} {entry.label} · 玩家{entry.currentPlayer + 1} · {entry.phase}</li>)}</ol>
            <h4>正式事件记录</h4>
            <ol>{recentEvents.map((event) => <li key={event.eventId}>#{event.sequence} {event.type}</li>)}</ol>
          </DebugGroup>

          <DebugGroup title="牌墙">
            <div className="test-mode-dead-wall-table" role="table" aria-label="固定王牌槽位表">
              {gameState.deadWall.map((tile, index) => {
                const role = deadWallSlotRole(index);
                const used = role === 'rinshan' && index < usedRinshanCount;
                const revealed = gameState.doraIndicators.some((entry) => entry.instanceId === tile.instanceId);
                return (
                  <div role="row" key={tile.instanceId} className={used || revealed ? 'is-active' : ''}>
                    <span role="cell">槽{index}</span>
                    <span role="cell">{role ? roleLabels[role] : '未知'}</span>
                    <span role="cell">{tileLabel(tile)}</span>
                    <code role="cell">{tile.instanceId}</code>
                    <span role="cell">{used ? '已使用' : revealed ? '已公开' : '未使用/未公开'}</span>
                  </div>
                );
              })}
            </div>
          </DebugGroup>

          <DebugGroup title="实例">
            {gameState.players.map((player) => (
              <p key={player.id}>玩家{player.id + 1}：手牌 {player.hand.length}，副露 {player.calls.length}，弃牌 {player.river.length}</p>
            ))}
          </DebugGroup>

          <DebugGroup title="原始状态">
            <pre>{JSON.stringify(gameState, null, 2)}</pre>
          </DebugGroup>
      </div>
    </aside>
  );
}

function DebugGroup({ title, children }: { title: string; children: ReactNode }) {
  return <details open><summary>{title}</summary><div>{children}</div></details>;
}
