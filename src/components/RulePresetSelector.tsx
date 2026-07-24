import type { RulePresetId } from '../game/match/matchRules';

interface RulePresetSelectorProps {
  presetId: RulePresetId;
  onChange: (preset: RulePresetId) => void;
}

export function RulePresetSelector({ presetId, onChange }: RulePresetSelectorProps) {
  return (
    <label className="settings-field">
      <span>规则预设</span>
      <select value={presetId} onChange={(event) => onChange(event.target.value as RulePresetId)}>
        <option value="east-round">东风场</option>
        <option value="south-round">南风场</option>
        <option value="custom">自定义</option>
      </select>
    </label>
  );
}
