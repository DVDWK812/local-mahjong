import type { ReactNode } from 'react';

interface ActionPromptProps {
  title: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
}

export function ActionPrompt({ title, ariaLabel, children }: ActionPromptProps) {
  return (
    <section className="action-prompt" role="dialog" aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}>
      <strong>{title}</strong>
      <div className="action-prompt-actions">
        {children}
      </div>
    </section>
  );
}
