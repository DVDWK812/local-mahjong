import { useMemo, useState, type FocusEvent } from 'react';
import { calculateFinalScores } from '../game/match/finalRanking';
import { createMatch } from '../game/match/matchEngine';
import { defaultMatchRuleConfig } from '../game/match/matchRules';
import { createInitialGameState } from '../game/engine';
import type { GameState } from '../game/types';
import { ContinueMatchDialog } from './ContinueMatchDialog';
import { DIALOG_INTERACTION_POLICIES, type DialogInteractionPolicy } from './Dialog';
import { ExitGameDialog } from './ExitGameDialog';
import { MatchResultDialog } from './MatchResultDialog';
import { ResultDialog } from './ResultDialog';

type LabDialog = 'result' | 'continue' | 'exit' | 'match-result';

const LAB_DIALOGS: Array<{ id: LabDialog; label: string; policy: DialogInteractionPolicy }> = [
  { id: 'result', label: 'ResultDialog', policy: DIALOG_INTERACTION_POLICIES.result },
  { id: 'continue', label: 'ContinueMatchDialog', policy: DIALOG_INTERACTION_POLICIES.continueMatch },
  { id: 'exit', label: 'ExitGameDialog', policy: DIALOG_INTERACTION_POLICIES.exitGame },
  { id: 'match-result', label: 'MatchResultDialog', policy: DIALOG_INTERACTION_POLICIES.matchResult },
];

export function DialogKeyboardLab() {
  const [activeDialog, setActiveDialog] = useState<LabDialog | null>(null);
  const [focusedElement, setFocusedElement] = useState('尚无焦点');
  const [insideDialog, setInsideDialog] = useState(false);
  const [returnElement, setReturnElement] = useState('尚未打开弹窗');
  const resultState = useMemo(createLabResultState, []);
  const matchState = useMemo(createLabMatchState, []);
  const active = LAB_DIALOGS.find((entry) => entry.id === activeDialog);

  const openDialog = (dialog: LabDialog, trigger: HTMLButtonElement) => {
    setReturnElement(elementLabel(trigger));
    setActiveDialog(dialog);
  };
  const closeDialog = () => {
    setActiveDialog(null);
    window.setTimeout(() => {
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setFocusedElement(elementLabel(focused));
      setInsideDialog(Boolean(focused?.closest('[role="dialog"]')));
    }, 0);
  };
  const trackFocus = (event: FocusEvent<HTMLElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    setFocusedElement(elementLabel(target));
    setInsideDialog(Boolean(target?.closest('[role="dialog"]')));
  };

  return (
    <section className="dialog-keyboard-lab" aria-labelledby="dialog-keyboard-lab-title" onFocusCapture={trackFocus}>
      <h2 id="dialog-keyboard-lab-title">界面与键盘实验室</h2>
      <p>使用真实共享 Dialog 交互层检查焦点圈、Escape、背景点击与焦点恢复；不会推进正式比赛。</p>
      <div className="dialog-keyboard-lab__launchers">
        {LAB_DIALOGS.map((entry) => (
          <button type="button" key={entry.id} onClick={(event) => openDialog(entry.id, event.currentTarget)}>{entry.label}</button>
        ))}
      </div>
      <dl className="dialog-keyboard-lab__status">
        <div><dt>当前焦点元素</dt><dd>{focusedElement}</dd></div>
        <div><dt>是否在焦点圈内</dt><dd>{insideDialog ? '是' : '否'}</dd></div>
        <div><dt>Escape预期</dt><dd>{active?.policy.escape === 'dismiss' ? '取消并关闭' : '阻止关闭'}</dd></div>
        <div><dt>背景点击预期</dt><dd>{active?.policy.backdrop === 'dismiss' ? '取消并关闭' : '阻止关闭'}</dd></div>
        <div><dt>关闭后返回元素</dt><dd>{returnElement}</dd></div>
      </dl>
      {activeDialog === 'result' ? <ResultDialog gameState={resultState} onReset={closeDialog} continueLabel="关闭实验弹窗" /> : null}
      {activeDialog === 'continue' ? <ContinueMatchDialog save={null} error="实验室模拟存档读取失败" onContinue={closeDialog} onDiscard={closeDialog} /> : null}
      {activeDialog === 'exit' ? <ExitGameDialog matchEnded={false} onCancel={closeDialog} onConfirm={closeDialog} /> : null}
      {activeDialog === 'match-result' ? <MatchResultDialog matchState={matchState} onNewMatch={closeDialog} /> : null}
    </section>
  );
}

function createLabResultState(): GameState {
  return {
    ...createInitialGameState(),
    phase: 'round-ended',
    result: {
      type: 'abortive-draw',
      reason: 'kyuushu-kyuuhai',
      declaredBy: 0,
      dealerContinues: true,
      honbaIncrement: 1,
      riichiSticksCarryOver: true,
      scoreDeltas: [0, 0, 0, 0],
      pointDeltas: [0, 0, 0, 0],
    },
  };
}

function createLabMatchState() {
  const base = createMatch();
  const finalResult = calculateFinalScores({
    scores: [25000, 25000, 25000, 25000],
    riichiSticks: 0,
    initialDealer: 0,
    ruleConfig: defaultMatchRuleConfig,
    endedBy: 'scheduled-end',
  });
  return {
    ...base,
    phase: 'match-ended' as const,
    finalResult,
    matchResults: [finalResult],
    aggregateScores: finalResult.players.reduce((scores, player) => {
      scores[player.player] = player.finalMatchScore ?? 0;
      return scores;
    }, [0, 0, 0, 0] as [number, number, number, number]),
  };
}

function elementLabel(element: HTMLElement | null): string {
  if (!element) return '无';
  const text = element.textContent?.trim();
  return text || element.getAttribute('aria-label') || element.id || element.tagName.toLowerCase();
}
