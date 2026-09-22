import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HAND_PACK,
  HAND_PACK_IDS,
  HAND_PACKS,
  HAND_POSE_KEYS,
  getHandPack,
  preloadHandPack,
  resolveHandPoseAsset,
  type HandPack,
} from './handPacks';

describe('builtin hand Pack registry', () => {
  it('registers exactly nine static-url Packs with all seven poses and pose-local metadata', () => {
    expect(HAND_PACK_IDS).toEqual(['female', 'female_2', 'male', 'cat_orange', 'cat_grey', 'dog', 'gloved', 'robot', 'cyberpunk']);
    expect(Object.keys(HAND_PACKS)).toEqual(HAND_PACK_IDS);
    for (const pack of Object.values(HAND_PACKS)) {
      expect(Object.keys(pack.poses)).toEqual(HAND_POSE_KEYS);
      for (const pose of Object.values(pack.poses)) {
        expect(pose.url).toMatch(/\.png($|\?)/);
        expect(pose.url).not.toMatch(/^data:/);
        expect(pose.contact).toHaveLength(2);
        expect(pose.scale).toBeGreaterThan(0);
        expect(pose.offset).toHaveLength(2);
      }
    }
    for (const pose of Object.values(HAND_PACKS.female.poses)) {
      expect(pose.url).toContain('/packs/female/');
      expect(pose.url).not.toContain('/hand/default/');
    }
  });

  it('keeps the male ID while resolving the replacement assets and has no legacy aliases', () => {
    expect(getHandPack('male')).toBe(HAND_PACKS.male);
    for (const pose of Object.values(HAND_PACKS.male.poses)) {
      expect(pose.url).toContain('/packs/male/');
    }
    expect(HAND_PACK_IDS.filter((id) => id.startsWith('male'))).toEqual(['male']);
    expect(HAND_PACKS.female_2.id).toBe('female_2');
    expect(HAND_PACKS.gloved.id).toBe('gloved');
  });

  it('replaces the retired cat Pack with the orange and grey cat paw Packs', () => {
    expect(HAND_PACK_IDS).not.toContain('cat');
    expect(getHandPack('cat')).toBe(DEFAULT_HAND_PACK);
    for (const [id, sourceDirectory] of [['cat_orange', 'cat_orange'], ['cat_grey', 'cat_grey']] as const) {
      const pack = HAND_PACKS[id];
      expect(pack.id).toBe(id);
      for (const pose of Object.values(pack.poses)) expect(pose.url).toContain(`/packs/${sourceDirectory}/`);
    }
  });

  it('registers robot and cyberpunk from their own seven-pose source directories', () => {
    for (const id of ['robot', 'cyberpunk'] as const) {
      const pack = HAND_PACKS[id];
      expect(pack.id).toBe(id);
      for (const pose of Object.values(pack.poses)) expect(pose.url).toContain(`/packs/${id}/`);
    }
  });

  it('uses female for unknown Packs and for a missing pose in a malformed builtin', () => {
    expect(getHandPack('unknown')).toBe(DEFAULT_HAND_PACK);
    const malformed = {
      ...HAND_PACKS.cat_orange,
      poses: { ...HAND_PACKS.cat_orange.poses, 'touch-contact': undefined },
    } as unknown as HandPack;
    expect(resolveHandPoseAsset(malformed, 'touch-contact')).toBe(DEFAULT_HAND_PACK.poses['touch-contact']);
  });

  it('fails open per pose and decodes the female counterpart after a selected asset fails', async () => {
    const bad = {
      ...HAND_PACKS.gloved,
      poses: {
        ...HAND_PACKS.gloved.poses,
        'pinch-grab': { ...HAND_PACKS.gloved.poses['pinch-grab'], url: '/missing-pinch.png' },
      },
    } as HandPack;
    const decoded: string[] = [];
    await expect(preloadHandPack(bad, () => ({
      src: '',
      decode() {
        decoded.push(this.src);
        return this.src === '/missing-pinch.png' ? Promise.reject(new Error('decode')) : Promise.resolve();
      },
    }))).resolves.toBeUndefined();
    expect(decoded).toContain('/missing-pinch.png');
    expect(decoded).toContain(DEFAULT_HAND_PACK.poses['pinch-grab'].url);
  });
});
