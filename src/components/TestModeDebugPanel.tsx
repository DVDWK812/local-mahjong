import type { MatchLog } from '../game/replay/types';
import { legalActionSummary, countCompletedKans } from '../game/testMode/scenario';
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
  const revealedDoraIds = new Set(gameState.doraIndicators.map((tile) => tile.instanceId));
  const recentEvents = matchLog.rounds.flatMap((round) => round.events).slice(-8);
  const currentDoraSlots = DORA_INDICATOR_SLOT_INDICES.slice(0, gameState.doraIndicators.length);
  const currentUraSlots = URA_DORA_INDICATOR_SLOT_INDICES.slice(0, gameState.doraIndicators.length);

  return (
    <aside className="test-mode-debug" aria-label="测试模式调试面板">
      <header>
        <strong>调试面板</strong>
        <span>{scenario.id}{scenario.relatedAuditId ? ` · ${scenario.relatedAuditId}` : ''}</span>
      </header>
      <dl className="test-mode-debug__summary">
        <div><dt>当前玩家</dt><dd>玩家{gameState.currentPlayer + 1}</dd></div>
        <div><dt>phase</dt><dd>{gameState.phase}</dd></div>
        <div><dt>动作序号</dt><dd>{actionLog.length}</dd></div>
        <div><dt>活牌墙剩余</dt><dd>{gameState.wall.length}</dd></div>
        <div><dt>可正常摸取</dt><dd>{gameState.wall.length}</dd></div>
        <div><dt>岭上已使用</dt><dd>{usedRinshanCount}</dd></div>
        <div><dt>表宝已公开</dt><dd>{gameState.doraIndicators.length}</dd></div>
        <div><dt>当前表宝槽</dt><dd>{currentDoraSlots.join(', ')}</dd></div>
        <div><dt>当前里宝槽</dt><dd>{currentUraSlots.join(', ')}</dd></div>
        <div><dt>供托</dt><dd>{gameState.riichiSticks}</dd></div>
        <div><dt>四家分数</dt><dd>{gameState.players.map((player) => player.score).join(' / ')}</dd></div>
      </dl>

      <section>
        <h3>固定14张王牌槽位</h3>
        <div className="test-mode-dead-wall-table" role="table" aria-label="固定王牌槽位表">
          {gameState.deadWall.map((tile, index) => {
            const role = deadWallSlotRole(index);
            const used = role === 'rinshan' && index < usedRinshanCount;
            const revealed = revealedDoraIds.has(tile.instanceId);
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
      </section>

      <section>
        <h3>实时不变量</h3>
        <ul>{checks.map((entry) => <li key={entry.id} className={entry.passed ? 'is-pass' : 'is-fail'}>{entry.passed ? '通过' : '失败'} · {entry.label}：{entry.detail}</li>)}</ul>
      </section>

      <section>
        <h3>当前合法动作</h3>
        <p>{legalActionSummary(gameState).join('、') || '无（终局或异常）'}</p>
      </section>

      <section>
        <h3>最近动作日志</h3>
        <ol>{actionLog.slice(-8).map((entry) => <li key={entry.sequence}>#{entry.sequence} {entry.label} · 玩家{entry.currentPlayer + 1} · {entry.phase}</li>)}</ol>
        <h3>正式事件记录</h3>
        <ol>{recentEvents.map((event) => <li key={event.eventId}>#{event.sequence} {event.type}</li>)}</ol>
      </section>
    </aside>
  );
}
