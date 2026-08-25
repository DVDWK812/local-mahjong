import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VoicePackDeleteDialog, VoicePackSettings } from './VoicePackSettings';

describe('VoicePackSettings', () => {
  it('角色卡仅展示信息，不会成为默认角色选择按钮；管理与删除仍保留', () => {
    const html = renderToStaticMarkup(<VoicePackSettings selectedVoicePackId="xiaozhang" onSelect={() => undefined} onManage={() => undefined} onCreate={() => undefined} voicePackBySeat={[null, null, null, null]} playerCount={4} onSeatAssignmentChange={() => undefined} />);
    expect(html).toContain('校长');
    expect(html).toContain('voice-pack-settings__configuration');
    expect(html).toContain('voice-pack-settings__catalog');
    expect(html).toContain('voice-pack-settings__list');
    expect(html).toContain('voice-pack-card__info');
    expect(html).not.toContain('voice-pack-card__select');
    expect(html).not.toContain('voice-pack-card--selected');
    expect(html).not.toContain('aria-pressed=');
    expect(html).toContain('管理 &gt;');
    expect(html).toContain('＋ 创建新角色');
    expect(html).toContain('145 条语音');
    expect(html).toContain('aria-label="删除 校长 语音"');
    expect(html).toContain('title="内置角色无法删除"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('搜索语音');
  });

  it('牌桌角色语音下拉框仍是唯一的座位分配入口', () => {
    const twoPlayers = renderToStaticMarkup(<VoicePackSettings selectedVoicePackId="xiaozhang" onSelect={() => undefined} onManage={() => undefined} onCreate={() => undefined} voicePackBySeat={['xiaozhang', null, 'robot', 'master']} playerCount={2} onSeatAssignmentChange={() => undefined} />);
    expect(twoPlayers).toContain('牌桌角色语音');
    expect(twoPlayers).toContain('aria-label="玩家 1 语音"');
    expect(twoPlayers).toContain('aria-label="玩家 2 语音"');
    expect(twoPlayers).not.toContain('aria-label="玩家 3 语音"');
    expect(twoPlayers).not.toContain('aria-label="玩家 4 语音"');

    const fourPlayers = renderToStaticMarkup(<VoicePackSettings selectedVoicePackId="xiaozhang" onSelect={() => undefined} onManage={() => undefined} onCreate={() => undefined} voicePackBySeat={['xiaozhang', null, null, null]} playerCount={4} onSeatAssignmentChange={() => undefined} />);
    for (const seat of [1, 2, 3, 4]) expect(fourPlayers).toContain(`aria-label="玩家 ${seat} 语音"`);
    expect(fourPlayers).toContain('value="__no_voice__">无</option>');
  });

  it('左栏可承载语音控制，右栏只承载角色列表，不改变座位分配数据', () => {
    const html = renderToStaticMarkup(<VoicePackSettings selectedVoicePackId="xiaozhang" onSelect={() => undefined} onManage={() => undefined} onCreate={() => undefined} voicePackBySeat={['xiaozhang', 'xiaozhang', null, null]} playerCount={2} onSeatAssignmentChange={() => undefined} controls={<><label>语音控制</label><label>出牌报牌</label></>} />);
    expect(html).toMatch(/voice-pack-settings__configuration[\s\S]*语音控制[\s\S]*出牌报牌[\s\S]*牌桌角色语音/);
    expect(html).toMatch(/voice-pack-settings__catalog[\s\S]*<h4[^>]*>角色语音<\/h4>[\s\S]*voice-pack-settings__list/);
    expect(html).toContain('aria-label="玩家 1 语音"');
    expect(html).toContain('aria-label="玩家 2 语音"');
  });

  it('用户角色删除确认使用两步 Modal，并明确列出不可恢复的本地资源', () => {
    const pack = { id: 'mambo-001', name: '曼波', locale: 'ja-JP', path: 'mambo-001', lineCount: 114 };
    const warning = renderToStaticMarkup(<VoicePackDeleteDialog pack={pack} stage="warning" deleting={false} error={null} onCancel={() => undefined} onContinue={() => undefined} onConfirm={() => undefined} />);
    expect(warning).toContain('删除角色？');
    expect(warning).toContain('角色：曼波');
    expect(warning).toContain('voice_lines.csv、manifest.json、缓存与 MP3 音频文件');
    expect(warning).toContain('继续删除');
    const final = renderToStaticMarkup(<VoicePackDeleteDialog pack={pack} stage="confirm" deleting={false} error="删除失败" onCancel={() => undefined} onContinue={() => undefined} onConfirm={() => undefined} />);
    expect(final).toContain('确认删除本地角色');
    expect(final).toContain('删除失败');
  });
});
