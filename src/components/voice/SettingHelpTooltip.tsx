import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipPosition {
  readonly left: number;
  readonly top: number;
  readonly placement: 'above' | 'below';
}

/**
 * Keep setting help outside scrolling table rows so it is never clipped by a
 * fieldset or the Voice Management list's overflow container.
 */
export function settingHelpTooltipPosition(
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  viewportWidth: number,
): TooltipPosition {
  const horizontalPadding = 12;
  const width = Math.min(300, Math.max(0, viewportWidth - horizontalPadding * 2));
  const center = rect.left + (rect.right - rect.left) / 2;
  return {
    left: Math.max(horizontalPadding + width / 2, Math.min(viewportWidth - horizontalPadding - width / 2, center)),
    top: rect.top < 150 ? rect.bottom + 8 : rect.top - 8,
    placement: rect.top < 150 ? 'below' : 'above',
  };
}

interface SettingHelpTooltipProps {
  readonly text: string;
}

export function SettingHelpTooltip({ text }: SettingHelpTooltipProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const descriptionId = `setting-help-description-${useId().replace(/:/g, '')}`;
  const tooltipId = `${descriptionId}-popup`;

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === 'undefined') return;
    setPosition(settingHelpTooltipPosition(button.getBoundingClientRect(), window.innerWidth));
  }, []);
  const show = useCallback(() => { updatePosition(); setOpen(true); }, [updatePosition]);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    const refresh = () => updatePosition();
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => { window.removeEventListener('resize', refresh); window.removeEventListener('scroll', refresh, true); };
  }, [open, updatePosition]);

  return <>
    <button
      ref={buttonRef}
      type="button"
      className="voice-management-screen__setting-help-button"
      aria-label="查看生成设置说明"
      aria-describedby={descriptionId}
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); show(); }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >ⓘ</button>
    <span id={descriptionId} className="voice-management-screen__setting-help-description">{text}</span>
    {open && position && typeof document !== 'undefined' ? createPortal(
      <span
        id={tooltipId}
        role="tooltip"
        className="voice-management-screen__setting-help-tooltip"
        data-placement={position.placement}
        style={{ left: position.left, top: position.top }}
      >{text}</span>,
      document.body,
    ) : null}
  </>;
}
