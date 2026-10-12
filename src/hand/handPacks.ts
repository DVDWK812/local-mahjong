import femaleReach from './packs/female/reach-open.png';
import femaleTouch from './packs/female/touch-contact.png';
import femalePinch from './packs/female/pinch-grab.png';
import femaleCarry from './packs/female/carry-forward.png';
import femaleRelease from './packs/female/release-open.png';
import femaleArrange from './packs/female/arrange-push.png';
import femaleRetract from './packs/female/retract-relaxed.png';
import female2Reach from './packs/female_2/reach-open.png';
import female2Touch from './packs/female_2/touch-contact.png';
import female2Pinch from './packs/female_2/pinch-grab.png';
import female2Carry from './packs/female_2/carry-forward.png';
import female2Release from './packs/female_2/release-open.png';
import female2Arrange from './packs/female_2/arrange-push.png';
import female2Retract from './packs/female_2/retract-relaxed.png';
import maleReach from './packs/male/reach-open.png';
import maleTouch from './packs/male/touch-contact.png';
import malePinch from './packs/male/pinch-grab.png';
import maleCarry from './packs/male/carry-forward.png';
import maleRelease from './packs/male/release-open.png';
import maleArrange from './packs/male/arrange-push.png';
import maleRetract from './packs/male/retract-relaxed.png';
import catOrangeReach from './packs/cat_orange/reach-open.png';
import catOrangeTouch from './packs/cat_orange/touch-contact.png';
import catOrangePinch from './packs/cat_orange/pinch-grab.png';
import catOrangeCarry from './packs/cat_orange/carry-forward.png';
import catOrangeRelease from './packs/cat_orange/release-open.png';
import catOrangeArrange from './packs/cat_orange/arrange-push.png';
import catOrangeRetract from './packs/cat_orange/retract-relaxed.png';
import catGreyReach from './packs/cat_grey/reach-open.png';
import catGreyTouch from './packs/cat_grey/touch-contact.png';
import catGreyPinch from './packs/cat_grey/pinch-grab.png';
import catGreyCarry from './packs/cat_grey/carry-forward.png';
import catGreyRelease from './packs/cat_grey/release-open.png';
import catGreyArrange from './packs/cat_grey/arrange-push.png';
import catGreyRetract from './packs/cat_grey/retract-relaxed.png';
import dogReach from './packs/dog/reach-open.png';
import dogTouch from './packs/dog/touch-contact.png';
import dogPinch from './packs/dog/pinch-grab.png';
import dogCarry from './packs/dog/carry-forward.png';
import dogRelease from './packs/dog/release-open.png';
import dogArrange from './packs/dog/arrange-push.png';
import dogRetract from './packs/dog/retract-relaxed.png';
import glovedReach from './packs/gloved/reach-open.png';
import glovedTouch from './packs/gloved/touch-contact.png';
import glovedPinch from './packs/gloved/pinch-grab.png';
import glovedCarry from './packs/gloved/carry-forward.png';
import glovedRelease from './packs/gloved/release-open.png';
import glovedArrange from './packs/gloved/arrange-push.png';
import glovedRetract from './packs/gloved/retract-relaxed.png';
import robotReach from './packs/robot/reach-open.png';
import robotTouch from './packs/robot/touch-contact.png';
import robotPinch from './packs/robot/pinch-grab.png';
import robotCarry from './packs/robot/carry-forward.png';
import robotRelease from './packs/robot/release-open.png';
import robotArrange from './packs/robot/arrange-push.png';
import robotRetract from './packs/robot/retract-relaxed.png';
import cyberpunkReach from './packs/cyberpunk/reach-open.png';
import cyberpunkTouch from './packs/cyberpunk/touch-contact.png';
import cyberpunkPinch from './packs/cyberpunk/pinch-grab.png';
import cyberpunkCarry from './packs/cyberpunk/carry-forward.png';
import cyberpunkRelease from './packs/cyberpunk/release-open.png';
import cyberpunkArrange from './packs/cyberpunk/arrange-push.png';
import cyberpunkRetract from './packs/cyberpunk/retract-relaxed.png';
import crimsonGoldDragonReach from './packs/crimson_gold_dragon/reach-open.png';
import crimsonGoldDragonTouch from './packs/crimson_gold_dragon/touch-contact.png';
import crimsonGoldDragonPinch from './packs/crimson_gold_dragon/pinch-grab.png';
import crimsonGoldDragonCarry from './packs/crimson_gold_dragon/carry-forward.png';
import crimsonGoldDragonRelease from './packs/crimson_gold_dragon/release-open.png';
import crimsonGoldDragonArrange from './packs/crimson_gold_dragon/arrange-push.png';
import crimsonGoldDragonRetract from './packs/crimson_gold_dragon/retract-relaxed.png';
import jadeMechanismReach from './packs/jade_mechanism/reach-open.png';
import jadeMechanismTouch from './packs/jade_mechanism/touch-contact.png';
import jadeMechanismPinch from './packs/jade_mechanism/pinch-grab.png';
import jadeMechanismCarry from './packs/jade_mechanism/carry-forward.png';
import jadeMechanismRelease from './packs/jade_mechanism/release-open.png';
import jadeMechanismArrange from './packs/jade_mechanism/arrange-push.png';
import jadeMechanismRetract from './packs/jade_mechanism/retract-relaxed.png';
import plushHandReach from './packs/plush_hand/reach-open.png';
import plushHandTouch from './packs/plush_hand/touch-contact.png';
import plushHandPinch from './packs/plush_hand/pinch-grab.png';
import plushHandCarry from './packs/plush_hand/carry-forward.png';
import plushHandRelease from './packs/plush_hand/release-open.png';
import plushHandArrange from './packs/plush_hand/arrange-push.png';
import plushHandRetract from './packs/plush_hand/retract-relaxed.png';

export const HAND_POSE_KEYS = [
  'reach-open',
  'touch-contact',
  'pinch-grab',
  'carry-forward',
  'release-open',
  'arrange-push',
  'retract-relaxed',
] as const;
export type HandPoseKey = typeof HAND_POSE_KEYS[number];

export const HAND_PACK_IDS = ['female', 'female_2', 'male', 'cat_orange', 'cat_grey', 'dog', 'gloved', 'robot', 'cyberpunk', 'crimson_gold_dragon', 'jade_mechanism', 'plush_hand'] as const;
export type HandPackId = typeof HAND_PACK_IDS[number];

export type HandPoseAsset = Readonly<{
  url: string;
  /** Authored contact point in normalized source-image coordinates. */
  contact: readonly [number, number];
  /** Pose-local correction only; seat rotation remains the animation authority. */
  rotation: number;
  scale: number;
  /** Normalized correction relative to the frozen controller sprite size. */
  offset: readonly [number, number];
  /** Optional normalized clipping insets: top, right, bottom, left. */
  crop?: readonly [number, number, number, number];
}>;

export type HandPack = Readonly<{
  id: HandPackId;
  name: string;
  previewPose: HandPoseKey;
  poses: Readonly<Record<HandPoseKey, HandPoseAsset>>;
}>;

const pose = (
  url: string,
  contact: readonly [number, number],
  rotation = 0,
  scale = 1,
  offset: readonly [number, number] = [0, 0],
): HandPoseAsset => ({ url, contact, rotation, scale, offset });

const female: HandPack = {
  id: 'female',
  name: 'Female',
  previewPose: 'touch-contact',
  poses: {
    'reach-open': pose(femaleReach, [0.18, 0.25]),
    'touch-contact': pose(femaleTouch, [0.19, 0.30]),
    'pinch-grab': pose(femalePinch, [0.18, 0.32]),
    'carry-forward': pose(femaleCarry, [0.18, 0.32]),
    'release-open': pose(femaleRelease, [0.18, 0.31]),
    'arrange-push': pose(femaleArrange, [0.21, 0.78], 90),
    'retract-relaxed': pose(femaleRetract, [0.19, 0.34]),
  },
};

const female2: HandPack = {
  id: 'female_2',
  name: 'Female 2',
  previewPose: 'touch-contact',
  poses: {
    'reach-open': pose(female2Reach, [0.15, 0.27], 0, 1.08),
    'touch-contact': pose(female2Touch, [0.19, 0.30], 0, 1.08),
    'pinch-grab': pose(female2Pinch, [0.21, 0.28], 0, 1.08),
    'carry-forward': pose(female2Carry, [0.20, 0.27], 0, 1.08),
    'release-open': pose(female2Release, [0.18, 0.30], 0, 1.08),
    'arrange-push': pose(female2Arrange, [0.13, 0.18], 0, 1.08),
    'retract-relaxed': pose(female2Retract, [0.20, 0.29], 0, 1.08),
  },
};

const male: HandPack = {
  id: 'male',
  name: 'Male',
  previewPose: 'touch-contact',
  poses: {
    'reach-open': pose(maleReach, [0.15, 0.27], 0, 1.06),
    'touch-contact': pose(maleTouch, [0.18, 0.30], 0, 1.06),
    'pinch-grab': pose(malePinch, [0.20, 0.29], 0, 1.06),
    'carry-forward': pose(maleCarry, [0.19, 0.28], 0, 1.06),
    'release-open': pose(maleRelease, [0.18, 0.30], 0, 1.06),
    'arrange-push': pose(maleArrange, [0.14, 0.19], 0, 1.06),
    'retract-relaxed': pose(maleRetract, [0.19, 0.29], 0, 1.06),
  },
};

const catOrange: HandPack = {
  id: 'cat_orange',
  name: 'Orange Cat Paw',
  previewPose: 'touch-contact',
  poses: {
    'reach-open': pose(catOrangeReach, [0.17, 0.25], 0, 0.94),
    'touch-contact': pose(catOrangeTouch, [0.16, 0.29], 0, 0.94),
    'pinch-grab': pose(catOrangePinch, [0.16, 0.30], 0, 0.94),
    'carry-forward': pose(catOrangeCarry, [0.18, 0.29], 0, 0.94),
    'release-open': pose(catOrangeRelease, [0.17, 0.29], 0, 0.94),
    'arrange-push': pose(catOrangeArrange, [0.16, 0.27], 0, 0.94),
    'retract-relaxed': pose(catOrangeRetract, [0.16, 0.30], 0, 0.94),
  },
};

const catGrey: HandPack = {
  id: 'cat_grey',
  name: 'Grey Cat Paw',
  previewPose: 'touch-contact',
  poses: {
    'reach-open': pose(catGreyReach, [0.17, 0.25], 0, 0.94),
    'touch-contact': pose(catGreyTouch, [0.16, 0.29], 0, 0.94),
    'pinch-grab': pose(catGreyPinch, [0.16, 0.30], 0, 0.94),
    'carry-forward': pose(catGreyCarry, [0.18, 0.29], 0, 0.94),
    'release-open': pose(catGreyRelease, [0.17, 0.29], 0, 0.94),
    'arrange-push': pose(catGreyArrange, [0.16, 0.27], 0, 0.94),
    'retract-relaxed': pose(catGreyRetract, [0.16, 0.30], 0, 0.94),
  },
};

const dog: HandPack = {
  id: 'dog',
  name: 'Dog Paw',
  previewPose: 'touch-contact',
  poses: {
    'reach-open': pose(dogReach, [0.17, 0.25], 0, 0.92),
    'touch-contact': pose(dogTouch, [0.16, 0.29], 0, 0.92),
    'pinch-grab': pose(dogPinch, [0.16, 0.30], 0, 0.92),
    'carry-forward': pose(dogCarry, [0.18, 0.29], 0, 0.92),
    'release-open': pose(dogRelease, [0.17, 0.29], 0, 0.92),
    'arrange-push': pose(dogArrange, [0.16, 0.27], 0, 0.92),
    'retract-relaxed': pose(dogRetract, [0.16, 0.30], 0, 0.92),
  },
};

const gloved: HandPack = {
  id: 'gloved',
  name: 'Gloved',
  previewPose: 'touch-contact',
  poses: {
    'reach-open': pose(glovedReach, [0.15, 0.28], 0, 1.05),
    'touch-contact': pose(glovedTouch, [0.18, 0.31], 0, 1.05),
    'pinch-grab': pose(glovedPinch, [0.20, 0.30], 0, 1.05),
    'carry-forward': pose(glovedCarry, [0.19, 0.29], 0, 1.05),
    'release-open': pose(glovedRelease, [0.18, 0.31], 0, 1.05),
    'arrange-push': pose(glovedArrange, [0.14, 0.20], 0, 1.05),
    'retract-relaxed': pose(glovedRetract, [0.19, 0.30], 0, 1.05),
  },
};

const robot: HandPack = {
  id: 'robot',
  name: 'Robot',
  previewPose: 'touch-contact',
  poses: {
    'reach-open': pose(robotReach, [0.19, 0.26], 0, 1.02),
    'touch-contact': pose(robotTouch, [0.25, 0.31], 0, 1.02),
    'pinch-grab': pose(robotPinch, [0.26, 0.34], 0, 1.02),
    'carry-forward': pose(robotCarry, [0.25, 0.34], 0, 1.02),
    'release-open': pose(robotRelease, [0.20, 0.28], 0, 1.02),
    'arrange-push': pose(robotArrange, [0.22, 0.29], 0, 1.02),
    'retract-relaxed': pose(robotRetract, [0.25, 0.33], 0, 1.02),
  },
};

const cyberpunk: HandPack = {
  id: 'cyberpunk',
  name: 'Cyberpunk',
  previewPose: 'touch-contact',
  poses: {
    'reach-open': pose(cyberpunkReach, [0.20, 0.26], 0, 1.04),
    'touch-contact': pose(cyberpunkTouch, [0.25, 0.31], 0, 1.04),
    'pinch-grab': pose(cyberpunkPinch, [0.28, 0.33], 0, 1.04),
    'carry-forward': pose(cyberpunkCarry, [0.27, 0.33], 0, 1.04),
    'release-open': pose(cyberpunkRelease, [0.20, 0.28], 0, 1.04),
    'arrange-push': pose(cyberpunkArrange, [0.22, 0.29], 0, 1.04),
    'retract-relaxed': pose(cyberpunkRetract, [0.27, 0.33], 0, 1.04),
  },
};

const crimsonGoldDragon: HandPack = {
  id: 'crimson_gold_dragon',
  name: '赤金龙爪',
  previewPose: 'touch-contact',
  poses: {
    'reach-open': pose(crimsonGoldDragonReach, [0.24, 0.33], 0, 1.04),
    'touch-contact': pose(crimsonGoldDragonTouch, [0.28, 0.37], 0, 1.04),
    'pinch-grab': pose(crimsonGoldDragonPinch, [0.29, 0.38], 0, 1.04),
    'carry-forward': pose(crimsonGoldDragonCarry, [0.28, 0.37], 0, 1.04),
    'release-open': pose(crimsonGoldDragonRelease, [0.25, 0.34], 0, 1.04),
    'arrange-push': pose(crimsonGoldDragonArrange, [0.29, 0.38], 0, 1.04),
    'retract-relaxed': pose(crimsonGoldDragonRetract, [0.27, 0.37], 0, 1.04),
  },
};

const jadeMechanism: HandPack = {
  id: 'jade_mechanism',
  name: '青白玉机关',
  previewPose: 'touch-contact',
  poses: {
    'reach-open': pose(jadeMechanismReach, [0.25, 0.34], 0, 1.05),
    'touch-contact': pose(jadeMechanismTouch, [0.27, 0.36], 0, 1.05),
    'pinch-grab': pose(jadeMechanismPinch, [0.28, 0.37], 0, 1.05),
    'carry-forward': pose(jadeMechanismCarry, [0.27, 0.36], 0, 1.05),
    'release-open': pose(jadeMechanismRelease, [0.24, 0.34], 0, 1.05),
    'arrange-push': pose(jadeMechanismArrange, [0.26, 0.34], 0, 1.05),
    'retract-relaxed': pose(jadeMechanismRetract, [0.27, 0.36], 0, 1.05),
  },
};

const plushHand: HandPack = {
  id: 'plush_hand',
  name: '玩偶手',
  previewPose: 'touch-contact',
  poses: {
    'reach-open': pose(plushHandReach, [0.24, 0.34], 0, 1.03),
    'touch-contact': pose(plushHandTouch, [0.27, 0.36], 0, 1.03),
    'pinch-grab': pose(plushHandPinch, [0.28, 0.37], 0, 1.03),
    'carry-forward': pose(plushHandCarry, [0.27, 0.36], 0, 1.03),
    'release-open': pose(plushHandRelease, [0.25, 0.34], 0, 1.03),
    'arrange-push': pose(plushHandArrange, [0.26, 0.34], 0, 1.03),
    'retract-relaxed': pose(plushHandRetract, [0.27, 0.36], 0, 1.03),
  },
};

export const HAND_PACKS: Readonly<Record<HandPackId, HandPack>> = Object.freeze({
  female: Object.freeze(female),
  female_2: Object.freeze(female2),
  male: Object.freeze(male),
  cat_orange: Object.freeze(catOrange),
  cat_grey: Object.freeze(catGrey),
  dog: Object.freeze(dog),
  gloved: Object.freeze(gloved),
  robot: Object.freeze(robot),
  cyberpunk: Object.freeze(cyberpunk),
  crimson_gold_dragon: Object.freeze(crimsonGoldDragon),
  jade_mechanism: Object.freeze(jadeMechanism),
  plush_hand: Object.freeze(plushHand),
});

export const DEFAULT_HAND_PACK = HAND_PACKS.female;

export function isHandPackId(value: unknown): value is HandPackId {
  return typeof value === 'string' && HAND_PACK_IDS.includes(value as HandPackId);
}

export function getHandPack(value: unknown): HandPack {
  return isHandPackId(value) ? HAND_PACKS[value] : DEFAULT_HAND_PACK;
}

/** Runtime-safe because a bad builtin pose must never break the animation consumer. */
export function resolveHandPoseAsset(pack: HandPack, key: HandPoseKey): HandPoseAsset {
  const candidate = (pack.poses as Partial<Record<HandPoseKey, HandPoseAsset>>)[key];
  return candidate?.url ? candidate : DEFAULT_HAND_PACK.poses[key];
}

type DecodeImage = Pick<HTMLImageElement, 'src' | 'decode'>;
type ImageFactory = () => DecodeImage;
const preloadByPack = new Map<HandPackId, Promise<void>>();

async function decode(url: string, factory: ImageFactory): Promise<boolean> {
  const image = factory();
  image.src = url;
  try {
    await image.decode();
    return true;
  } catch {
    return false;
  }
}

/** DOM decode only: no promise is ever thrown into the Canvas Suspense boundary. */
export function preloadHandPack(packOrId: HandPack | HandPackId, factory?: ImageFactory): Promise<void> {
  if (!factory && typeof Image === 'undefined') return Promise.resolve();
  const pack = typeof packOrId === 'string' ? getHandPack(packOrId) : packOrId;
  const imageFactory = factory ?? (() => new Image());
  const load = async () => {
    await Promise.all(HAND_POSE_KEYS.map(async (key) => {
      const asset = resolveHandPoseAsset(pack, key);
      if (await decode(asset.url, imageFactory)) return;
      const fallback = DEFAULT_HAND_PACK.poses[key];
      if (fallback.url !== asset.url) await decode(fallback.url, imageFactory);
    }));
  };
  if (factory) return load();
  const existing = preloadByPack.get(pack.id);
  if (existing) return existing;
  const pending = load();
  preloadByPack.set(pack.id, pending);
  return pending;
}

export function preloadHandPacks(ids: readonly HandPackId[]): Promise<void> {
  return Promise.all([...new Set(ids)].map((id) => preloadHandPack(id))).then(() => undefined);
}

export function resetHandPackPreloadCacheForTests(): void {
  preloadByPack.clear();
}
