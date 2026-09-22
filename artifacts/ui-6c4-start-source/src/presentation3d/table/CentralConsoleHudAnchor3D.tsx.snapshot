import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { ReactNode } from 'react';
import {
  getEffectiveCentralHudPosition,
  TABLE_PRESENTATION_TUNING,
} from './tablePresentationTuning';

export const CENTRAL_CONSOLE_HUD_ANCHOR = TABLE_PRESENTATION_TUNING.centralHud;

export function getCentralConsoleHudPosition() {
  const [effectiveX, effectiveY, effectiveZ] = getEffectiveCentralHudPosition();
  return [
    effectiveX + CENTRAL_CONSOLE_HUD_ANCHOR.hudOnlyOffsetX,
    effectiveY,
    effectiveZ + CENTRAL_CONSOLE_HUD_ANCHOR.hudOnlyOffsetZ,
  ] as const;
}

export function getCentralConsoleHudScale(viewportHeight: number): number {
  return viewportHeight <= CENTRAL_CONSOLE_HUD_ANCHOR.compactViewportMaxHeight
    ? CENTRAL_CONSOLE_HUD_ANCHOR.compactScale
    : CENTRAL_CONSOLE_HUD_ANCHOR.regularScale;
}

export function CentralConsoleHudAnchor3D({ children }: Readonly<{ children: ReactNode }>) {
  const viewportHeight = useThree((state) => state.size.height);
  return (
    <Html
      transform
      position={getCentralConsoleHudPosition()}
      rotation={CENTRAL_CONSOLE_HUD_ANCHOR.rotation}
      scale={getCentralConsoleHudScale(viewportHeight)}
      wrapperClass="table-3d-console-hud-anchor"
      style={{ pointerEvents: 'none' }}
      zIndexRange={[4, 1]}
    >
      {children}
    </Html>
  );
}
