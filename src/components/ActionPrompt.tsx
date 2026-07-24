import type { ReactNode } from 'react';

interface ActionPromptProps {
  title: string;
  children: ReactNode;
}

export function ActionPrompt({ title, children }: ActionPromptProps) {
  return (
    <section className="action-prompt" role="dialog" aria-label={title}>
      <strong>{title}</strong>
      <div className="action-prompt-actions">
        {children}
      </div>
    </section>
  );
}
