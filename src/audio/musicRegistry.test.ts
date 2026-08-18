import { describe, expect, it } from 'vitest';
import {
  BUILTIN_MUSIC_TRACKS,
  GAME_SFX_GROUP_BY_ACTION,
  GAME_SFX_TO_TRACK,
  createMusicRegistry,
  gameSfxGroupFromModulePath,
  musicCategoryFromModulePath,
  musicDisplayNameFromFileName,
} from './musicRegistry';

describe('Music Registry', () => {
  it('MP3 被识别并按文件名生成显示名', () => {
    const tracks = createMusicRegistry({
      '/src/music/bgm_main/menu_theme_01.mp3': '/assets/menu_theme_01.mp3',
    });
    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({
      category: 'bgm_main',
      name: 'menu theme 01',
      sourceType: 'builtin',
      url: '/assets/menu_theme_01.mp3',
    });
  });

  it('WAV 被识别且分类映射正确', () => {
    const tracks = createMusicRegistry({
      '/src/music/bgm_game/table_bgm.wav': '/assets/table_bgm.wav',
      '/src/music/bgm_richi/tenpai.wav': '/assets/tenpai.wav',
      '/src/music/effects/default-tile.wav': '/assets/default-tile.wav',
    });
    expect(tracks.map((track) => track.category)).toEqual(['bgm_game', 'bgm_richi', 'effects']);
    expect(tracks.every((track) => track.url && track.id.startsWith('builtin:'))).toBe(true);
  });

  it('稳定 ID：相同模块映射重复生成结果一致', () => {
    const modules = {
      '/src/music/bgm_main/Four Winds.wav': '/assets/four-winds.wav',
      '/src/music/effects/default-tile.wav': '/assets/default-tile.wav',
    };
    expect(createMusicRegistry(modules).map((track) => track.id))
      .toEqual(createMusicRegistry(modules).map((track) => track.id));
  });

  it('空目录安全返回空数组', () => {
    expect(createMusicRegistry({})).toEqual([]);
    expect(musicCategoryFromModulePath('/src/music/unknown/foo.wav')).toBeNull();
  });

  it('真实内置 registry：默认音效存在，BGM 分类按目录注册，voice_lines 为空', () => {
    expect(BUILTIN_MUSIC_TRACKS.length).toBeGreaterThan(0);
    const effects = BUILTIN_MUSIC_TRACKS.filter((track) => track.category === 'effects');
    expect(effects.some((track) => track.id === 'builtin:effects:default-tile')).toBe(true);
    for (const category of ['bgm_main', 'bgm_game', 'bgm_richi'] as const) {
      expect(BUILTIN_MUSIC_TRACKS.some((track) => track.category === category)).toBe(true);
    }
    expect(BUILTIN_MUSIC_TRACKS.some((track) => track.category === 'voice_lines')).toBe(false);
    expect(BUILTIN_MUSIC_TRACKS.every((track) => track.sourceType === 'builtin' && track.url)).toBe(true);
  });

  it('effects 子目录递归识别 draw/discard/meld 分组', () => {
    const tracks = createMusicRegistry({
      '/src/music/effects/draw/a.wav': '/assets/a.wav',
      '/src/music/effects/draw/b.wav': '/assets/b.wav',
      '/src/music/effects/discard/c.wav': '/assets/c.wav',
      '/src/music/effects/meld/d.wav': '/assets/d.wav',
      '/src/music/effects/default-tile.wav': '/assets/default-tile.wav',
    });
    const byId = (id: string) => tracks.find((track) => track.id === id);
    expect(byId('builtin:effects:a')?.gameSfxGroup).toBe('draw');
    expect(byId('builtin:effects:b')?.gameSfxGroup).toBe('draw');
    expect(byId('builtin:effects:c')?.gameSfxGroup).toBe('discard');
    expect(byId('builtin:effects:d')?.gameSfxGroup).toBe('meld');
    expect(byId('builtin:effects:default-tile')?.gameSfxGroup).toBeUndefined();
    expect(gameSfxGroupFromModulePath('/src/music/effects/draw/a.wav')).toBe('draw');
    expect(gameSfxGroupFromModulePath('/src/music/effects/other/a.wav')).toBeNull();
  });

  it('真实 effects registry 三组均有内置曲目', () => {
    const grouped = (group: string) => BUILTIN_MUSIC_TRACKS
      .filter((track) => track.category === 'effects' && track.gameSfxGroup === group);
    expect(grouped('draw').length).toBeGreaterThan(0);
    expect(grouped('discard').length).toBeGreaterThan(0);
    expect(grouped('meld').length).toBeGreaterThan(0);
  });

  it('GameSfxGroup 映射：draw→draw、discard→discard、chi/pon/kan→meld', () => {
    expect(GAME_SFX_GROUP_BY_ACTION).toEqual({
      draw: 'draw',
      discard: 'discard',
      chi: 'meld',
      pon: 'meld',
      kan: 'meld',
    });
  });

  it('Game SFX 映射：draw/discard/chi/pon/kan 全部指向默认音效 track', () => {
    const ids = Object.values(GAME_SFX_TO_TRACK);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(1);
    expect(BUILTIN_MUSIC_TRACKS.some((track) => track.id === GAME_SFX_TO_TRACK.discard)).toBe(true);
  });

  it('文件名校验函数保持轻量格式化', () => {
    expect(musicDisplayNameFromFileName('menu_theme_01')).toBe('menu theme 01');
  });
});
