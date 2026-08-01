import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ContinueMatchDialog } from './ContinueMatchDialog';
import { DIALOG_INTERACTION_POLICIES, handleDialogKeyboardEvent, type FocusTargetLike } from './Dialog';
import { ExitGameDialog } from './ExitGameDialog';

describe('共享Dialog键盘与关闭策略', () => {
  it('Tab与Shift+Tab始终在弹窗焦点集合内循环', () => {
    const focused: string[] = [];
    const targets = ['first', 'middle', 'last'].map((name): FocusTargetLike => ({ focus: () => focused.push(name) }));

    handleDialogKeyboardEvent(keyEvent('Tab'), targets, targets[2], DIALOG_INTERACTION_POLICIES.result);
    handleDialogKeyboardEvent(keyEvent('Tab', true), targets, targets[0], DIALOG_INTERACTION_POLICIES.result);

    expect(focused).toEqual(['first', 'last']);
  });

  it('焦点位于背景时Tab会拉回弹窗首个控件', () => {
    const focus = vi.fn();
    handleDialogKeyboardEvent(keyEvent('Tab'), [{ focus }], { focus: vi.fn() }, DIALOG_INTERACTION_POLICIES.result);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('不可关闭结算策略阻止Escape且不调用关闭回调', () => {
    const dismiss = vi.fn();
    const event = keyEvent('Escape');
    handleDialogKeyboardEvent(event, [], null, DIALOG_INTERACTION_POLICIES.result, dismiss);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('退出确认策略将Escape映射到既有取消动作', () => {
    const dismiss = vi.fn();
    handleDialogKeyboardEvent(keyEvent('Escape'), [], null, DIALOG_INTERACTION_POLICIES.exitGame, dismiss);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('四类策略通过共享组件输出且保留标题与说明关联', () => {
    const continueHtml = renderToStaticMarkup(<ContinueMatchDialog save={null} error="损坏" onContinue={() => undefined} onDiscard={() => undefined} />);
    const exitHtml = renderToStaticMarkup(<ExitGameDialog matchEnded={false} onCancel={() => undefined} onConfirm={() => undefined} />);
    const endedExitHtml = renderToStaticMarkup(<ExitGameDialog matchEnded onCancel={() => undefined} onConfirm={() => undefined} />);

    expect(continueHtml).toContain('data-dialog-escape-behavior="blocked"');
    expect(continueHtml).toContain('data-dialog-backdrop-behavior="blocked"');
    expect(continueHtml).toContain('aria-labelledby="continue-match-title"');
    expect(continueHtml).toContain('aria-describedby="continue-match-description"');
    expect(exitHtml).toContain('data-dialog-escape-behavior="dismiss"');
    expect(exitHtml).toContain('data-dialog-backdrop-behavior="dismiss"');
    expect(endedExitHtml).toContain('data-dialog-escape-behavior="blocked"');
    expect(endedExitHtml).toContain('data-dialog-backdrop-behavior="blocked"');
  });
});

function keyEvent(key: string, shiftKey = false) {
  return {
    key,
    shiftKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}
