import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from '../audio/audioSettings';
import type { MusicLibraryUi } from '../audio/musicLibrary';
import type { MusicTrackDefinition } from '../audio/musicTypes';
import { AudioSettingsDialog } from './AudioSettingsDialog';

const trackA: MusicTrackDefinition = {
  id: 'builtin:bgm_main:track-a',
  name: '背景音乐 A',
  category: 'bgm_main',
  sourceType: 'builtin',
  url: '/assets/a.wav',
};

const trackB: MusicTrackDefinition = {
  id: 'builtin:bgm_main:track-b',
  name: '背景音乐 B',
  category: 'bgm_main',
  sourceType: 'builtin',
  url: '/assets/b.wav',
};

const linkedTrack: MusicTrackDefinition = {
  id: 'user-linked-a',
  name: '外部曲目 A',
  category: 'bgm_main',
  sourceType: 'linked',
};

const linkedPromptTrack: MusicTrackDefinition = {
  id: 'user-linked-b',
  name: '外部曲目 B',
  category: 'bgm_main',
  sourceType: 'linked',
};

const linkedMissingTrack: MusicTrackDefinition = {
  id: 'user-linked-c',
  name: '外部曲目 C',
  category: 'bgm_main',
  sourceType: 'linked',
};

const copiedTrack: MusicTrackDefinition = {
  id: 'user-copied-a',
  name: '副本曲目',
  category: 'bgm_main',
  sourceType: 'copied',
};

function fixtureLibrary(): MusicLibraryUi {
  return {
    initialized: true,
    tracks: (category) => category === 'bgm_main' ? [trackA, trackB] : [],
    tracksBySfxGroup: () => [],
    playbackMode: () => 'sequential',
    sfxPlaybackMode: () => 'sequential',
    lastSelectedTrackId: (category) => category === 'bgm_main' ? trackB.id : null,
    sfxLastSelectedTrackId: () => null,
    linkedStatus: () => null,
  };
}

function renderDialog(overrides: Partial<Parameters<typeof AudioSettingsDialog>[0]> = {}) {
  return renderToStaticMarkup(
    <AudioSettingsDialog
      settings={DEFAULT_AUDIO_SETTINGS}
      onChange={() => undefined}
      onClose={() => undefined}
      library={fixtureLibrary()}
      playback={{
        source: null,
        trackId: null,
        trackName: null,
        category: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        playbackMode: undefined,
      }}
      previewTrackId={null}
      notice={null}
      onAddLinked={() => undefined}
      onAddCopied={() => undefined}
      onRemoveTrack={() => undefined}
      onReauthorize={() => undefined}
      onRelink={() => undefined}
      onReorder={() => undefined}
      onReorderSfxGroup={() => undefined}
      onSfxPlaybackModeChange={() => undefined}
      onPlaybackModeChange={() => undefined}
      onPreview={() => undefined}
      onStopPreview={() => undefined}
      onTogglePlayback={() => undefined}
      onSeekPlayback={() => undefined}
      onPreviousTrack={() => undefined}
      onNextTrack={() => undefined}
      onManageVoicePack={() => undefined}
      onCreateVoicePack={() => undefined}
      {...overrides}
    />,
  );
}

describe('AudioSettingsDialog', () => {
  it('显示紧凑总音量行、6 个 slider、6 个独立开关与 5 个区域', () => {
    const html = renderDialog();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('音频设置');
    expect(html.match(/type="range"/g)).toHaveLength(7);
    expect(html).toContain('aria-label="播放进度"');
    for (const label of ['总音量', '背景音乐音量', '游戏音乐音量', '立直音乐音量', '游戏音效音量', '语音音量']) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    for (const label of ['总音量开关', '背景音乐开关', '游戏音乐开关', '立直音乐开关', '游戏音效开关', '语音开关']) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    for (const title of ['背景音乐', '游戏音乐', '立直音乐', '游戏音效', '语音']) {
      expect(html).toContain(`>${title}</legend>`);
    }
    expect(html).toContain('修改即时生效');
    expect(html).toContain('audio-volume--master');
  });

  it('关闭总音量时仍保留滑条百分比，不会在重新开启时恢复为默认 80%', () => {
    const html = renderDialog({ settings: { ...DEFAULT_AUDIO_SETTINGS, masterVolume: 0.23, masterEnabled: false } });
    expect(html).toContain('aria-label="总音量开关"');
    expect(html).toContain('value="23"');
    expect(html).toContain('>23%</output>');
  });

  it('曲目列表提供试听、拖动排序与删除按钮，空分类显示暂无音乐', () => {
    const html = renderDialog();
    expect(html).toContain('aria-label="试听 背景音乐 A"');
    expect(html).toContain('aria-label="试听 背景音乐 B"');
    expect(html).toContain('aria-label="拖动排序 背景音乐 A"');
    expect(html).toContain('aria-label="隐藏 背景音乐 A"');
    expect(html).toContain('暂无音乐');
  });

  it('顶部显示外部音乐引用提示', () => {
    const html = renderDialog();
    expect(html).toContain('外部音乐默认引用原文件');
    expect(html).toContain('复制到游戏音乐库');
  });

  it('linked/copied 来源显示状态：外部文件/重新授权/重新选择/游戏库副本', () => {
    const sourceLibrary: MusicLibraryUi = {
      initialized: true,
      tracks: (category) => category === 'bgm_main'
        ? [linkedTrack, linkedPromptTrack, linkedMissingTrack, copiedTrack]
        : [],
      tracksBySfxGroup: () => [],
      playbackMode: () => 'sequential',
      sfxPlaybackMode: () => 'sequential',
      lastSelectedTrackId: () => null,
      sfxLastSelectedTrackId: () => null,
      linkedStatus: (id) => id === linkedTrack.id
        ? 'available'
        : id === linkedPromptTrack.id
          ? 'needs-permission'
          : 'unavailable',
    };
    const html = renderDialog({ library: sourceLibrary });
    expect(html).toContain('外部文件');
    expect(html).toContain('>重新授权</button>');
    expect(html).toContain('>重新选择</button>');
    expect(html).toContain('游戏库副本');
  });

  it('四个可管理区域各提供复制到游戏音乐库按钮', () => {
    const html = renderDialog();
    for (const title of ['背景音乐', '游戏音乐', '立直音乐']) {
      expect(html).toContain(`aria-label="复制到游戏音乐库（${title}）"`);
    }
    for (const group of ['摸牌音效', '弃牌音效', '鸣牌音效']) {
      expect(html).toContain(`aria-label="复制到游戏音乐库（${group}）"`);
    }
  });

  it('游戏音效卡片内部分为摸牌/弃牌/鸣牌三组', () => {
    const html = renderDialog();
    for (const group of ['摸牌音效', '弃牌音效', '鸣牌音效']) {
      expect(html).toContain(`>${group}</h4>`);
    }
    expect(html).toContain('aria-label="游戏音效开关"');
    expect(html).toContain('aria-label="游戏音效音量"');
  });

  it('四个可管理区域各提供添加按钮与三种互斥播放模式', () => {
    const html = renderDialog();
    for (const title of ['背景音乐', '游戏音乐', '立直音乐']) {
      expect(html).toContain(`aria-label="添加${title}"`);
      expect(html).toContain(`name="music-mode-${title === '背景音乐' ? 'bgm_main' : title === '游戏音乐' ? 'bgm_game' : 'bgm_richi'}"`);
    }
    for (const group of ['摸牌音效', '弃牌音效', '鸣牌音效']) {
      expect(html).toContain(`aria-label="添加${group}"`);
    }
    for (const group of ['draw', 'discard', 'meld']) {
      expect(html).toContain(`name="music-mode-sfx-${group}"`);
    }
    expect(html.match(/type="radio"/g)).toHaveLength(18);
    expect(html).toContain('随机播放');
    expect(html).toContain('循环播放');
    expect(html).not.toContain('顺序播放');
    expect(html).toContain('单曲循环');
  });

  it('顶部播放器显示当前曲目与时间，无音乐时显示无并禁用传输', () => {
    const withPreview = renderDialog({
      playback: {
        source: 'temporary',
        trackId: trackA.id,
        trackName: '背景音乐 A',
        category: 'bgm_main',
        isPlaying: true,
        currentTime: 83,
        duration: 228,
        playbackMode: 'sequential',
      },
    });
    expect(withPreview).toContain('当前播放：<strong>背景音乐 A</strong>');
    expect(withPreview).toContain('01:23');
    expect(withPreview).toContain('03:48');
    expect(withPreview).toContain('aria-label="播放进度"');
    expect(withPreview).toContain('aria-label="暂停"');
    const empty = renderDialog();
    expect(empty).toContain('当前播放：<strong>无</strong>');
    expect(empty).toContain('aria-label="播放"');
    expect(empty).toContain('disabled=""');
  });

  it('进度无效时长时禁用进度条，时间显示占位', () => {
    const html = renderDialog({
      playback: {
        source: 'runtime',
        trackId: trackA.id,
        trackName: '背景音乐 A',
        category: 'bgm_main',
        isPlaying: false,
        currentTime: 5,
        duration: Number.NaN,
        playbackMode: 'sequential',
      },
    });
    expect(html).toContain('--:--');
    expect(html).toContain('aria-label="播放进度"');
  });

  it('播放器提供上一首/暂停/播放/下一首按钮', () => {
    const html = renderDialog({
      playback: {
        source: 'runtime',
        trackId: trackA.id,
        trackName: '背景音乐 A',
        category: 'bgm_main',
        isPlaying: false,
        currentTime: 10,
        duration: 100,
        playbackMode: 'sequential',
      },
    });
    expect(html).toContain('aria-label="上一首"');
    expect(html).toContain('aria-label="播放"');
    expect(html).toContain('aria-label="下一首"');
  });

  it('正在试听的曲目显示停止按钮 ■，其他曲目仍为试听 ▶', () => {
    const html = renderDialog({ previewTrackId: trackA.id });
    expect(html).toContain('aria-label="停止试听 背景音乐 A"');
    expect(html).toContain('>■</button>');
    expect(html).toContain('aria-label="试听 背景音乐 B"');
    expect(html).toContain('>▶</button>');
  });

  it('repeat-one 模式给最近播放曲目浅蓝高亮，非该模式不高亮', () => {
    const repeatLibrary: MusicLibraryUi = {
      initialized: true,
      tracks: (category) => category === 'bgm_main' ? [trackA, trackB] : [],
      tracksBySfxGroup: () => [],
      playbackMode: (category) => category === 'bgm_main' ? 'repeat-one' : 'sequential',
      sfxPlaybackMode: () => 'sequential',
      lastSelectedTrackId: (category) => category === 'bgm_main' ? trackB.id : null,
      sfxLastSelectedTrackId: () => null,
      linkedStatus: () => null,
    };
    const html = renderDialog({ library: repeatLibrary });
    expect((html.match(/music-track--repeat-one/g) ?? [])).toHaveLength(1);
    const rowB = html.match(/<li class="music-track(?: music-track--dragging)? music-track--repeat-one">[\s\S]*?背景音乐 B/);
    expect(rowB).not.toBeNull();
    expect(renderDialog().match(/music-track--repeat-one/g)).toBeNull();
  });

  it('语音区域显示自动发现的角色，并提供管理入口', () => {
    const html = renderDialog();
    expect(html).toContain('aria-label="语音开关"');
    expect(html).toContain('角色语音');
    expect(html).toContain('校长');
    expect(html).toContain('aria-label="管理 校长 语音"');
    expect(html).toContain('＋ 创建新角色');
  });

  it('牌桌角色语音根据当前模式显示对应数量的座位选择器', () => {
    const html = renderDialog({ voicePlayerCount: 3 });
    expect(html).toContain('牌桌角色语音');
    expect(html).toContain('aria-label="玩家 1 语音"');
    expect(html).toContain('aria-label="玩家 2 语音"');
    expect(html).toContain('aria-label="玩家 3 语音"');
    expect(html).not.toContain('aria-label="玩家 4 语音"');
  });

  it('文件选择器只接受 MP3 / WAV', () => {
    const html = renderDialog();
    expect(html).toContain('accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"');
    expect(html).toContain('type="file"');
  });

  it('导入结果提示与预览状态可显示', () => {
    const html = renderDialog({
      notice: '已导入 2 首音乐。',
      previewTrackId: trackA.id,
    });
    expect(html).toContain('已导入 2 首音乐。');
    expect(html).toContain('aria-pressed="true"');
  });

  it('关闭回调保持独立，不需要保存按钮', () => {
    const onClose = vi.fn();
    const html = renderDialog({ onClose });
    expect(html).toContain('>关闭</button>');
    expect(html).not.toContain('保存设置');
    onClose();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
