import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import { LocalHandArea } from './LocalHandArea';
import { TileFaceDomAppearance } from '../../presentation/appearance/TileFaceDomAppearance';
/** Production layout: controllers supply data, legal commands and mode-specific detail. */
export function FormalGameScreen({ topBar, table, localHand, appearance, winOverlay, eventOverlay, handOverlay, actionPrompt, tenpai, details, result, children, ...attributes }: HTMLAttributes<HTMLElement> & {
  topBar: ReactNode; table: ReactNode; localHand: ComponentProps<typeof LocalHandArea>;
  appearance: Omit<ComponentProps<typeof TileFaceDomAppearance>, 'children'>; winOverlay?: ReactNode; eventOverlay?: ReactNode; handOverlay?: ReactNode;
  actionPrompt?: ReactNode; tenpai?: ReactNode; details?: ReactNode; result?: ReactNode;
}) {
  return <main {...attributes} className="game-screen" data-testid="game-screen">
    {topBar}{table}
    <TileFaceDomAppearance {...appearance}><LocalHandArea {...localHand} />{winOverlay}</TileFaceDomAppearance>
    {handOverlay}{eventOverlay}
    {actionPrompt ? <div className="game-prompt-layer">{actionPrompt}</div> : null}
    {tenpai ? <div className="game-tenpai-layer">{tenpai}</div> : null}
    {details}{result}{children}
  </main>;
}
