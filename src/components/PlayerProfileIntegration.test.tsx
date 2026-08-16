import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import { getRulePreset } from '../game/match/matchRules';
import { DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG } from '../game/seventeenSteps';
import type { PlayerProfile } from '../profile/playerProfile';
import { Board } from './Board';
import { MainMenu } from './MainMenu';
import { MatchSettings } from './MatchSettings';
import { PlayerProfileDialog } from './PlayerProfileDialog';
import { SeventeenStepsMatchSettings } from './SeventeenStepsMatchSettings';
import { SeventeenStepsScreen } from './SeventeenStepsScreen';

const profile: PlayerProfile = { nickname: '🀄玩家', avatarId: 'avatar-04' };
const boardHandlers = {
  onDiscard: () => undefined,
  onTsumo: () => undefined,
  onRon: () => undefined,
  onPassRon: () => undefined,
  onDeclareRiichi: () => undefined,
  onDeclareKyuushuKyuuhai: () => undefined,
  onPon: () => undefined,
  onChi: () => undefined,
  onKan: () => undefined,
  onChankanRon: () => undefined,
  onPassChankan: () => undefined,
  onPassCall: () => undefined,
  onSkipDrawActions: () => undefined,
  onReset: () => undefined,
};

describe('PlayerProfile 表现层接入', () => {
  it('主菜单展示当前玩家，并提供独立玩家设置入口', () => {
    const html = renderToStaticMarkup(
      <MainMenu
        hasSave={false}
        playerProfile={profile}
        onOpenPlayerSettings={() => undefined}
        onContinue={() => undefined}
        onLocalMode={() => undefined}
        onOnlineMode={() => undefined}
        onReplayStudy={() => undefined}
      />,
    );
    expect(html).toContain('当前玩家');
    expect(html).toContain(profile.nickname);
    expect(html).toContain('🦊');
    expect(html).toContain('aria-label="玩家设置"');
    expect(html).toContain('aria-label="音频设置"');
  });

  it('玩家设置弹窗复用昵称和带分类的键盘可操作头像编辑器', () => {
    const html = renderToStaticMarkup(
      <PlayerProfileDialog profile={profile} onChange={() => undefined} onClose={() => undefined} />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="玩家昵称"');
    expect((html.match(/role="tab"/g) ?? [])).toHaveLength(5);
    expect((html.match(/选择头像：/g) ?? [])).toHaveLength(77);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('修改会立即保存');
  });

  it('四人和 17 步比赛设置不再重复展示玩家资料编辑器', () => {
    const matchHtml = renderToStaticMarkup(
      <MatchSettings config={getRulePreset('east-round')} onConfigChange={() => undefined} />,
    );
    const seventeenStepsHtml = renderToStaticMarkup(
      <SeventeenStepsMatchSettings
        config={DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG}
        onBack={() => undefined}
        onConfigChange={() => undefined}
        onStart={() => undefined}
      />,
    );
    expect(matchHtml).not.toContain('玩家资料');
    expect(matchHtml).not.toContain('aria-label="玩家昵称"');
    expect(seventeenStepsHtml).not.toContain('玩家资料');
    expect(seventeenStepsHtml).not.toContain('aria-label="玩家昵称"');
  });

  it('四人模式只覆盖 controlled local player 的展示，不修改核心 GameState 或 AI 名称', () => {
    const state = createInitialGameState();
    const before = JSON.stringify(state);
    const html = renderToStaticMarkup(<Board gameState={state} playerProfile={profile} {...boardHandlers} />);
    expect(html).toContain(profile.nickname);
    expect(html).toContain('🦊');
    expect(html).toContain('Player 2');
    expect(html).toContain('Player 3');
    expect(html).toContain('Player 4');
    expect((html.match(/🦊/g) ?? [])).toHaveLength(1);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('17 步使用同一个 Profile 展示昵称和头像', () => {
    const html = renderToStaticMarkup(
      <SeventeenStepsScreen ruleConfig={getRulePreset('east-round')} playerProfile={profile} onBack={() => undefined} />,
    );
    expect(html).toContain(profile.nickname);
    expect(html).toContain('🦊');
    expect(html).toContain('对手');
  });
});
