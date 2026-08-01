import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';

export type DialogDismissBehavior = 'dismiss' | 'blocked';

export interface DialogInteractionPolicy {
  escape: DialogDismissBehavior;
  backdrop: DialogDismissBehavior;
}

export const DIALOG_INTERACTION_POLICIES = {
  result: { escape: 'blocked', backdrop: 'blocked' },
  continueMatch: { escape: 'blocked', backdrop: 'blocked' },
  exitGame: { escape: 'dismiss', backdrop: 'dismiss' },
  matchResult: { escape: 'blocked', backdrop: 'blocked' },
} as const satisfies Record<string, DialogInteractionPolicy>;

interface DialogProps {
  children: ReactNode;
  policy: DialogInteractionPolicy;
  onDismiss?: () => void;
  labelledBy?: string;
  describedBy?: string;
  ariaLabel?: string;
  className?: string;
  testId?: string;
}

export interface DialogKeyboardEventLike {
  key: string;
  shiftKey: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

export interface FocusTargetLike {
  focus(): void;
}

let bodyScrollLockCount = 0;
let originalBodyOverflow = '';

export function Dialog({ children, policy, onDismiss, labelledBy, describedBy, ariaLabel, className = 'result-dialog', testId }: DialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const marked = dialog?.querySelector<HTMLElement>('[data-dialog-initial-focus="true"]');
    const initial = (marked && !marked.matches(':disabled') ? marked : null)
      ?? getFocusableDialogElements(dialog)[0]
      ?? dialog;
    initial?.focus();
  }, []);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const siblings = backdrop?.parentElement
      ? [...backdrop.parentElement.children].filter((element): element is HTMLElement => element instanceof HTMLElement && element !== backdrop)
      : [];
    const priorInert = siblings.map((element) => element.inert);
    siblings.forEach((element) => { element.inert = true; });
    lockBodyScroll();
    return () => {
      siblings.forEach((element, index) => { element.inert = priorInert[index]; });
      unlockBodyScroll();
      const returnTarget = returnFocusRef.current;
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    handleDialogKeyboardEvent(
      event,
      getFocusableDialogElements(dialogRef.current),
      document.activeElement as HTMLElement | null,
      policy,
      onDismiss,
    );
  };

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    event.stopPropagation();
    if (policy.backdrop === 'dismiss') onDismiss?.();
  };

  return (
    <div ref={backdropRef} className="result-backdrop" role="presentation" onMouseDown={handleBackdropClick} data-dialog-backdrop-behavior={policy.backdrop}>
      <section
        ref={dialogRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        data-dialog-escape-behavior={policy.escape}
        data-testid={testId}
      >
        {children}
      </section>
    </div>
  );
}

export function handleDialogKeyboardEvent(
  event: DialogKeyboardEventLike,
  focusables: readonly FocusTargetLike[],
  activeElement: FocusTargetLike | null,
  policy: DialogInteractionPolicy,
  onDismiss?: () => void,
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    if (policy.escape === 'dismiss') onDismiss?.();
    return;
  }
  if (event.key !== 'Tab') return;
  event.preventDefault();
  event.stopPropagation();
  if (focusables.length === 0) return;
  const currentIndex = focusables.indexOf(activeElement as FocusTargetLike);
  const nextIndex = event.shiftKey
    ? (currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1)
    : (currentIndex < 0 || currentIndex === focusables.length - 1 ? 0 : currentIndex + 1);
  focusables[nextIndex].focus();
}

function getFocusableDialogElements(container: HTMLElement | null | undefined): HTMLElement[] {
  if (!container) return [];
  return [...container.querySelectorAll<HTMLElement>([
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(','))].filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

function lockBodyScroll(): void {
  if (bodyScrollLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyScrollLockCount += 1;
}

function unlockBodyScroll(): void {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) document.body.style.overflow = originalBodyOverflow;
}
