import { describe, expect, it } from 'vitest';
import { textControlProfileForModel } from './textControlProfiles';
import { effectiveTtsText, stripTtsControlSyntax, synchronizeFromPlainText, synchronizeFromTtsText } from './ttsTextSynchronization';

describe('ttsTextSynchronization', () => {
  const fish = textControlProfileForModel('fishaudio-s21pro-flash');
  const minimax = textControlProfileForModel('minimax-2.8-hd');

  it('高级 Fish 文本保留完整请求内容，同时同步干净的游戏台词', () => {
    expect(synchronizeFromTtsText('哼[pause]，让你们一把！[embarrassed]', '第四名', fish))
      .toEqual({ line: '哼，让你们一把！', ttsText: '哼[pause]，让你们一把！[embarrassed]' });
  });

  it('普通台词是最后编辑源，并清除旧控制标签', () => {
    expect(synchronizeFromPlainText('这次是我输了。'))
      .toEqual({ line: '这次是我输了。', ttsText: '这次是我输了。' });
  });

  it('清理 MiniMax 标签、停顿和 phoneme markup，不改变正常标点', () => {
    expect(stripTtsControlSyntax('(laughs)好耶！<#0.5#>赢了！', minimax)).toBe('好耶！赢了！');
    expect(stripTtsControlSyntax('发<|phoneme_start|>fa1<|phoneme_end|>！', fish)).toBe('发！');
  });

  it('空 override 继续跟随 line，而非仅因显示 textarea 就写入覆盖', () => {
    expect(effectiveTtsText({ line: '  第四名  ', tts_text: '' })).toBe('第四名');
    expect(synchronizeFromTtsText('', '第四名', fish)).toEqual({ line: '第四名', ttsText: '' });
  });
});
