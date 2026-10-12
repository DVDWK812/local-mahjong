import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { getCentralConsoleLayout } from './centralConsoleLayout';
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

export function CentralConsoleHudAnchor3D({ children, riichiLanes = false, tuning }: Readonly<{ children: ReactNode; riichiLanes?: boolean; tuning?: Readonly<{ x: number; y: number; z: number; scale: number }> }>) {
  const viewportHeight = useThree((state) => state.size.height);
  const assembly = getCentralConsoleLayout(viewportHeight);
  return (
    <Html
      transform
      position={tuning ? [assembly.scoreHud.position[0] + tuning.x, assembly.scoreHud.position[1] + tuning.y, assembly.scoreHud.position[2] + tuning.z] : assembly.scoreHud.position}
      rotation={CENTRAL_CONSOLE_HUD_ANCHOR.rotation}
      scale={(riichiLanes ? assembly.scoreHud.scale : getCentralConsoleHudScale(viewportHeight)) * (tuning?.scale ?? 1)}
      wrapperClass="table-3d-console-hud-anchor"
      style={{ pointerEvents: 'none' }}
      zIndexRange={[4, 1]}
    >
      {children}
    </Html>
  );
}
