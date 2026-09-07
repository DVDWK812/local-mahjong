import reach from './default/hand-reach.png';
import touch from './default/hand-touch-contact.png';
import pinch from './default/hand-pinch-grab.png';
import carry from './default/hand-carry-forward.png';
import release from './default/hand-release-open.png';
import arrange from './default/hand-arrange-push.png';
import retract from './default/hand-retract-relaxed.png';

/** Authored fingertip contact in normalized, original PNG coordinates. */
export const HAND_ASSETS = {
  'reach-open': { url: reach, contact: [0.18, 0.25], rotation: 0 },
  'touch-contact': { url: touch, contact: [0.19, 0.30], rotation: 0 },
  'pinch-grab': { url: pinch, contact: [0.18, 0.32], rotation: 0 },
  'carry-forward': { url: carry, contact: [0.18, 0.32], rotation: 0 },
  'release-open': { url: release, contact: [0.18, 0.31], rotation: 0 },
  'arrange-push': { url: arrange, contact: [0.21, 0.78], rotation: 90 },
  'retract-relaxed': { url: retract, contact: [0.19, 0.34], rotation: 0 },
} as const;
export type HandPose = keyof typeof HAND_ASSETS;

let preload: Promise<void> | undefined;
/** DOM decode only: never throws a promise into the Canvas Suspense boundary. */
export function preloadHandAssets(): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  return preload ??= Promise.all(Object.values(HAND_ASSETS).map(({ url }) => {
    const image = new Image();
    image.src = url;
    return image.decode().catch(() => undefined);
  })).then(() => undefined);
}
