import { useState } from 'react';
import { DEFAULT_APPEARANCE_SETTINGS, type AppearanceSettings } from '../../presentation/appearance/appearanceSettings';
import { playerSlotAppearanceStore, usePlayerSlotAppearances, type AppearancePlayerSlot, type PlayerSlotAppearance } from '../../presentation/appearance/playerSlotAppearance';
import { getTileBackCropAspectRatio, getRiichiStickCropAspectRatio } from '../../presentation3d/appearance/AppearanceResources3D';
import { getTileTextureSource } from '../../presentation3d/tile/tileTextures';
import { DEFAULT_RIICHI_STICK_3D_APPEARANCE } from '../../presentation3d/riichi/riichiStickAppearance';
import { AppearanceImageLibrary } from './AppearanceImageLibrary';

export function PlayerSlotAppearanceSettings({ slot, global = DEFAULT_APPEARANCE_SETTINGS, onDeleteAsset }: {
  slot: AppearancePlayerSlot; global?: AppearanceSettings; onDeleteAsset?: (assetId: string) => Promise<void>;
}) {
  const player = usePlayerSlotAppearances()[slot];
  const [error, setError] = useState<string | null>(null);
  const save = (selection: PlayerSlotAppearance) => {
    try { playerSlotAppearanceStore.select(slot, selection); setError(null); }
    catch { setError('外观设置未能保存，请检查本机存储后重试。'); }
  };
  return <div className="player-slot-appearance-settings">
    <fieldset><legend>牌背</legend>
      <AppearanceImageLibrary scope={{ kind: 'tileBack' }} label="牌背" aspectRatio={getTileBackCropAspectRatio()}
        selected={player.tileBack.texture === 'inherit' ? null : player.tileBack.texture}
        onInherit={() => save({ ...player, tileBack: { ...player.tileBack, texture: 'inherit' } })}
        defaultRef={DEFAULT_APPEARANCE_SETTINGS.tileBack.texture} defaultPreview={<img src={getTileTextureSource('back')} alt="默认牌背" />}
        onSelect={texture => save({ ...player, tileBack: { ...player.tileBack, texture } })} onDeleteAsset={onDeleteAsset} />
      <label className="settings-field"><span>侧方颜色{player.tileBack.sideColor === 'inherit' ? '（跟随全局）' : ''}</span>
        <input type="color" aria-label="牌背侧方颜色" value={player.tileBack.sideColor === 'inherit' ? global.tileBack.sideColor : player.tileBack.sideColor}
          onChange={event => save({ ...player, tileBack: { ...player.tileBack, sideColor: event.target.value } })} />
      </label>
      <button type="button" onClick={() => save({ ...player, tileBack: { ...player.tileBack, sideColor: 'inherit' } })}>侧方颜色跟随全局</button>
      <button type="button" onClick={() => save({ ...player, tileBack: { ...player.tileBack, sideColor: DEFAULT_APPEARANCE_SETTINGS.tileBack.sideColor } })}>恢复默认侧方颜色</button>
    </fieldset>
    <fieldset><legend>立直棒</legend>
      <AppearanceImageLibrary scope={{ kind: 'riichiStick' }} label="立直棒" aspectRatio={getRiichiStickCropAspectRatio()}
        selected={player.riichiStick === 'inherit' ? null : player.riichiStick}
        onInherit={() => save({ ...player, riichiStick: 'inherit' })}
        defaultRef={DEFAULT_APPEARANCE_SETTINGS.riichiStick.asset} defaultPreview={<img src={DEFAULT_RIICHI_STICK_3D_APPEARANCE.textureSource} alt="默认立直棒" />}
        onSelect={riichiStick => save({ ...player, riichiStick })} onDeleteAsset={onDeleteAsset} />
    </fieldset>
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
