import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type OperationKind = 'win' | 'riichi' | 'kan' | 'pon' | 'chi' | 'abortive' | 'pass';

interface ActionPromptProps {
  title: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
}

export function ActionPrompt({ title, ariaLabel, children }: ActionPromptProps) {
  return (
    <section className="action-prompt" role="dialog" aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)} data-operation-area="stable">
      <strong>{title}</strong>
      <div className="action-prompt-actions">
        {children}
      </div>
    </section>
  );
}

export function operationButtonClassName(kind: OperationKind, className = ''): string {
  return `operation-button operation-button--${kind}${className ? ` ${className}` : ''}`;
}

export function OperationButton({ kind, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { kind: OperationKind }) {
  return <button {...props} type="button" className={operationButtonClassName(kind, className)} data-operation={kind} />;
}
