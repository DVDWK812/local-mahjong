import { createContext } from 'react';
import type { SceneSessionLifetime } from './initialFrameCommit';

/** Kept outside refreshable components so R3F and DOM roots share one identity. */
export const SceneSessionContext = createContext<Readonly<{
  rendererReady: boolean;
  lifetime: SceneSessionLifetime;
  onReady?: () => void;
}> | null>(null);
