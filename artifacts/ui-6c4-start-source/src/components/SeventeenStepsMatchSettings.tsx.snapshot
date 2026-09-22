import { AI_DIFFICULTY_OPTIONS, AI_PERSONALITY_OPTIONS } from './MatchSettings';
import { RuleHelpTooltip } from './RuleHelpTooltip';
import type { RuleDescriptionKey } from '../game/rules/ruleDescriptions';
import {
  normalizeSeventeenStepsMatchConfig,
  type SeventeenStepsMatchConfig,
  type SeventeenStepsCycleCount,
} from '../game/seventeenSteps';

interface SeventeenStepsMatchSettingsProps {
  config: SeventeenStepsMatchConfig;
  onBack: () => void;
  onConfigChange: (config: SeventeenStepsMatchConfig) => void;
  onStart: () => void;
}

export function SeventeenStepsMatchSettings({ config, onBack, onConfigChange, onStart }: SeventeenStepsMatchSettingsProps) {
  const setConfig = (patch: Partial<SeventeenStepsMatchConfig>) => onConfigChange(normalizeSeventeenStepsMatchConfig({ ...config, ...patch }));
  const setRound = (patch: Partial<SeventeenStepsMatchConfig['roundRuleConfig']>) => setConfig({ roundRuleConfig: { ...config.roundRuleConfig, ...patch } });
  const setDisplay = (patch: Partial<SeventeenStepsMatchConfig['displayOptions']>) => setConfig({ displayOptions: { ...config.displayOptions, ...patch } });

  return (
    <main className="menu-page">
      <section className="menu-panel menu-panel--wide seventeen-steps-settings" aria-label="17步麻将比赛设置">
        <p className="menu-path">本地模式 ＞ 立直麻将 ＞ 娱乐模式 ＞ 17步麻将</p>
        <h1>17步麻将比赛设置</h1>

        <section className="settings-block">
          <h2>AI 对手</h2>
          <p className="ai-settings-note">当前仅保存 AI 配置；17步 AI 暂未根据难度和性格改变策略。</p>
          <div className="ai-setting-row">
            <strong>AI 对手</strong>
            <label className="settings-field">
              <span>难度</span>
              <select aria-label="AI 对手难度" value={config.aiDifficulty} onChange={(event) => setConfig({ aiDifficulty: event.target.value })}>
                {AI_DIFFICULTY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="settings-field">
              <span>性格</span>
              <select aria-label="AI 对手性格" value={config.aiPersonality} onChange={(event) => setConfig({ aiPersonality: event.target.value })}>
                {AI_PERSONALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="settings-block">
          <h2>比赛设置</h2>
          <div className="settings-grid settings-grid--four">
            <label className="settings-field">
              <span>起始点数 <RuleHelpTooltip rule="startingPoints" /></span>
              <input type="number" min={1000} step={1000} value={config.startingPoints} onChange={(event) => setConfig({ startingPoints: Number(event.target.value) })} />
            </label>
            <label className="settings-field">
              <span>比赛长度 <RuleHelpTooltip description="1个场包含2局，双方各坐庄一次；每完成一场，场风从东向南、西、北推进。" /></span>
              <select aria-label="比赛长度" value={config.cycleCount} onChange={(event) => setConfig({ cycleCount: Number(event.target.value) as SeventeenStepsCycleCount })}>
                <option value={1}>1场（2局）</option>
                <option value={2}>2场（4局）</option>
                <option value={3}>3场（6局）</option>
                <option value={4}>4场（8局）</option>
              </select>
            </label>
          </div>
          
        </section>

        <section className="settings-block">
          <h2>17步和牌规则</h2>
          <div className="settings-grid settings-grid--four">
            <label className="settings-field">
              <span>番缚规则 <RuleHelpTooltip rule="minimumHan" /></span>
              <select aria-label="番缚规则" value={config.hanRestriction} onChange={(event) => setConfig({ hanRestriction: Number(event.target.value) as SeventeenStepsMatchConfig['hanRestriction'] })}>
                <option value={0}>无</option>
                <option value={2}>2番缚</option>
                <option value={3}>3番缚</option>
                <option value={4}>4番缚</option>
                <option value={5}>满贯缚</option>
              </select>
            </label>
            <CheckField label="宝牌计入番缚判定" rule="doraCountsTowardMinimumHan" checked={config.countDoraForHanRestriction} onChange={(checked) => setConfig({ countDoraForHanRestriction: checked })} />
          </div>
        </section>

        <section className="settings-block">
          <h2>单局规则</h2>
          <div className="settings-check-grid settings-check-grid--round">
            <CheckField label="击飞结束" rule="bankruptcyEndsMatch" checked={config.bankruptcyEndsMatch} onChange={(checked) => setConfig({ bankruptcyEndsMatch: checked })} />
            <CheckField label="赤宝牌" rule="akaDora" checked={config.roundRuleConfig.akaDora !== false} onChange={(checked) => setRound({ akaDora: checked })} />
            <CheckField label="双倍役满" rule="allowDoubleYakuman" checked={config.roundRuleConfig.allowDoubleYakuman !== false} onChange={(checked) => setRound({ allowDoubleYakuman: checked })} />
            <CheckField label="多倍役满" rule="multipleYakuman" checked={config.roundRuleConfig.multipleYakuman !== false} onChange={(checked) => setRound({ multipleYakuman: checked })} />
            <CheckField label="古役" rule="allowAncientYaku" checked={config.roundRuleConfig.allowAncientYaku === true} onChange={(checked) => setRound({ allowAncientYaku: checked })} />
            <CheckField label="切上满贯" rule="kiriageMangan" checked={config.roundRuleConfig.kiriageMangan === true} onChange={(checked) => setRound({ kiriageMangan: checked })} />
            <CheckField label="连风雀符" rule="doubleWindPairFu" checked={config.roundRuleConfig.doubleWindPairFu !== false} onChange={(checked) => setRound({ doubleWindPairFu: checked })} />
          </div>
        </section>

        <section className="settings-block">
          <h2>辅助显示</h2>
          <div className="settings-check-grid">
            <CheckField label="宝牌闪光效果" checked={config.displayOptions.doraGlowEnabled} onChange={(checked) => setDisplay({ doraGlowEnabled: checked })} />
            <CheckField label="悬停显示相同牌" checked={config.displayOptions.sameTileHoverEnabled} onChange={(checked) => setDisplay({ sameTileHoverEnabled: checked })} />
          </div>
        </section>

        <div className="settings-footer">
          <button type="button" onClick={onBack}>返回</button>
          <button type="button" onClick={onStart}>开始游戏</button>
        </div>
      </section>
    </main>
  );
}

function CheckField({ label, rule, checked, onChange }: { label: string; rule?: RuleDescriptionKey; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="settings-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
      {rule ? <RuleHelpTooltip rule={rule} /> : null}
    </label>
  );
}
