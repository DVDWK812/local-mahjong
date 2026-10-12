import { useEffect, useState } from 'react';
import {
  HAND_PACK_IDS,
  HAND_PACKS,
  getHandPack,
  preloadHandPack,
  type HandPackId,
} from '../../hand/handPacks';
import type { AppearanceSettings } from '../../presentation/appearance/appearanceSettings';
import {
  PLAYER_APPEARANCE_SLOTS,
  playerSlotAppearanceStore,
  resolveHandPackForPlayer,
  usePlayerSlotAppearances,
  type AppearancePlayerSlot,
} from '../../presentation/appearance/playerSlotAppearance';

const PACK_LABELS: Readonly<Record<HandPackId, string>> = {
  female: 'Female',
  female_2: 'Female 2',
  male: 'Male',
  cat_orange: 'Orange Cat Paw',
  cat_grey: 'Grey Cat Paw',
  dog: 'Dog Paw',
  gloved: 'Gloved',
  robot: 'Robot',
  cyberpunk: 'Cyberpunk',
  crimson_gold_dragon: '赤金龙爪',
  jade_mechanism: '青白玉机关',
  plush_hand: '玩偶手',
};

export function HandAppearanceSettings({ settings, onChange, onBack }: Readonly<{
  settings: AppearanceSettings;
  onChange: (settings: AppearanceSettings) => void;
  onBack: () => void;
}>) {
  const players = usePlayerSlotAppearances();
  const [error, setError] = useState<string | null>(null);
  const fallbackPreview = (image: HTMLImageElement) => {
    const source = HAND_PACKS.female.poses[HAND_PACKS.female.previewPose].url;
    if (image.getAttribute('src') !== source) image.src = source;
  };

  useEffect(() => {
    // Settings previews are non-critical and may warm every builtin Pack lazily.
    HAND_PACK_IDS.forEach((id) => { void preloadHandPack(id); });
  }, []);

  const selectGlobal = (packId: HandPackId) => {
    void preloadHandPack(packId);
    onChange({ ...settings, handAppearance: { packId } });
    setError(null);
  };
  const selectPlayer = (slot: AppearancePlayerSlot, value: HandPackId) => {
    void preloadHandPack(value);
    try {
      playerSlotAppearanceStore.select(slot, { ...players[slot], handAppearance: value });
      setError(null);
    } catch {
      setError('手部外观未能保存，请检查本机存储后重试。');
    }
  };

  return <section className="appearance-settings-detail hand-appearance-settings">
    <button type="button" className="appearance-settings-back" onClick={onBack}>‹ 返回图像设置</button>
    <div>
      <h3>全局默认手部</h3>
      <p>选择完整的七姿势动画 Pack。各玩家也可以单独选择。</p>
    </div>
    <div className="hand-pack-grid" role="radiogroup" aria-label="全局默认手部">
      {HAND_PACK_IDS.map((id) => {
        const pack = HAND_PACKS[id];
        const selected = settings.handAppearance.packId === id;
        return <button key={id} type="button" role="radio" aria-checked={selected}
          className={`hand-pack-option ${selected ? 'hand-pack-option--selected' : ''}`}
          onClick={() => selectGlobal(id)}>
          <img src={pack.poses[pack.previewPose].url} alt="" draggable={false}
            onError={(event) => fallbackPreview(event.currentTarget)} />
          <span>{PACK_LABELS[id]}</span>
        </button>;
      })}
    </div>
    <fieldset className="hand-player-pack-settings">
      <legend>按玩家选择</legend>
      {PLAYER_APPEARANCE_SLOTS.map((slot) => {
        const selection = players[slot].handAppearance;
        const effectivePack = resolveHandPackForPlayer(slot, players, settings);
        // Legacy `inherit` records remain readable, but the UI now presents their
        // current effective Pack as the concrete selection.
        const displayedSelection = selection === 'inherit' ? effectivePack.id : selection;
        return <label key={slot} className="hand-player-pack-row">
          <span>Player {slot + 1}</span>
          <img src={effectivePack.poses[effectivePack.previewPose].url} alt="" draggable={false}
            onError={(event) => fallbackPreview(event.currentTarget)} />
          <select aria-label={`Player ${slot + 1} 手部`} value={displayedSelection}
            onChange={(event) => selectPlayer(slot, event.target.value as HandPackId)}>
            {HAND_PACK_IDS.map((id) => <option key={id} value={id}>{PACK_LABELS[id]}</option>)}
          </select>
          <small>当前：{getHandPack(displayedSelection).name}</small>
        </label>;
      })}
    </fieldset>
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
