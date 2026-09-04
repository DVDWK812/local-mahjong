import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { getTileBackImage } from '../game/tileAssets';
import { useAppearanceAssetSource } from '../presentation/appearance/appearanceAssetResolver';
import { DEFAULT_APPEARANCE_SETTINGS, type AppearanceAssetRef, type AppearanceSettings } from '../presentation/appearance/appearanceSettings';
import { getFeltCropAspectRatio, getRiichiStickCropAspectRatio, getTileBackCropAspectRatio } from '../presentation3d/appearance/AppearanceResources3D';
import { DEFAULT_RIICHI_STICK_3D_APPEARANCE } from '../presentation3d/riichi/riichiStickAppearance';
import { AppearanceImageLibrary } from './settings/AppearanceImageLibrary';
import { TileFaceSettings } from './settings/TileFaceSettings';

const DeleteAssetContext = createContext<((assetId: string) => Promise<void>) | undefined>(undefined);

interface AppearanceSettingsDialogProps {
  settings: AppearanceSettings;
  onChange?: (settings: AppearanceSettings) => void;
  onClose: () => void;
  onDeleteAsset?: (assetId: string) => Promise<void>;
}

const APPEARANCE_SECTIONS = [
  { id: 'tile-faces', title: '牌面设置', description: '每种牌可单独设置图片与侧方颜色' },
  { id: 'tile-back', title: '牌背设置', description: '设置牌背图片与侧方颜色' },
  { id: 'table-felt', title: '桌布设置', description: '设置桌面图像' },
  { id: 'riichi-stick', title: '立直棒设置', description: '设置立直棒图像' },
] as const;
type AppearanceSection = (typeof APPEARANCE_SECTIONS)[number]['id'];

/** Presentation-only settings: images stay in IndexedDB and settings hold only refs. */
export function AppearanceSettingsDialog({ settings, onChange = () => undefined, onClose, onDeleteAsset }: AppearanceSettingsDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const [openedSection, setOpenedSection] = useState<AppearanceSection | null>(null);

  useEffect(() => {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>('[data-appearance-section]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); focused?.focus(); };
  }, [onClose]);

  return (
    <DeleteAssetContext.Provider value={onDeleteAsset}>
    <div className="result-backdrop" role="presentation">
      <section ref={dialogRef} className="result-dialog appearance-settings-dialog appearance-scroll-dialog" role="dialog" aria-modal="true" aria-labelledby="appearance-settings-dialog-title">
        <header className="result-header"><div><h2 id="appearance-settings-dialog-title">图像设置</h2><p>图片仅保存在本机，并即时应用到 3D 牌桌。</p></div></header>
        <div className="appearance-settings-dialog__body appearance-scroll-body">
          {openedSection === null ? <AppearanceSettingsList onOpen={setOpenedSection} /> : null}
          {openedSection === 'tile-back' ? <TileBackSettings settings={settings} onChange={onChange} onBack={() => setOpenedSection(null)} /> : null}
          {openedSection === 'table-felt' ? <TableFeltSettings settings={settings} onChange={onChange} onBack={() => setOpenedSection(null)} /> : null}
          {openedSection === 'riichi-stick' ? <RiichiStickSettings settings={settings} onChange={onChange} onBack={() => setOpenedSection(null)} /> : null}
          {openedSection === 'tile-faces' ? <TileFaceSettings settings={settings} onChange={onChange} onDeleteAsset={onDeleteAsset} onBack={() => setOpenedSection(null)} /> : null}
        </div>
        <footer className="result-actions"><button type="button" onClick={onClose}>关闭</button></footer>
      </section>
    </div>
    </DeleteAssetContext.Provider>
  );
}

function AppearanceSettingsList({ onOpen }: Readonly<{ onOpen: (section: AppearanceSection) => void }>) {
  return <div className="appearance-settings-list">
    {APPEARANCE_SECTIONS.map((section) => <button key={section.id} type="button" data-appearance-section className="appearance-settings-card" onClick={() => onOpen(section.id)}>
      <span><strong>{section.title}</strong><small>{section.description}</small></span><span aria-hidden="true">›</span>
    </button>)}
    <button type="button" className="appearance-settings-card appearance-settings-card--disabled" disabled aria-label="手部设置，暂未开放">
      <span><strong>手部设置</strong><small>暂未开放</small></span><span>暂未开放</span>
    </button>
  </div>;
}

export function TileBackColorSetting({ settings, onChange }: Readonly<{ settings: AppearanceSettings; onChange: (settings: AppearanceSettings) => void }>) {
  const setColor = (sideColor: string) => onChange({ ...settings, tileBack: { ...settings.tileBack, sideColor } });
  return <div className="appearance-settings-color-field">
    <label className="settings-field"><span>侧方颜色</span><input aria-label="牌背侧方颜色" type="color" value={settings.tileBack.sideColor} onChange={(event) => setColor(event.target.value.toLowerCase())} /></label>
    <button type="button" onClick={() => setColor(DEFAULT_APPEARANCE_SETTINGS.tileBack.sideColor)}>恢复默认颜色</button>
  </div>;
}

function TileBackSettings({ settings, onChange, onBack }: Readonly<{ settings: AppearanceSettings; onChange: (settings: AppearanceSettings) => void; onBack: () => void }>) {
  return <AppearanceAssetEditor title="牌背设置" previewTitle="当前牌背预览" reference={settings.tileBack.texture} fallbackSource={getTileBackImage()} aspectRatio={getTileBackCropAspectRatio()} onReferenceChange={(texture) => onChange({ ...settings, tileBack: { ...settings.tileBack, texture } })} onBack={onBack} extra={<TileBackColorSetting settings={settings} onChange={onChange} />} />;
}

function TableFeltSettings({ settings, onChange, onBack }: Readonly<{ settings: AppearanceSettings; onChange: (settings: AppearanceSettings) => void; onBack: () => void }>) {
  return <AppearanceAssetEditor title="桌布设置" previewTitle="当前桌布预览" reference={settings.tableFelt.asset} fallbackSource="" aspectRatio={getFeltCropAspectRatio()} previewGuide="main-view-felt" onReferenceChange={(asset) => onChange({ ...settings, tableFelt: { asset } })} onBack={onBack} previewClassName="appearance-settings-preview--felt" />;
}

function RiichiStickSettings({ settings, onChange, onBack }: Readonly<{ settings: AppearanceSettings; onChange: (settings: AppearanceSettings) => void; onBack: () => void }>) {
  return <AppearanceAssetEditor title="立直棒设置" previewTitle="当前立直棒预览" reference={settings.riichiStick.asset} fallbackSource={DEFAULT_RIICHI_STICK_3D_APPEARANCE.textureSource} aspectRatio={getRiichiStickCropAspectRatio()} onReferenceChange={(asset) => onChange({ ...settings, riichiStick: { asset } })} onBack={onBack} previewClassName="appearance-settings-preview--stick" />;
}

function AppearanceAssetEditor({ title, previewTitle, reference, fallbackSource, aspectRatio, previewGuide, onReferenceChange, onBack, previewClassName = '', extra }: Readonly<{
  title: string;
  previewTitle: string;
  reference: AppearanceAssetRef;
  fallbackSource: string;
  aspectRatio: number;
  previewGuide?: 'main-view-felt';
  onReferenceChange: (reference: AppearanceAssetRef) => void;
  onBack: () => void;
  previewClassName?: string;
  extra?: ReactNode;
}>) {
  const source = useAppearanceAssetSource(reference, fallbackSource);
  const onDeleteAsset = useContext(DeleteAssetContext);
  const kind = title === '桌布设置' ? 'tableFelt' : title === '牌背设置' ? 'tileBack' : 'riichiStick';
  const label = title.replace('设置', '');
  const defaultRef = kind === 'tileBack' ? DEFAULT_APPEARANCE_SETTINGS.tileBack.texture : DEFAULT_APPEARANCE_SETTINGS[kind].asset;
  return <section className="appearance-settings-detail">
    <button type="button" className="appearance-settings-back" onClick={onBack}>‹ 返回图像设置</button>
    <div className="appearance-settings-preview-block"><strong>{previewTitle}</strong><div className={`appearance-settings-preview ${previewClassName}`.trim()} style={{ '--appearance-preview-aspect': aspectRatio } as CSSProperties}>{source ? <img src={source} alt="" draggable={false} /> : <span>经典绿色桌布</span>}</div></div>
    <AppearanceImageLibrary scope={{ kind }} selected={reference} defaultRef={defaultRef} label={label} aspectRatio={aspectRatio} previewGuide={previewGuide}
      defaultPreview={fallbackSource ? <img src={fallbackSource} alt="" /> : <span className="appearance-library-classic-felt">经典绿色</span>}
      onSelect={onReferenceChange} onDeleteAsset={onDeleteAsset} />
    {extra}
  </section>;
}
