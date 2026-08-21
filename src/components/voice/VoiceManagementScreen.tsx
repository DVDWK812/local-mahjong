import { useEffect, useMemo, useRef, useState } from 'react';
import { VOICE_PACK_REPOSITORY, VoicePackRepository } from '../../audio/voice/VoicePackRepository';
import type { VoiceAvailabilityStatus, VoiceLine, VoicePackDetail } from '../../audio/voice/types';
import { VoicePreviewController } from '../../audio/voice/voicePreview';

interface VoiceManagementScreenProps { readonly packId: string | null; readonly voiceVolume: number; readonly onBack: () => void; readonly repository?: VoicePackRepository; }

/** Standalone, read-only management screen. Future editing actions intentionally do not live here yet. */
export function VoiceManagementScreen({ packId, voiceVolume, onBack, repository = VOICE_PACK_REPOSITORY }: VoiceManagementScreenProps) {
  const detail = packId ? repository.getPack(packId) : undefined;
  if (!detail) return <main className="voice-management-screen" aria-labelledby="voice-management-title"><header className="voice-management-screen__header"><button type="button" onClick={onBack}>← 返回</button><h1 id="voice-management-title">语音管理</h1></header><section className="voice-management-screen__empty" role="status"><h2>当前语音包不可用</h2><p>请返回音频设置后选择一个可用角色。</p></section></main>;
  return <VoiceManagementDetail detail={detail} voiceVolume={voiceVolume} repository={repository} onBack={onBack} />;
}

function VoiceManagementDetail({ detail, voiceVolume, repository, onBack }: { readonly detail: VoicePackDetail; readonly voiceVolume: number; readonly repository: VoicePackRepository; readonly onBack: () => void }) {
  const [query, setQuery] = useState(''); const { playingKey, error, playOrStop } = useVoicePreview(voiceVolume);
  const lines = useMemo(() => filterLines(detail.voiceLines, query), [detail.voiceLines, query]);
  return <main className="voice-management-screen" aria-labelledby="voice-management-title"><header className="voice-management-screen__header"><button type="button" onClick={onBack}>← 返回</button><h1 id="voice-management-title">语音管理</h1></header><section className="voice-management-screen__body"><header className="voice-management-screen__pack-header"><h2>{detail.meta.name}</h2><p>{localeLabel(detail.meta.locale)} · {detail.voiceLines.length} 条语音</p></header><label className="voice-management-screen__search"><span>搜索语音</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="动作、台词或 key" /></label>{error ? <p className="voice-management-screen__error" role="status">{error}</p> : null}<div className="voice-management-screen__table" role="table" aria-label={`${detail.meta.name}语音列表`}><div className="voice-management-screen__row voice-management-screen__row--heading" role="row"><span role="columnheader">动作</span><span role="columnheader">台词</span><span role="columnheader">状态</span><span role="columnheader">试听</span></div><div className="voice-management-screen__rows">{lines.map((line) => {
    const displayLine = repository.getVoiceLine(detail.meta.id, line.key) ?? line; const status = detail.voiceAvailability[line.key]?.status; const audioUrl = repository.getAudioForKey(detail.meta.id, line.key); const playable = status === 'available' && Boolean(audioUrl); const playing = playingKey === line.key;
    return <div key={line.key} className="voice-management-screen__row" role="row"><span role="cell" title={line.key}>{displayAction(displayLine)}</span><span role="cell">{displayLine.line}</span><span role="cell" className={`voice-pack-status voice-pack-status--${status ?? 'not-generated'}`}>{statusLabel(status)}</span><span role="cell"><button type="button" className="voice-management-screen__preview" aria-label={playing ? `停止试听 ${displayLine.line}` : `试听 ${displayLine.line}`} disabled={!playable} onClick={() => audioUrl && playOrStop(line.key, audioUrl)}>{playing ? '■' : '▶'}</button></span></div>;
  })}</div></div></section></main>;
}

function useVoicePreview(volume: number) {
  const [playingKey, setPlayingKey] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const controllerRef = useRef<VoicePreviewController | null>(null);
  if (!controllerRef.current) controllerRef.current = new VoicePreviewController((url) => new Audio(url), (key, nextError) => { setPlayingKey(key); setError(nextError); });
  useEffect(() => () => controllerRef.current?.dispose(), []); useEffect(() => { controllerRef.current?.setVolume(volume); }, [volume]);
  useEffect(() => { if (!error) return undefined; const timer = window.setTimeout(() => setError(null), 2500); return () => window.clearTimeout(timer); }, [error]);
  return { playingKey, error, playOrStop: (key: string, url: string) => controllerRef.current?.playOrStop(key, url, volume) };
}

function filterLines(lines: readonly VoiceLine[], query: string): readonly VoiceLine[] { const normalized = query.trim().toLocaleLowerCase(); return normalized ? lines.filter((line) => [line.key, line.action, line.action_cn, line.line].some((value) => value?.toLocaleLowerCase().includes(normalized))) : lines; }
function displayAction(line: VoiceLine): string { return line.action_cn ?? (/[\u3400-\u9fff]/.test(line.action) ? line.action : line.line); }
function statusLabel(status: VoiceAvailabilityStatus | undefined): string { return status === 'available' ? '✓ 已生成' : status === 'missing-audio' ? '△ 音频缺失' : '○ 未生成'; }
function localeLabel(locale: string): string { return locale.toLowerCase() === 'zh-cn' ? '中文' : locale; }
