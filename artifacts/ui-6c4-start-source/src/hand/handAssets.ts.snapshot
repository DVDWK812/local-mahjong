import { DEFAULT_HAND_PACK, preloadHandPack, type HandPoseKey } from './handPacks';

/** Compatibility alias for the frozen female/default asset authority. */
export const HAND_ASSETS = DEFAULT_HAND_PACK.poses;
export type HandPose = HandPoseKey;

export function preloadHandAssets(): Promise<void> {
  return preloadHandPack(DEFAULT_HAND_PACK);
}
