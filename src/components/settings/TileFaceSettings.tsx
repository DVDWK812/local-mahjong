import { useState, type CSSProperties } from 'react';
import { getTileTextureSource } from '../../presentation3d/tile/tileTextures';
import { MAHJONG_TILE_FACE } from '../../presentation3d/tile/tileGeometry';
import { DEFAULT_APPEARANCE_SETTINGS, TILE_APPEARANCE_IDS, type AppearanceSettings, type TileAppearanceId } from '../../presentation/appearance/appearanceSettings';
import { useAppearanceAssetSource } from '../../presentation/appearance/appearanceAssetResolver';
import { AppearanceImageLibrary } from './AppearanceImageLibrary';

export const TILE_FACE_CROP_ASPECT = MAHJONG_TILE_FACE.width / MAHJONG_TILE_FACE.depth;
export const TILE_FACE_GROUPS = [
  { label: '万子', keys: [...TILE_APPEARANCE_IDS.filter(key => key.startsWith('m')), 'red5m'] },
  { label: '筒子', keys: [...TILE_APPEARANCE_IDS.filter(key => key.startsWith('p')), 'red5p'] },
  { label: '索子', keys: [...TILE_APPEARANCE_IDS.filter(key => key.startsWith('s')), 'red5s'] },
  { label: '字牌', keys: TILE_APPEARANCE_IDS.filter(key => key.startsWith('z')) },
] as const;
export function tileFaceLabel(key: TileAppearanceId): string {
  if (key.startsWith('red')) return `赤五${{ red5m: '万', red5p: '筒', red5s: '索' }[key as 'red5m']}`;
  if (key.startsWith('z')) return ['东', '南', '西', '北', '白', '发', '中'][Number(key[1]) - 1];
  return `${key[1]}${{ m: '万', p: '筒', s: '索' }[key[0] as 'm']}`;
}

function FacePreview({ tileKey, settings }: { tileKey: TileAppearanceId; settings: AppearanceSettings }) {
  const fallback = getTileTextureSource(tileKey);
  const source = useAppearanceAssetSource(settings.tileFaces[tileKey].face, fallback);
  const [failed, setFailed] = useState('');
  return <span className="tile-face-settings-preview" style={{ borderColor: settings.tileFaces[tileKey].sideColor }}>
    <img src={source === failed ? fallback : source} alt="" onError={() => setFailed(source)} />
    {tileKey.startsWith('red') ? <span className="tile-face-settings-aka" aria-label="赤牌">●</span> : null}
  </span>;
}

export function TileFaceSettings({ settings, onChange, onBack, onDeleteAsset }: {
  settings: AppearanceSettings;
  onChange: (settings: AppearanceSettings) => void;
  onBack: () => void;
  onDeleteAsset?: (id: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<TileAppearanceId | null>(null);
  if (!selected) return <section className="appearance-settings-detail">
    <button type="button" onClick={onBack}>‹ 返回图像设置</button>
    {TILE_FACE_GROUPS.map(group => <section key={group.label}><h3>{group.label}</h3>
      <div className="tile-face-settings-grid">{group.keys.map(key => {
        const tileKey = key as TileAppearanceId;
        return <button type="button" key={key} data-tile-face-key={key} aria-label={`设置${tileFaceLabel(tileKey)}牌面`} onClick={() => setSelected(tileKey)}>
          <FacePreview tileKey={tileKey} settings={settings} /><span>{tileFaceLabel(tileKey)}</span>
          <span className="tile-face-color-chip" style={{ backgroundColor: settings.tileFaces[tileKey].sideColor }} aria-label={`侧方颜色 ${settings.tileFaces[tileKey].sideColor}`} />
        </button>;
      })}</div>
    </section>)}
  </section>;
  const current = settings.tileFaces[selected];
  const update = (value: Partial<typeof current>) => onChange({ ...settings, tileFaces: { ...settings.tileFaces, [selected]: { ...current, ...value } } });
  return <section className="appearance-settings-detail" key={selected}>
    <button type="button" onClick={() => setSelected(null)}>‹ 返回牌面列表</button>
    <strong>当前{tileFaceLabel(selected)}牌面预览</strong>
    <div style={{ '--appearance-preview-aspect': TILE_FACE_CROP_ASPECT } as CSSProperties}><FacePreview tileKey={selected} settings={settings} /></div>
    <AppearanceImageLibrary scope={{ kind: 'tileFace', tileKey: selected }} selected={current.face}
      defaultRef={DEFAULT_APPEARANCE_SETTINGS.tileFaces[selected].face} label={`${tileFaceLabel(selected)}牌面`}
      aspectRatio={TILE_FACE_CROP_ASPECT} defaultPreview={<img src={getTileTextureSource(selected)} alt="" />}
      onSelect={face => update({ face })} onDeleteAsset={onDeleteAsset} />
    <div className="appearance-settings-color-field">
      <label className="settings-field"><span>侧方颜色</span><input type="color" aria-label="牌面侧方颜色" value={current.sideColor} onChange={event => update({ sideColor: event.target.value })} /></label>
      <button type="button" onClick={() => update({ sideColor: DEFAULT_APPEARANCE_SETTINGS.tileFaces[selected].sideColor })}>恢复默认颜色</button>
    </div>
  </section>;
}
