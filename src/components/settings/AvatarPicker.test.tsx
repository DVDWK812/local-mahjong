import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AVATAR_REGISTRY,
  avatarsForCategory,
  type AvatarCategoryFilter,
  type AvatarId,
} from '../../profile/avatars';
import { AvatarPicker } from './AvatarPicker';

const mahjongLabels = [
  '一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万',
  '一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒',
  '一索', '二索', '三索', '四索', '五索', '六索', '七索', '八索', '九索',
  '东', '南', '西', '北', '白', '發', '中',
];

const animalLabels = [
  '白兔', '边牧', '仓鼠', '柴犬', '海豹', '海豚', '黑猫', '虎鲸', '狐狸', '橘猫',
  '柯基', '毛丝鼠', '猫头鹰', '企鹅', '青蛙', '狮子', '水豚', '小鸡', '小鲸鱼',
  '小老虎', '小鹿', '小熊', '熊猫',
];

function renderPicker(category: AvatarCategoryFilter, selectedAvatarId: AvatarId = 'avatar-02') {
  return renderToStaticMarkup(
    <AvatarPicker
      category={category}
      selectedAvatarId={selectedAvatarId}
      onCategoryChange={() => undefined}
      onSelect={() => undefined}
    />,
  );
}

describe('AvatarPicker', () => {
  it('默认全部视图包含五个 Tabs 和所有 77 个稳定且不重复的头像 id', () => {
    const html = renderPicker('all');
    expect(AVATAR_REGISTRY).toHaveLength(77);
    expect(new Set(AVATAR_REGISTRY.map((avatar) => avatar.id)).size).toBe(77);
    expect((html.match(/role="tab"/g) ?? [])).toHaveLength(5);
    expect(html).toMatch(/id="avatar-category-tab-all"[^>]*aria-selected="true"/);
    expect((html.match(/aria-label="选择头像：/g) ?? [])).toHaveLength(77);
    expect(html).toContain('自定义头像');
    expect(html).not.toContain('暂未开放');
  });

  it('动物分类按名称拼音排序完整显示 23 个动物，并排除其他分类', () => {
    const html = renderPicker('animal');
    expect(avatarsForCategory('animal').map((avatar) => avatar.label)).toEqual(animalLabels);
    for (const label of ['熊猫', '橘猫', '黑猫', '柴犬', '水豚', '小鲸鱼', '狮子']) {
      expect(html).toContain(`选择头像：${label}`);
    }
    for (const label of ['东', '中', '招财猫', '月亮']) {
      expect(html).not.toContain(`选择头像：${label}`);
    }
  });

  it('六个纠正后的头像使用统一生成的本地图片资源', () => {
    const imageAvatarIds = [
      'animal-border-collie',
      'animal-shiba',
      'animal-black-cat',
      'animal-orca',
      'animal-corgi',
      'cute-lucky-cat',
    ];
    const imageAvatars = AVATAR_REGISTRY.filter((avatar) => imageAvatarIds.includes(avatar.id));
    expect(imageAvatars).toHaveLength(6);
    expect(imageAvatars.every((avatar) => avatar.kind === 'image')).toBe(true);
    expect((renderPicker('all').match(/player-avatar__image/g) ?? [])).toHaveLength(6);
  });

  it('麻将分类使用现有资源覆盖全部 34 种标准牌型', () => {
    const avatars = avatarsForCategory('mahjong');
    const html = renderPicker('mahjong');
    expect(avatars).toHaveLength(34);
    expect(avatars.every((avatar) => avatar.kind === 'tile')).toBe(true);
    expect(new Set(avatars.map((avatar) => avatar.kind === 'tile' ? avatar.tileId : -1)).size).toBe(34);
    expect((html.match(/player-avatar__tile-image/g) ?? [])).toHaveLength(34);
    for (const label of mahjongLabels) expect(html).toContain(`选择头像：${label}`);
  });

  it('萌物和简约分类只显示各自的 10 个头像', () => {
    const cuteHtml = renderPicker('cute');
    const simpleHtml = renderPicker('simple');
    expect(avatarsForCategory('cute')).toHaveLength(10);
    expect(avatarsForCategory('simple')).toHaveLength(10);
    for (const label of ['招财猫', '达摩', '福袋', '锦鲤', '麻将幽灵']) {
      expect(cuteHtml).toContain(`选择头像：${label}`);
    }
    for (const label of ['山', '月亮', '闪电', '星星', '樱花', '水滴']) {
      expect(simpleHtml).toContain(`选择头像：${label}`);
    }
  });

  it('切换过滤视图不会改变当前头像，返回所属分类后仍保留选中语义', () => {
    const selectedAvatarId: AvatarId = 'avatar-02';
    expect(renderPicker('mahjong', selectedAvatarId)).not.toContain('aria-pressed="true"');
    const animalHtml = renderPicker('animal', selectedAvatarId);
    expect(animalHtml).toMatch(/aria-label="选择头像：熊猫"[^>]*aria-pressed="true"/);
    expect(selectedAvatarId).toBe('avatar-02');
  });
});
