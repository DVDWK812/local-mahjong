import { useEffect, useMemo, useState } from 'react';
import { LOCAL_VOICE_PACK_SERVICE, type VoicePackService } from '../../audio/voice/VoicePackService';
import { VOICE_PACK_REPOSITORY, VoicePackRepository } from '../../audio/voice/VoicePackRepository';
import type { VoicePackSummary } from '../../audio/voice/types';
import { NO_VOICE_PACK_ID, resolveRuntimeFallbackVoicePackId, type VoiceSeatAssignments } from '../../audio/voice/voicePreferences';

const BUILTIN_PACK_IDS = new Set(['xiaozhang']);

interface VoicePackSettingsProps {
  readonly selectedVoicePackId: string | null;
  readonly onSelect: (packId: string) => void;
  readonly onManage: (packId: string) => void;
  readonly onCreate: () => void;
  readonly voicePackBySeat: VoiceSeatAssignments;
  readonly playerCount: 2 | 3 | 4;
  readonly onSeatAssignmentChange: (seatIndex: number, packId: string | null) => void;
  readonly onDeleted?: (deletedPackId: string, remainingPacks: readonly VoicePackSummary[]) => void;
  readonly repository?: VoicePackRepository;
  readonly service?: Pick<VoicePackService, 'listPacks' | 'getPack' | 'deletePack'>;
}

export interface VoicePackRow extends VoicePackSummary { readonly lineCount: number; }

/** Audio Settings pack overview, seat assignment, and safe local deletion. */
export function VoicePackSettings({ selectedVoicePackId, onSelect, onManage, onCreate, voicePackBySeat, playerCount, onSeatAssignmentChange, onDeleted, repository = VOICE_PACK_REPOSITORY, service = LOCAL_VOICE_PACK_SERVICE }: VoicePackSettingsProps) {
  const initialRows = useMemo(() => repository.listPacks().map((pack) => ({ ...pack, lineCount: repository.getPack(pack.id)?.voiceLines.length ?? 0 })), [repository]);
  const [packs, setPacks] = useState<readonly VoicePackRow[]>(initialRows);
  const [pendingDeletion, setPendingDeletion] = useState<VoicePackRow | null>(null);
  const [deleteStage, setDeleteStage] = useState<'warning' | 'confirm'>('warning');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void refreshPacks();
    return () => { active = false; };
    async function refreshPacks(): Promise<void> {
      try {
        const summaries = await service.listPacks();
        const rows = await Promise.all(summaries.map(async (pack) => {
          try { return { ...pack, lineCount: (await service.getPack(pack.id)).voiceLines.length }; }
          catch { return { ...pack, lineCount: 0 }; }
        }));
        if (active) setPacks(rows);
      } catch { /* Production has no local Bridge; bundled repository rows remain available. */ }
    }
  }, [service]);

  const openDeletion = (pack: VoicePackRow) => { setPendingDeletion(pack); setDeleteStage('warning'); setDeleteError(null); };
  const closeDeletion = () => { if (!deleting) { setPendingDeletion(null); setDeleteError(null); } };
  const deletePack = async () => {
    if (!pendingDeletion || BUILTIN_PACK_IDS.has(pendingDeletion.id)) return;
    setDeleting(true); setDeleteError(null);
    try {
      const result = await service.deletePack(pendingDeletion.id);
      const next = packs.filter((pack) => pack.id !== result.deletedPackId);
      setPacks(next); setPendingDeletion(null);
      if (selectedVoicePackId === result.deletedPackId) {
        const fallback = next.find((pack) => pack.id === 'xiaozhang') ?? next[0];
        if (fallback) onSelect(fallback.id);
      }
      onDeleted?.(result.deletedPackId, next);
    } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : '删除角色失败。'); }
    finally { setDeleting(false); }
  };

  return <section className="voice-pack-settings" aria-labelledby="voice-pack-settings-title"><h4 id="voice-pack-settings-title">角色语音</h4><button type="button" className="voice-pack-settings__create" onClick={onCreate}>＋ 创建新角色</button>{packs.length === 0 ? <p className="voice-pack-settings__empty">暂无可用角色语音包。</p> : <><VoiceSeatAssignmentSettings packs={packs} assignments={voicePackBySeat} playerCount={playerCount} onChange={onSeatAssignmentChange} /><div className="voice-pack-settings__list">{packs.map((pack) => <VoicePackCard key={pack.id} pack={pack} onManage={() => onManage(pack.id)} onDelete={() => openDeletion(pack)} />)}</div></>}{pendingDeletion ? <VoicePackDeleteDialog pack={pendingDeletion} stage={deleteStage} deleting={deleting} error={deleteError} onCancel={closeDeletion} onContinue={() => setDeleteStage('confirm')} onConfirm={() => void deletePack()} /> : null}</section>;
}

export function VoiceSeatAssignmentSettings({ packs, assignments, playerCount, onChange }: {
  readonly packs: readonly VoicePackSummary[];
  readonly assignments: VoiceSeatAssignments;
  readonly playerCount: 2 | 3 | 4;
  readonly onChange: (seatIndex: number, packId: string | null) => void;
}) {
  const fallbackPackId = resolveRuntimeFallbackVoicePackId(packs);
  return <fieldset className="voice-seat-assignments"><legend>牌桌角色语音</legend><p className="voice-seat-assignments__hint">按玩家座位分配角色语音；轮庄不会改变角色。未单独指定时使用内置安全默认角色；选择“无”后该玩家不会播放语音。</p>{Array.from({ length: playerCount }, (_, seatIndex) => {
    const assigned = assignments[seatIndex];
    const value = assigned === NO_VOICE_PACK_ID ? NO_VOICE_PACK_ID : assigned ?? fallbackPackId ?? '';
    return <label className="voice-seat-assignments__row" key={seatIndex}>玩家 {seatIndex + 1}<select aria-label={`玩家 ${seatIndex + 1} 语音`} value={value} onChange={(event) => {
      const next = event.target.value;
      onChange(seatIndex, next === NO_VOICE_PACK_ID ? NO_VOICE_PACK_ID : next === fallbackPackId ? null : next || null);
    }}><option value={NO_VOICE_PACK_ID}>无</option>{packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select></label>;
  })}</fieldset>;
}

function VoicePackCard({ pack, onManage, onDelete }: { readonly pack: VoicePackRow; readonly onManage: () => void; readonly onDelete: () => void }) {
  const builtin = BUILTIN_PACK_IDS.has(pack.id);
  return <div className="voice-pack-card"><div className="voice-pack-card__info"><span className="voice-pack-card__name">{pack.name}</span><span className="voice-pack-card__locale">{localeLabel(pack.locale)} · {pack.lineCount} 条语音</span></div><div className="voice-pack-card__actions"><button type="button" className="voice-pack-card__manage" aria-label={`管理 ${pack.name} 语音`} onClick={onManage}>管理 &gt;</button><button type="button" className="voice-pack-card__delete" aria-label={`删除 ${pack.name} 语音`} title={builtin ? '内置角色无法删除' : `删除 ${pack.name}`} disabled={builtin} onClick={onDelete}>删除</button></div></div>;
}

export function VoicePackDeleteDialog({ pack, stage, deleting, error, onCancel, onContinue, onConfirm }: { readonly pack: VoicePackRow; readonly stage: 'warning' | 'confirm'; readonly deleting: boolean; readonly error: string | null; readonly onCancel: () => void; readonly onContinue: () => void; readonly onConfirm: () => void }) {
  const final = stage === 'confirm';
  return <div className="result-backdrop voice-pack-delete-dialog" role="presentation"><section className="result-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-voice-pack-title"><div className="result-header"><div><h2 id="delete-voice-pack-title">删除角色？</h2><p>即将删除：角色：{pack.name}</p><p>包含 voice_lines.csv、manifest.json、缓存与 MP3 音频文件。删除后无法恢复。</p>{error ? <p className="save-status save-status--error" role="status">{error}</p> : null}</div></div><div className="call-actions"><button type="button" disabled={deleting} onClick={onCancel}>取消</button>{final ? <button type="button" disabled={deleting} onClick={onConfirm}>{deleting ? '删除中…' : '确认删除本地角色'}</button> : <button type="button" disabled={deleting} onClick={onContinue}>继续删除</button>}</div></section></div>;
}

function localeLabel(locale: string): string { return locale.toLowerCase() === 'zh-cn' ? '中文' : locale; }
