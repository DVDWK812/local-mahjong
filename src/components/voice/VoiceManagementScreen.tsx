import { useEffect, useMemo, useRef, useState } from 'react';
import { VoicePackEditingService, hasCustomPronunciation, voiceLineEditorKeyAction } from '../../audio/voice/VoicePackEditingService';
import { VOICE_PACK_REPOSITORY, VoicePackRepository } from '../../audio/voice/VoicePackRepository';
import { generationStatusSummary, getVoicePackGenerationStatuses, type VoiceGenerationStatus } from '../../audio/voice/voiceGenerationStatus';
import type { VoiceLine, VoicePackDetail } from '../../audio/voice/types';
import { VoicePreviewController } from '../../audio/voice/voicePreview';
import { LOCAL_VOICE_GENERATION_SERVICE, type GenerationPlan, type GenerationResult, type VoiceGenerationOverride, type VoiceGenerationService } from '../../audio/voice/VoiceGenerationService';
import { LOCAL_VOICE_PACK_SERVICE, type VoicePackService } from '../../audio/voice/VoicePackService';

interface VoiceManagementScreenProps {
  readonly packId: string | null; readonly voiceVolume: number; readonly onBack: () => void;
  readonly repository?: VoicePackRepository; readonly editingService?: VoicePackEditingService; readonly generationService?: VoiceGenerationService; readonly packService?: Pick<VoicePackService, 'getPack' | 'updateVoiceLines'>;
}

/** Pack text editor. Changes are local editing overrides only; audio generation remains outside this screen. */
export function VoiceManagementScreen({ packId, voiceVolume, onBack, repository = VOICE_PACK_REPOSITORY, editingService, generationService = LOCAL_VOICE_GENERATION_SERVICE, packService = LOCAL_VOICE_PACK_SERVICE }: VoiceManagementScreenProps) {
  const fallbackEditor = useRef<VoicePackEditingService | null>(null);
  if (!fallbackEditor.current) fallbackEditor.current = new VoicePackEditingService(repository);
  const editor = editingService ?? fallbackEditor.current;
  const detail = packId ? repository.getPack(packId) : undefined;
  if (!detail) return <main className="voice-management-screen" aria-labelledby="voice-management-title"><header className="voice-management-screen__header"><button type="button" onClick={onBack}>← 返回</button><h1 id="voice-management-title">语音管理</h1></header><section className="voice-management-screen__empty" role="status"><h2>当前语音包不可用</h2><p>请返回音频设置后选择一个可用角色。</p></section></main>;
  return <VoiceManagementDetail initialDetail={detail} voiceVolume={voiceVolume} repository={repository} editor={editor} generationService={generationService} packService={packService} onBack={onBack} />;
}

function VoiceManagementDetail({ initialDetail, voiceVolume, repository, editor, generationService, packService, onBack }: { readonly initialDetail: VoicePackDetail; readonly voiceVolume: number; readonly repository: VoicePackRepository; readonly editor: VoicePackEditingService; readonly generationService: VoiceGenerationService; readonly packService: Pick<VoicePackService, 'getPack' | 'updateVoiceLines'>; readonly onBack: () => void }) {
  const [detail, setDetail] = useState(initialDetail);
  const [query, setQuery] = useState(''); const [revision, setRevision] = useState(0); const [editingKey, setEditingKey] = useState<string | null>(null); const [lineDraft, setLineDraft] = useState(''); const [advancedKey, setAdvancedKey] = useState<string | null>(null); const [ttsDraft, setTtsDraft] = useState(''); const [editError, setEditError] = useState<string | null>(null);
  const pendingEdits = useRef(new Map<string, VoiceGenerationOverride>()); const saveTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null); const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { playingKey, error, playOrStop } = useVoicePreview(voiceVolume);
  const [generationPlan, setGenerationPlan] = useState<GenerationPlan | null>(null); const [generationKeys, setGenerationKeys] = useState<readonly string[] | undefined>(); const [generationOverrides, setGenerationOverrides] = useState<readonly VoiceGenerationOverride[]>([]); const [generating, setGenerating] = useState(false); const [generationError, setGenerationError] = useState<string | null>(null);
  useEffect(() => { setDetail(initialDetail); void refreshCurrentPack(); }, [initialDetail]);
  useEffect(() => editor.subscribe(() => setRevision((value) => value + 1)), [editor]);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  useEffect(() => () => { void flushRef.current(); }, []);
  const allLines = useMemo(() => editor.getVoiceLines(detail.meta.id, detail.voiceLines), [detail.meta.id, detail.voiceLines, editor, revision]);
  const statuses = useMemo(() => getVoicePackGenerationStatuses(detail, allLines), [detail, allLines]);
  const summary = useMemo(() => generationStatusSummary(statuses), [statuses]);
  const lines = useMemo(() => filterLines(allLines, query), [allLines, query]);
  const startLineEditing = (line: VoiceLine) => { setEditingKey(line.key); setLineDraft(line.line); setEditError(null); };
  const queueEdit = (line: VoiceLine, patch: Omit<VoiceGenerationOverride, 'key'>) => {
    const next = { ...(pendingEdits.current.get(line.key) ?? { key: line.key }), ...patch };
    pendingEdits.current.set(line.key, next); setSaveState('idle');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void flushPendingVoiceEdits(); }, 500);
  };
  const cancelPendingEdit = (key: string) => {
    pendingEdits.current.delete(key);
    if (!pendingEdits.current.size && saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null; }
  };
  const flushPendingVoiceEdits = async (): Promise<boolean> => {
    if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null; }
    const edits = [...pendingEdits.current.values()];
    if (!edits.length) return true;
    setSaveState('saving');
    try {
      for (const edit of edits) editor.updateVoiceLine(detail.meta.id, edit.key, { ...(edit.line !== undefined ? { line: edit.line } : {}), ...(edit.ttsText !== undefined ? { ttsText: edit.ttsText } : {}) }, detail.voiceLines);
      const refreshed = await packService.updateVoiceLines(detail.meta.id, edits);
      edits.forEach((edit) => { if (pendingEdits.current.get(edit.key) === edit) pendingEdits.current.delete(edit.key); });
      setDetail(refreshed); setSaveState('saved'); setEditError(null); return true;
    } catch (cause) { setSaveState('error'); setEditError(cause instanceof Error ? cause.message : '保存台词失败。'); return false; }
  };
  flushRef.current = flushPendingVoiceEdits;
  const resetPronunciation = (line: VoiceLine) => { setTtsDraft(line.line); queueEdit(line, { ttsText: '' }); void flushPendingVoiceEdits(); };
  const openGenerationPlan = async (keys?: readonly string[]) => {
    if (generating || !(await flushPendingVoiceEdits())) return;
    setGenerationError(null);
    try { const overrides = editor.getPatches(detail.meta.id, keys); setGenerationKeys(keys); setGenerationOverrides(overrides); setGenerationPlan(await generationService.previewGeneration(detail.meta.id, keys, overrides)); }
    catch (cause) { setGenerationError(cause instanceof Error ? cause.message : '无法获取语音生成计划。'); }
  };
  const confirmGeneration = async () => {
    if (!generationPlan || generating) return;
    if (generationPlan.apiCalls === 0) { setGenerationPlan(null); return; }
    setGenerating(true); setGenerationError(null);
    try {
      const result = await generationService.generate(detail.meta.id, generationKeys, generationOverrides);
      await refreshCurrentPack();
      setGenerationPlan(null);
      const outcome = generationOutcome(result);
      if (outcome.error) setGenerationError(outcome.error);
    } catch (cause) { setGenerationError(cause instanceof Error ? cause.message : '语音生成失败。'); }
    finally { setGenerating(false); }
  };
  const refreshCurrentPack = async () => {
    try { setDetail(await packService.getPack(detail.meta.id)); }
    catch { /* Static Pack data remains usable when the dev-only Bridge is unavailable. */ }
  };
  const pendingCount = summary.changed + summary['not-generated'] + summary['missing-audio'] + summary.failed;
  return <main className="voice-management-screen" aria-labelledby="voice-management-title"><header className="voice-management-screen__header"><button type="button" onClick={onBack}>← 返回</button><h1 id="voice-management-title">语音管理</h1></header><section className="voice-management-screen__body"><header className="voice-management-screen__pack-header"><h2>{detail.meta.name}</h2><p>{localeLabel(detail.meta.locale)} · {allLines.length} 条语音</p><VoiceGenerationSummary summary={summary} />{saveState !== 'idle' ? <p className="voice-management-screen__save-status" role="status">{saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '已保存' : '保存失败'}</p> : null}<p className="voice-management-screen__preview-note">试听始终播放已生成的音频版本；编辑文本不会立即改变 MP3。</p><button type="button" className="voice-management-screen__generate-all" disabled={generating || pendingCount === 0} onClick={() => void openGenerationPlan()}>{generating ? '生成中…' : pendingCount === 0 ? '已全部生成' : '一键生成'}</button></header><label className="voice-management-screen__search"><span>搜索语音</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="动作或台词" /></label>{error || editError || generationError ? <p className="voice-management-screen__error" role="status">{generationError ?? editError ?? error}</p> : null}{generationPlan ? <GenerationPlanDialog plan={generationPlan} lines={allLines} selectedKeys={generationKeys} generating={generating} onCancel={() => !generating && setGenerationPlan(null)} onConfirm={() => void confirmGeneration()} /> : null}<div className="voice-management-screen__table" role="table" aria-label={`${detail.meta.name}语音列表`}><div className="voice-management-screen__row voice-management-screen__row--heading" role="row"><span role="columnheader">动作</span><span role="columnheader">台词</span><span role="columnheader">状态</span><span role="columnheader">试听</span></div><div className="voice-management-screen__rows">{lines.map((line) => {
    const generationStatus = statuses[line.key] ?? 'not-generated'; const isGeneratingLine = generating && (!generationKeys || generationKeys.includes(line.key)); const audioUrl = previewAudioUrl(detail, line.key, repository); const playable = generationStatus !== 'missing-audio' && Boolean(audioUrl); const playing = playingKey === line.key; const editing = editingKey === line.key; const advanced = advancedKey === line.key;
    const customPronunciation = hasCustomPronunciation(line);
    const displayedLine = editing ? lineDraft : line.line;
    return <div key={line.key} className="voice-management-screen__row" role="row"><span role="cell" title={line.key}>{displayAction(line)}</span><div role="cell" className="voice-management-screen__line-cell">{editing ? <input autoFocus aria-label={`编辑台词 ${line.key}`} value={lineDraft} onChange={(event) => { setLineDraft(event.target.value); queueEdit(line, { line: event.target.value }); }} onKeyDown={(event) => { const action = voiceLineEditorKeyAction(event.key); if (action === 'save') { event.preventDefault(); void flushPendingVoiceEdits(); setEditingKey(null); } if (action === 'cancel') { event.preventDefault(); cancelPendingEdit(line.key); setEditingKey(null); setEditError(null); } }} onBlur={() => { void flushPendingVoiceEdits(); setEditingKey(null); }} /> : <span className="voice-management-screen__line" title="双击编辑台词" onDoubleClick={() => startLineEditing(line)}>{line.line}</span>}<button type="button" className="voice-management-screen__advanced-toggle" aria-expanded={advanced} onClick={() => { setAdvancedKey(advanced ? null : line.key); setTtsDraft(customPronunciation ? line.tts_text : displayedLine); setEditError(null); }}>高级发音</button>{advanced ? <div className="voice-management-screen__advanced"><p>实际 TTS 输入：<code>{customPronunciation ? line.tts_text : displayedLine}</code></p><p>{customPronunciation ? '高级发音已自定义' : '跟随台词'}</p><label>高级发音覆盖<input aria-label={`编辑高级发音 ${line.key}`} value={ttsDraft} onChange={(event) => { setTtsDraft(event.target.value); queueEdit(line, { ttsText: ttsOverrideForDraft({ line: displayedLine }, event.target.value) }); }} onKeyDown={(event) => { const action = voiceLineEditorKeyAction(event.key); if (action === 'save') { event.preventDefault(); void flushPendingVoiceEdits(); } if (action === 'cancel') { event.preventDefault(); cancelPendingEdit(line.key); setTtsDraft(customPronunciation ? line.tts_text : displayedLine); setEditError(null); } }} onBlur={() => void flushPendingVoiceEdits()} /></label><p className="voice-management-screen__pronunciation-example">示例：将“发”设为 <code>&lt;|phoneme_start|&gt;fa1&lt;|phoneme_end|&gt;</code> 以指定读音；保存后仅标记待更新，不会立即生成音频。</p>{customPronunciation ? <button type="button" onClick={() => resetPronunciation(line)}>恢复默认发音</button> : null}</div> : null}</div><span role="cell" className={`voice-pack-status voice-pack-status--${isGeneratingLine ? 'generating' : generationStatus}`}>{isGeneratingLine ? '◌ 生成中' : statusLabel(generationStatus)}{generationActionLabel(generationStatus) ? <button type="button" className="voice-management-screen__generate-one" disabled={generating} onClick={() => void openGenerationPlan([line.key])}>{generationActionLabel(generationStatus)}</button> : null}</span><span role="cell"><button type="button" className="voice-management-screen__preview" aria-label={playing ? `停止试听 ${line.line}` : `试听 ${line.line}`} disabled={!playable} onClick={() => audioUrl && playOrStop(line.key, audioUrl)}>{playing ? '■' : '▶'}</button></span></div>;
  })}</div></div></section></main>;
}

function VoiceGenerationSummary({ summary }: { readonly summary: Record<VoiceGenerationStatus, number> }) {
  return <div className="voice-management-screen__summary" aria-label="语音生成状态摘要"><span>已生成 {summary.generated}</span><span>已修改 {summary.changed}</span><span>未生成 {summary['not-generated']}</span><span>缺失 {summary['missing-audio']}</span>{summary.failed ? <span>失败 {summary.failed}</span> : null}{summary.changed ? <strong>{summary.changed} 条语音待更新</strong> : null}</div>;
}

function GenerationPlanDialog({ plan, lines, selectedKeys, generating, onCancel, onConfirm }: { readonly plan: GenerationPlan; readonly lines: readonly VoiceLine[]; readonly selectedKeys: readonly string[] | undefined; readonly generating: boolean; readonly onCancel: () => void; readonly onConfirm: () => void }) {
  const pending = plan.changed + plan.new + plan.missing;
  const selectedLine = selectedKeys?.length === 1 ? lines.find((line) => line.key === selectedKeys[0]) : undefined;
  return <section className="voice-management-screen__generation-plan" aria-label="确认生成语音"><h2>确认生成语音</h2>{selectedLine ? <><p>台词：{selectedLine.line}</p><p>实际 TTS：{effectiveTtsForDisplay(selectedLine)}</p></> : null}<p>待生成：{pending}</p><p>已修改：{plan.changed}</p><p>缺失：{plan.missing}</p><p>保持不变：{plan.unchanged}</p><p>预计 Fish Audio API 请求：{plan.apiCalls} 次</p>{plan.apiCalls === 0 ? <p>所有语音均为最新，无需生成。</p> : null}<div><button type="button" disabled={generating} onClick={onCancel}>{plan.apiCalls === 0 ? '关闭' : '取消'}</button>{plan.apiCalls > 0 ? <button type="button" disabled={generating} onClick={onConfirm}>{generating ? '生成中…' : '确认生成'}</button> : null}</div></section>;
}

function useVoicePreview(volume: number) {
  const [playingKey, setPlayingKey] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const controllerRef = useRef<VoicePreviewController | null>(null);
  if (!controllerRef.current) controllerRef.current = new VoicePreviewController((url) => new Audio(url), (key, nextError) => { setPlayingKey(key); setError(nextError); });
  useEffect(() => () => controllerRef.current?.dispose(), []); useEffect(() => { controllerRef.current?.setVolume(volume); }, [volume]);
  useEffect(() => { if (!error) return undefined; const timer = window.setTimeout(() => setError(null), 2500); return () => window.clearTimeout(timer); }, [error]);
  return { playingKey, error, playOrStop: (key: string, url: string) => controllerRef.current?.playOrStop(key, url, volume) };
}

function filterLines(lines: readonly VoiceLine[], query: string): readonly VoiceLine[] { const normalized = query.trim().toLocaleLowerCase(); return normalized ? lines.filter((line) => [line.action, line.action_cn, line.line].some((value) => value?.toLocaleLowerCase().includes(normalized))) : lines; }
/** Empty overrides intentionally use Python's tts_text -> line fallback. */
export function ttsOverrideForDraft(line: Pick<VoiceLine, 'line'>, draft: string): string {
  return draft.trim() && draft.trim() !== line.line.trim() ? draft : '';
}
function effectiveTtsForDisplay(line: Pick<VoiceLine, 'line' | 'tts_text'>): string { return line.tts_text.trim() ? line.tts_text : line.line; }
/** Generation completion never navigates; only the user's explicit ← 返回 leaves this screen. */
export function generationOutcome(result: GenerationResult): { readonly remainInManagement: true; readonly error: string | null } {
  return { remainInManagement: true, error: result.success ? null : result.error ? `${result.error.code}: ${result.error.message}` : '生成未全部完成；可查看失败条目后重试。' };
}
function previewAudioUrl(detail: VoicePackDetail, key: string, repository: VoicePackRepository): string | undefined {
  const availability = detail.voiceAvailability[key];
  if (import.meta.env.DEV && availability?.status === 'available') {
    const filename = availability.file.replace(/^audio\//, '');
    return `/api/voice-packs/${encodeURIComponent(detail.meta.id)}/audio/${encodeURIComponent(filename)}`;
  }
  return repository.getAudioForKey(detail.meta.id, key);
}
function displayAction(line: VoiceLine): string { return line.action_cn ?? (/[\u3400-\u9fff]/.test(line.action) ? line.action : line.line); }
function statusLabel(status: VoiceGenerationStatus): string { return status === 'generated' ? '✓ 已生成' : status === 'changed' ? '● 已修改' : status === 'missing-audio' ? '△ 音频缺失' : status === 'failed' ? '! 生成失败' : '○ 未生成'; }
function generationActionLabel(status: VoiceGenerationStatus): string | undefined { return status === 'not-generated' ? '生成' : status === 'changed' ? '更新' : status === 'missing-audio' ? '重新生成' : status === 'failed' ? '重试' : undefined; }
function localeLabel(locale: string): string { return locale.toLowerCase() === 'zh-cn' ? '中文' : locale; }
