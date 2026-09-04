import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useAppearanceAssetSource } from '../../presentation/appearance/appearanceAssetResolver';
import { useAppearanceLibraryEntries, type AppearanceLibraryEntry, type AppearanceLibraryScope } from '../../presentation/appearance/appearanceAssetCatalog';
import { addAppearanceLibraryImage, deleteAppearanceLibraryAsset } from '../../presentation/appearance/appearanceLibrary';
import type { AppearanceAssetRef } from '../../presentation/appearance/appearanceSettings';
import { collectPlayerSlotAppearanceAssetIds, playerSlotAppearanceStore } from '../../presentation/appearance/playerSlotAppearance';
import { ImagePickerCropDialog } from './ImagePickerCropDialog';

function sameRef(a: AppearanceAssetRef | null, b: AppearanceAssetRef) {
  if (!a) return false;
  return a.kind === 'local' ? b.kind === 'local' && a.assetId === b.assetId : b.kind === 'builtin' && a.id === b.id;
}

function LibraryThumbnail({ assetId }: { assetId: string }) {
  const reference = useMemo(() => ({ kind: 'local' as const, assetId }), [assetId]);
  const source = useAppearanceAssetSource(reference, '');
  const [failedSource, setFailedSource] = useState('');
  return source && source !== failedSource
    ? <img src={source} alt="" draggable={false} onError={() => setFailedSource(source)} />
    : <span>图片不可用</span>;
}

export interface AppearanceLibraryGridProps {
  entries: readonly AppearanceLibraryEntry[];
  selected: AppearanceAssetRef | null;
  onInherit?: () => void;
  defaultRef: AppearanceAssetRef;
  defaultPreview: ReactNode;
  label: string;
  aspectRatio: number;
  onSelect: (ref: AppearanceAssetRef) => void;
  onDelete: (entry: AppearanceLibraryEntry) => void;
  disabled?: boolean;
}

/** Builtins are virtual locked cards; custom thumbnails lease the saved crop. */
export function AppearanceLibraryGrid({ entries, selected, onInherit, defaultRef, defaultPreview, label, aspectRatio, onSelect, onDelete, disabled }: AppearanceLibraryGridProps) {
  return <div className="appearance-library-grid" style={{ '--library-aspect': aspectRatio } as CSSProperties} aria-label={`${label}图库`}>
    {onInherit ? <article className="appearance-library-card"><button type="button" aria-label={`${label}跟随全局`} aria-pressed={selected === null} disabled={disabled} onClick={onInherit}>
      <span className="appearance-library-thumbnail">跟随全局</span><span>跟随全局</span>
    </button></article> : null}
    <article className="appearance-library-card" data-library-default>
      <button type="button" aria-label={`选择${label}：默认`} aria-pressed={sameRef(selected, defaultRef)} disabled={disabled} onClick={() => onSelect(defaultRef)}>
        <span className="appearance-library-thumbnail">{defaultPreview}</span><span>默认{label}</span>
      </button>
    </article>
    {entries.map((entry, index) => {
      const ref: AppearanceAssetRef = { kind: 'local', assetId: entry.assetId };
      return <article key={entry.assetId} className="appearance-library-card" data-library-asset-id={entry.assetId}>
        <button type="button" aria-label={`选择${label}：自定义 ${index + 1}`} aria-pressed={sameRef(selected, ref)} disabled={disabled} onClick={() => onSelect(ref)}>
          <span className="appearance-library-thumbnail"><LibraryThumbnail assetId={entry.assetId} /></span><span>自定义 {index + 1}</span>
        </button>
        <button type="button" className="appearance-library-delete" aria-label={`删除${label}：自定义 ${index + 1}`} disabled={disabled} onClick={() => onDelete(entry)}>删除</button>
      </article>;
    })}
  </div>;
}

type ImageLibraryProps = Omit<AppearanceLibraryGridProps, 'entries' | 'onDelete' | 'disabled'> & {
  scope: AppearanceLibraryScope;
  onDeleteAsset?: (assetId: string) => Promise<void>;
  addLabel?: string;
  previewGuide?: 'main-view-felt';
};

export function AppearanceImageLibrary({ scope, onDeleteAsset, addLabel = '添加图片', previewGuide, ...grid }: ImageLibraryProps) {
  const entries = useAppearanceLibraryEntries(scope);
  const [cropOpen, setCropOpen] = useState(false);
  const [confirming, setConfirming] = useState<AppearanceLibraryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (blob: Blob) => {
    const entry = await addAppearanceLibraryImage(blob, scope);
    grid.onSelect({ kind: 'local', assetId: entry.assetId });
    setError(null);
  };
  const remove = async (entry: AppearanceLibraryEntry) => {
    setBusy(true);
    setError(null);
    try {
      if (onDeleteAsset) await onDeleteAsset(entry.assetId);
      else await deleteAppearanceLibraryAsset(entry.assetId, () => {
        if (grid.selected?.kind === 'local' && grid.selected.assetId === entry.assetId) {
          if (grid.onInherit) grid.onInherit(); else grid.onSelect(grid.defaultRef);
        }
      });
      setConfirming(null);
    } catch { setError('删除失败，图片已保留，请检查本机存储后重试。'); }
    finally { setBusy(false); }
  };
  return <section className="appearance-image-library">
    <AppearanceLibraryGrid {...grid} entries={entries} disabled={busy || confirming !== null} onDelete={(entry) => {
      if (scope.kind === 'avatar' || (grid.selected?.kind === 'local' && grid.selected.assetId === entry.assetId)
        || collectPlayerSlotAppearanceAssetIds(playerSlotAppearanceStore.getSnapshot()).has(entry.assetId)) setConfirming(entry);
      else void remove(entry);
    }} />
    <button type="button" onClick={() => setCropOpen(true)} disabled={busy || confirming !== null}>{addLabel}</button>
    {confirming ? <div className="appearance-library-confirm" role="alertdialog" aria-label="删除正在使用的图片">
      <p>{scope.kind === 'tileFace' ? '删除后，该牌恢复默认牌面，其他牌不受影响。' : scope.kind === 'avatar' ? '删除后，所有使用该图片的玩家将恢复默认头像。' : `删除后，全局选择恢复默认，所有使用该图片的玩家将恢复跟随全局。`}</p>
      <button type="button" disabled={busy} onClick={() => setConfirming(null)}>取消删除</button>
      <button type="button" disabled={busy} onClick={() => void remove(confirming)}>确认删除</button>
    </div> : null}
    {error ? <p role="alert">{error}</p> : null}
    <ImagePickerCropDialog open={cropOpen} title={`添加${grid.label}`} aspectRatio={grid.aspectRatio} previewGuide={previewGuide} preserveAlpha={scope.kind === 'tileFace'} onConfirm={save} onClose={() => setCropOpen(false)} />
  </section>;
}
