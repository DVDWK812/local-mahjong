import type { TileId } from '../game/types';
import blackCatAvatar from '../assets/avatars/black-cat.png';
import borderCollieAvatar from '../assets/avatars/border-collie.png';
import corgiAvatar from '../assets/avatars/corgi.png';
import luckyCatAvatar from '../assets/avatars/lucky-cat.png';
import orcaAvatar from '../assets/avatars/orca.png';
import shibaAvatar from '../assets/avatars/shiba.png';

export type AvatarCategory = 'animal' | 'mahjong' | 'cute' | 'simple';
export type AvatarCategoryFilter = 'all' | AvatarCategory;

interface AvatarDefinitionBase {
  id: string;
  label: string;
  category: AvatarCategory;
  className: string;
}

type AvatarDefinitionInput = AvatarDefinitionBase & (
  | { kind: 'glyph'; glyph: string }
  | { kind: 'image'; src: string }
  | { kind: 'tile'; tileId: TileId }
);

export const AVATAR_CATEGORY_TABS: readonly { id: AvatarCategoryFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'animal', label: '动物' },
  { id: 'mahjong', label: '麻将' },
  { id: 'cute', label: '萌物' },
  { id: 'simple', label: '简约' },
];

export const AVATAR_REGISTRY = [
  // 动物：按名称拼音排序；保留 UI-1A 已发布 id，避免旧资料失效。
  { id: 'animal-rabbit', label: '白兔', category: 'animal', kind: 'glyph', glyph: '🐰', className: 'player-avatar--animal' },
  { id: 'animal-border-collie', label: '边牧', category: 'animal', kind: 'image', src: borderCollieAvatar, className: 'player-avatar--animal' },
  { id: 'animal-hamster', label: '仓鼠', category: 'animal', kind: 'glyph', glyph: '🐹', className: 'player-avatar--animal' },
  { id: 'animal-shiba', label: '柴犬', category: 'animal', kind: 'image', src: shibaAvatar, className: 'player-avatar--animal' },
  { id: 'animal-seal', label: '海豹', category: 'animal', kind: 'glyph', glyph: '🦭', className: 'player-avatar--animal' },
  { id: 'animal-dolphin', label: '海豚', category: 'animal', kind: 'glyph', glyph: '🐬', className: 'player-avatar--animal' },
  { id: 'animal-black-cat', label: '黑猫', category: 'animal', kind: 'image', src: blackCatAvatar, className: 'player-avatar--black-cat' },
  { id: 'animal-orca', label: '虎鲸', category: 'animal', kind: 'image', src: orcaAvatar, className: 'player-avatar--animal' },
  { id: 'avatar-04', label: '狐狸', category: 'animal', kind: 'glyph', glyph: '🦊', className: 'player-avatar--fox' },
  { id: 'avatar-03', label: '橘猫', category: 'animal', kind: 'glyph', glyph: '🐱', className: 'player-avatar--cat' },
  { id: 'animal-corgi', label: '柯基', category: 'animal', kind: 'image', src: corgiAvatar, className: 'player-avatar--animal' },
  { id: 'animal-chinchilla', label: '毛丝鼠', category: 'animal', kind: 'glyph', glyph: '🐭', className: 'player-avatar--animal' },
  { id: 'animal-owl', label: '猫头鹰', category: 'animal', kind: 'glyph', glyph: '🦉', className: 'player-avatar--animal' },
  { id: 'animal-penguin', label: '企鹅', category: 'animal', kind: 'glyph', glyph: '🐧', className: 'player-avatar--animal' },
  { id: 'animal-frog', label: '青蛙', category: 'animal', kind: 'glyph', glyph: '🐸', className: 'player-avatar--animal' },
  { id: 'animal-lion', label: '狮子', category: 'animal', kind: 'glyph', glyph: '🦁', className: 'player-avatar--animal' },
  { id: 'animal-capybara', label: '水豚', category: 'animal', kind: 'glyph', glyph: '🦫', className: 'player-avatar--animal' },
  { id: 'animal-chick', label: '小鸡', category: 'animal', kind: 'glyph', glyph: '🐥', className: 'player-avatar--animal' },
  { id: 'animal-whale', label: '小鲸鱼', category: 'animal', kind: 'glyph', glyph: '🐳', className: 'player-avatar--animal' },
  { id: 'animal-tiger', label: '小老虎', category: 'animal', kind: 'glyph', glyph: '🐯', className: 'player-avatar--animal' },
  { id: 'animal-deer', label: '小鹿', category: 'animal', kind: 'glyph', glyph: '🦌', className: 'player-avatar--animal' },
  { id: 'animal-bear', label: '小熊', category: 'animal', kind: 'glyph', glyph: '🐻', className: 'player-avatar--animal' },
  { id: 'avatar-02', label: '熊猫', category: 'animal', kind: 'glyph', glyph: '🐼', className: 'player-avatar--panda' },

  // 麻将：直接使用现有 34 种 tile asset；项目当前没有独立赤五图片资源。
  { id: 'tile-m1', label: '一万', category: 'mahjong', kind: 'tile', tileId: 0, className: 'player-avatar--mahjong' },
  { id: 'tile-m2', label: '二万', category: 'mahjong', kind: 'tile', tileId: 1, className: 'player-avatar--mahjong' },
  { id: 'tile-m3', label: '三万', category: 'mahjong', kind: 'tile', tileId: 2, className: 'player-avatar--mahjong' },
  { id: 'tile-m4', label: '四万', category: 'mahjong', kind: 'tile', tileId: 3, className: 'player-avatar--mahjong' },
  { id: 'tile-m5', label: '五万', category: 'mahjong', kind: 'tile', tileId: 4, className: 'player-avatar--mahjong' },
  { id: 'tile-m6', label: '六万', category: 'mahjong', kind: 'tile', tileId: 5, className: 'player-avatar--mahjong' },
  { id: 'tile-m7', label: '七万', category: 'mahjong', kind: 'tile', tileId: 6, className: 'player-avatar--mahjong' },
  { id: 'tile-m8', label: '八万', category: 'mahjong', kind: 'tile', tileId: 7, className: 'player-avatar--mahjong' },
  { id: 'tile-m9', label: '九万', category: 'mahjong', kind: 'tile', tileId: 8, className: 'player-avatar--mahjong' },
  { id: 'tile-p1', label: '一筒', category: 'mahjong', kind: 'tile', tileId: 9, className: 'player-avatar--mahjong' },
  { id: 'tile-p2', label: '二筒', category: 'mahjong', kind: 'tile', tileId: 10, className: 'player-avatar--mahjong' },
  { id: 'tile-p3', label: '三筒', category: 'mahjong', kind: 'tile', tileId: 11, className: 'player-avatar--mahjong' },
  { id: 'tile-p4', label: '四筒', category: 'mahjong', kind: 'tile', tileId: 12, className: 'player-avatar--mahjong' },
  { id: 'tile-p5', label: '五筒', category: 'mahjong', kind: 'tile', tileId: 13, className: 'player-avatar--mahjong' },
  { id: 'tile-p6', label: '六筒', category: 'mahjong', kind: 'tile', tileId: 14, className: 'player-avatar--mahjong' },
  { id: 'tile-p7', label: '七筒', category: 'mahjong', kind: 'tile', tileId: 15, className: 'player-avatar--mahjong' },
  { id: 'tile-p8', label: '八筒', category: 'mahjong', kind: 'tile', tileId: 16, className: 'player-avatar--mahjong' },
  { id: 'tile-p9', label: '九筒', category: 'mahjong', kind: 'tile', tileId: 17, className: 'player-avatar--mahjong' },
  { id: 'tile-s1', label: '一索', category: 'mahjong', kind: 'tile', tileId: 18, className: 'player-avatar--mahjong' },
  { id: 'tile-s2', label: '二索', category: 'mahjong', kind: 'tile', tileId: 19, className: 'player-avatar--mahjong' },
  { id: 'tile-s3', label: '三索', category: 'mahjong', kind: 'tile', tileId: 20, className: 'player-avatar--mahjong' },
  { id: 'tile-s4', label: '四索', category: 'mahjong', kind: 'tile', tileId: 21, className: 'player-avatar--mahjong' },
  { id: 'tile-s5', label: '五索', category: 'mahjong', kind: 'tile', tileId: 22, className: 'player-avatar--mahjong' },
  { id: 'tile-s6', label: '六索', category: 'mahjong', kind: 'tile', tileId: 23, className: 'player-avatar--mahjong' },
  { id: 'tile-s7', label: '七索', category: 'mahjong', kind: 'tile', tileId: 24, className: 'player-avatar--mahjong' },
  { id: 'tile-s8', label: '八索', category: 'mahjong', kind: 'tile', tileId: 25, className: 'player-avatar--mahjong' },
  { id: 'tile-s9', label: '九索', category: 'mahjong', kind: 'tile', tileId: 26, className: 'player-avatar--mahjong' },
  { id: 'tile-z1', label: '东', category: 'mahjong', kind: 'tile', tileId: 27, className: 'player-avatar--mahjong' },
  { id: 'tile-z2', label: '南', category: 'mahjong', kind: 'tile', tileId: 28, className: 'player-avatar--mahjong' },
  { id: 'tile-z3', label: '西', category: 'mahjong', kind: 'tile', tileId: 29, className: 'player-avatar--mahjong' },
  { id: 'tile-z4', label: '北', category: 'mahjong', kind: 'tile', tileId: 30, className: 'player-avatar--mahjong' },
  { id: 'tile-z5', label: '白', category: 'mahjong', kind: 'tile', tileId: 31, className: 'player-avatar--mahjong' },
  { id: 'tile-z6', label: '發', category: 'mahjong', kind: 'tile', tileId: 32, className: 'player-avatar--mahjong' },
  { id: 'avatar-01', label: '中', category: 'mahjong', kind: 'tile', tileId: 33, className: 'player-avatar--mahjong' },

  { id: 'cute-lucky-cat', label: '招财猫', category: 'cute', kind: 'image', src: luckyCatAvatar, className: 'player-avatar--cute' },
  { id: 'cute-daruma', label: '达摩', category: 'cute', kind: 'glyph', glyph: '🔴', className: 'player-avatar--cute' },
  { id: 'cute-lucky-bag', label: '福袋', category: 'cute', kind: 'glyph', glyph: '👝', className: 'player-avatar--cute' },
  { id: 'cute-koi', label: '锦鲤', category: 'cute', kind: 'glyph', glyph: '🐟', className: 'player-avatar--cute' },
  { id: 'cute-mahjong-ghost', label: '麻将幽灵', category: 'cute', kind: 'glyph', glyph: '👻', className: 'player-avatar--cute' },
  { id: 'cute-table-spirit', label: '雀桌精灵', category: 'cute', kind: 'glyph', glyph: '✨', className: 'player-avatar--cute' },
  { id: 'cute-cloud', label: '小云朵', category: 'cute', kind: 'glyph', glyph: '☁️', className: 'player-avatar--cute' },
  { id: 'cute-sun', label: '小太阳', category: 'cute', kind: 'glyph', glyph: '🌞', className: 'player-avatar--cute' },
  { id: 'cute-rice-ball', label: '小饭团', category: 'cute', kind: 'glyph', glyph: '🍙', className: 'player-avatar--cute' },
  { id: 'cute-milk-tea', label: '奶茶杯', category: 'cute', kind: 'glyph', glyph: '🧋', className: 'player-avatar--cute' },

  { id: 'simple-mountain', label: '山', category: 'simple', kind: 'glyph', glyph: '⛰️', className: 'player-avatar--simple' },
  { id: 'simple-moon', label: '月亮', category: 'simple', kind: 'glyph', glyph: '🌙', className: 'player-avatar--simple' },
  { id: 'simple-lightning', label: '闪电', category: 'simple', kind: 'glyph', glyph: '⚡', className: 'player-avatar--simple' },
  { id: 'simple-fire', label: '火焰', category: 'simple', kind: 'glyph', glyph: '🔥', className: 'player-avatar--simple' },
  { id: 'simple-snowflake', label: '雪花', category: 'simple', kind: 'glyph', glyph: '❄️', className: 'player-avatar--simple' },
  { id: 'simple-star', label: '星星', category: 'simple', kind: 'glyph', glyph: '⭐', className: 'player-avatar--simple' },
  { id: 'simple-bamboo', label: '竹叶', category: 'simple', kind: 'glyph', glyph: '🎋', className: 'player-avatar--simple' },
  { id: 'simple-fan', label: '扇子', category: 'simple', kind: 'glyph', glyph: '🪭', className: 'player-avatar--simple' },
  { id: 'simple-cherry-blossom', label: '樱花', category: 'simple', kind: 'glyph', glyph: '🌸', className: 'player-avatar--simple' },
  { id: 'simple-water-drop', label: '水滴', category: 'simple', kind: 'glyph', glyph: '💧', className: 'player-avatar--simple' },
] as const satisfies readonly AvatarDefinitionInput[];

export type AvatarDefinition = (typeof AVATAR_REGISTRY)[number];
export type BuiltinAvatarId = AvatarDefinition['id'];
export type CustomAvatarId = `custom:${string}`;
/** PlayerProfile remains the sole avatar-selection authority. */
export type AvatarId = BuiltinAvatarId | CustomAvatarId;

export const AVATAR_IDS: readonly BuiltinAvatarId[] = AVATAR_REGISTRY.map((avatar) => avatar.id);
export const DEFAULT_AVATAR_ID: BuiltinAvatarId = 'avatar-01';

export function avatarsForCategory(category: AvatarCategoryFilter): readonly AvatarDefinition[] {
  return category === 'all'
    ? AVATAR_REGISTRY
    : AVATAR_REGISTRY.filter((avatar) => avatar.category === category);
}

export function isBuiltinAvatarId(value: unknown): value is BuiltinAvatarId {
  return typeof value === 'string' && AVATAR_IDS.includes(value as BuiltinAvatarId);
}

export function createCustomAvatarId(assetId: string): CustomAvatarId {
  return `custom:${assetId}`;
}

export function getCustomAvatarAssetId(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('custom:')) return null;
  const assetId = value.slice('custom:'.length);
  return /^[a-z0-9][a-z0-9._-]{0,127}$/i.test(assetId) ? assetId : null;
}

export function isAvatarId(value: unknown): value is AvatarId {
  return isBuiltinAvatarId(value) || getCustomAvatarAssetId(value) !== null;
}

export function getAvatarDefinition(id: BuiltinAvatarId): AvatarDefinition {
  return AVATAR_REGISTRY.find((avatar) => avatar.id === id)
    ?? AVATAR_REGISTRY.find((avatar) => avatar.id === DEFAULT_AVATAR_ID)!;
}
