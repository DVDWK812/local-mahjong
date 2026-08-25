import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { VoicePackEditingService, voiceLineEditorKeyAction } from '../../audio/voice/VoicePackEditingService';
import { VOICE_PACK_REPOSITORY, VoicePackRepository } from '../../audio/voice/VoicePackRepository';
import { generationStatusSummary, getVoicePackGenerationStatuses, type VoiceGenerationStatus } from '../../audio/voice/voiceGenerationStatus';
import type { VoiceLine, VoiceModelControls, VoicePackDetail } from '../../audio/voice/types';
import { VoicePreviewController } from '../../audio/voice/voicePreview';
import { LOCAL_VOICE_GENERATION_SERVICE, type GenerationPlan, type GenerationResult, type VoiceGenerationOverride, type VoiceGenerationService } from '../../audio/voice/VoiceGenerationService';
import { LOCAL_VOICE_PACK_SERVICE, type VoicePackService } from '../../audio/voice/VoicePackService';
import { groupVoiceLines } from '../../audio/voice/voiceLineGroups';
import { defaultGenerationSettingsPatch, type VoiceGenerationSettingsPatch } from '../../audio/voice/voiceSynthesisSettings';
import { completeGenerationCapabilityContext, resolveEffectiveGenerationConfig } from '../../audio/voice/effectiveGenerationConfig';
import { FISH_AUDIO_LANGUAGES } from '../../audio/voice/fishAudioLanguages';
import { textControlProfileForModel, type TextControlProfile } from '../../audio/voice/textControlProfiles';
import { effectiveTtsText, synchronizeFromPlainText, synchronizeFromTtsText } from '../../audio/voice/ttsTextSynchronization';
import { SettingHelpTooltip } from './SettingHelpTooltip';

interface VoiceManagementScreenProps {
  readonly packId: string | null; readonly voiceVolume: number; readonly onBack: () => void;
  readonly repository?: VoicePackRepository; readonly editingService?: VoicePackEditingService; readonly generationService?: VoiceGenerationService; readonly packService?: Pick<VoicePackService, 'getPack' | 'updateVoiceLines'>;
}

/** Pack text editor. Changes are local editing overrides only; audio generation remains outside this screen. */
export function VoiceManagementScreen({ packId, voiceVolume, onBack, repository = VOICE_PACK_REPOSITORY, editingService, generationService = LOCAL_VOICE_GENERATION_SERVICE, packService = LOCAL_VOICE_PACK_SERVICE }: VoiceManagementScreenProps) {
  const fallbackEditor = useRef<VoicePackEditingService | null>(null);
  if (!fallbackEditor.current) fallbackEditor.current = new VoicePackEditingService(repository);
  const editor = editingService ?? fallbackEditor.current;
  const bundledDetail = packId ? repository.getPack(packId) : undefined;
  const [bridgeDetail, setBridgeDetail] = useState<VoicePackDetail | undefined>(bundledDetail);
  const [bridgeLoadFailed, setBridgeLoadFailed] = useState(!bundledDetail && typeof window === 'undefined');
  useEffect(() => {
    let active = true;
    setBridgeDetail(bundledDetail); setBridgeLoadFailed(false);
    if (!packId || bundledDetail) return () => { active = false; };
    void packService.getPack(packId).then((detail) => { if (active) setBridgeDetail(detail); }).catch(() => { if (active) setBridgeLoadFailed(true); });
    return () => { active = false; };
  }, [packId, bundledDetail, packService]);
  const detail = bridgeDetail ?? bundledDetail;
  if (!detail) return <main className="voice-management-screen" aria-labelledby="voice-management-title"><header className="voice-management-screen__header"><button type="button" onClick={onBack}>← 返回</button><h1 id="voice-management-title">语音管理</h1></header><section className="voice-management-screen__empty" role="status"><h2>{bridgeLoadFailed ? '当前语音包不可用' : '正在加载角色语音包…'}</h2><p>{bridgeLoadFailed ? '请返回音频设置后选择一个可用角色。' : '正在通过本地语音服务读取新建角色。'}</p></section></main>;
  return <VoiceManagementDetail initialDetail={detail} voiceVolume={voiceVolume} repository={repository} editor={editor} generationService={generationService} packService={packService} onBack={onBack} />;
}

function VoiceManagementDetail({ initialDetail, voiceVolume, repository, editor, generationService, packService, onBack }: { readonly initialDetail: VoicePackDetail; readonly voiceVolume: number; readonly repository: VoicePackRepository; readonly editor: VoicePackEditingService; readonly generationService: VoiceGenerationService; readonly packService: Pick<VoicePackService, 'getPack' | 'updateVoiceLines'>; readonly onBack: () => void }) {
  const [detail, setDetail] = useState(initialDetail);
  const ttsInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState(''); const [expandedSearchResults, setExpandedSearchResults] = useState<ReadonlySet<string>>(() => new Set()); const [revision, setRevision] = useState(0); const [editingKey, setEditingKey] = useState<string | null>(null); const [lineDraft, setLineDraft] = useState(''); const [advancedKey, setAdvancedKey] = useState<string | null>(null); const [ttsDraft, setTtsDraft] = useState(''); const [advancedSettingsDraft, setAdvancedSettingsDraft] = useState<VoiceGenerationSettingsPatch>(defaultGenerationSettingsPatch()); const [unifiedSettingsOpen, setUnifiedSettingsOpen] = useState(false); const [unifiedSettingsDraft, setUnifiedSettingsDraft] = useState<VoiceGenerationSettingsPatch>(defaultGenerationSettingsPatch()); const [editError, setEditError] = useState<string | null>(null);
  const pendingEdits = useRef(new Map<string, VoiceGenerationOverride>()); const saveTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null); const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { playingKey, error, playOrStop } = useVoicePreview(voiceVolume);
  const [generationPlan, setGenerationPlan] = useState<GenerationPlan | null>(null); const [generationKeys, setGenerationKeys] = useState<readonly string[] | undefined>(); const [generationOverrides, setGenerationOverrides] = useState<readonly VoiceGenerationOverride[]>([]); const [generating, setGenerating] = useState(false); const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null); const [generatingKey, setGeneratingKey] = useState<string | null>(null); const [runtimeGenerationStates, setRuntimeGenerationStates] = useState<Record<string, VoiceGenerationStatus | 'generating'>>({}); const [runtimeGenerationErrors, setRuntimeGenerationErrors] = useState<Record<string, string>>({}); const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null); const [generationError, setGenerationError] = useState<string | null>(null);
  const unifiedSettingsId = useId();
  useEffect(() => { setDetail(initialDetail); void refreshCurrentPack(); }, [initialDetail]);
  useEffect(() => editor.subscribe(() => setRevision((value) => value + 1)), [editor]);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  useEffect(() => () => { void flushRef.current(); }, []);
  const allLines = useMemo(() => editor.getVoiceLines(detail.meta.id, detail.voiceLines), [detail.meta.id, detail.voiceLines, editor, revision]);
  const statuses = useMemo(() => getVoicePackGenerationStatuses(detail, allLines), [detail, allLines]);
  const displayedStatuses = useMemo(() => Object.fromEntries(allLines.map((line) => [line.key, resolveRuntimeGenerationStatus(statuses[line.key] ?? 'not-generated', runtimeGenerationStates[line.key])])) as Record<string, VoiceGenerationStatus>, [allLines, runtimeGenerationStates, statuses]);
  const summary = useMemo(() => generationStatusSummary(displayedStatuses), [displayedStatuses]);
  const lines = useMemo(() => filterVoiceLines(allLines, query), [allLines, query]);
  const searchActive = query.trim().length > 0;
  const searchGroups = useMemo(() => groupSearchVoiceLines(lines), [lines]);
  const searchStatuses = useMemo(() => Object.fromEntries(allLines.map((line) => [line.key, runtimeGenerationStates[line.key] === 'generating' ? 'generating' : displayedStatuses[line.key] ?? 'not-generated'])) as Record<string, VoiceGenerationStatus | 'generating'>, [allLines, displayedStatuses, runtimeGenerationStates]);
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
      for (const edit of edits) editor.updateVoiceLine(detail.meta.id, edit.key, edit, detail.voiceLines);
      const refreshed = await packService.updateVoiceLines(detail.meta.id, edits);
      edits.forEach((edit) => { if (pendingEdits.current.get(edit.key) === edit) pendingEdits.current.delete(edit.key); });
      editor.acknowledgePersisted(detail.meta.id, edits.map((edit) => edit.key));
      setDetail(refreshed); setSaveState('saved'); setEditError(null); return true;
    } catch (cause) { setSaveState('error'); setEditError(cause instanceof Error ? cause.message : '保存台词失败。'); return false; }
  };
  flushRef.current = flushPendingVoiceEdits;
  const resetPronunciation = (line: VoiceLine) => { setTtsDraft(effectiveTtsText({ ...line, tts_text: '' })); queueEdit(line, { ttsText: '' }); void flushPendingVoiceEdits(); };
  const insertTextControl = (line: VoiceLine, token: string) => {
    const source = ttsDraft || effectiveTtsText(line);
    const start = ttsInputRef.current?.selectionStart ?? 0; const end = ttsInputRef.current?.selectionEnd ?? start;
    const next = insertTextControlAtSelection(source, token, start, end);
    setTtsDraft(next); queueEdit(line, synchronizeFromTtsText(next, line.line, textControlProfile));
    requestAnimationFrame(() => { ttsInputRef.current?.focus(); const caret = start + token.length; ttsInputRef.current?.setSelectionRange(caret, caret); });
  };
  const settingsPatchFor = (line: VoiceLine): VoiceGenerationSettingsPatch => {
    const settings = resolveEffectiveGenerationConfig(line, detail.meta, detail.synthesis, detail.meta.ttsControls ? { controls: detail.meta.ttsControls } : undefined);
    const defaults = defaultGenerationSettingsPatch();
    return { speed: settings.speed ?? defaults.speed, volume: settings.volume ?? defaults.volume, stability: settings.stability ?? defaults.stability, similarity: settings.similarity ?? defaults.similarity, languageOverride: line.language_override ?? '', textNormalization: settings.textNormalization ?? defaults.textNormalization, pitch: line.pitch?.trim() ? Number(line.pitch) : null, ttsEmotion: line.tts_emotion ?? '', ttsInstruction: line.tts_instruction ?? '' };
  };
  const toggleAdvancedSettings = async (line: VoiceLine) => {
    if (advancedKey === line.key) { await flushPendingVoiceEdits(); setAdvancedKey(null); return; }
    if (!(await flushPendingVoiceEdits())) return;
    setAdvancedKey(line.key); setTtsDraft(effectiveTtsText(line)); setAdvancedSettingsDraft(settingsPatchFor(line)); setEditError(null);
  };
  const resetLineGenerationSettings = (line: VoiceLine) => { const defaults = defaultGenerationSettingsPatch(); setAdvancedSettingsDraft(defaults); queueEdit(line, defaults); void flushPendingVoiceEdits(); };
  const applyUnifiedSettings = async () => {
    for (const line of allLines) queueEdit(line, unifiedSettingsDraft);
    await flushPendingVoiceEdits();
  };
  const openGenerationPlan = async (keys?: readonly string[]) => {
    if (generating || !(await flushPendingVoiceEdits())) return;
    setGenerationError(null); setGenerationResult(null);
    try {
      // A plan is always built from the bridge's latest CSV snapshot.  This
      // prevents a just-saved control from being compared against stale React
      // state or a stale build-time repository module.
      const latest = await refreshCurrentPack() ?? detail;
      const overrides = editor.getPatches(latest.meta.id, keys);
      const plan = await generationService.previewGeneration(latest.meta.id, keys, overrides);
      await refreshCurrentPack();
      setGenerationKeys(keys); setGenerationOverrides(overrides); setGenerationPlan(plan);
    }
    catch (cause) { setGenerationError(cause instanceof Error ? cause.message : '无法获取语音生成计划。'); }
  };
  const confirmGeneration = async () => {
    if (!generationPlan || generating) return;
    if (generationPlan.apiCalls === 0) return;
    const targetKeys = generationTargetKeys(generationPlan);
    if (targetKeys.length === 0) return;
    setGenerating(true); setGenerationError(null); setRuntimeGenerationStates({}); setRuntimeGenerationErrors({});
    try {
      const result = await generatePlanTargets(generationService, detail.meta.id, generationPlan, generationOverrides, (progress, key) => {
        setGenerationProgress(progress); setGeneratingKey(key);
        if (key && progress.completed < progress.total) setRuntimeGenerationStates((states) => ({ ...states, [key]: 'generating' }));
      }, async (key, itemResult) => {
        const item = itemResult.items.find((candidate) => candidate.key === key);
        const succeeded = item?.status === 'generated' || item?.status === 'skipped';
        setRuntimeGenerationStates((states) => ({ ...states, [key]: succeeded ? 'generated' : 'failed' }));
        if (!succeeded) setRuntimeGenerationErrors((errors) => ({ ...errors, [key]: item?.error ?? itemResult.error?.message ?? '生成失败' }));
        const refreshed = await refreshCurrentPack();
        if (succeeded && refreshed) setRuntimeGenerationStates((states) => { const { [key]: _done, ...rest } = states; return rest; });
      });
      await refreshCurrentPack();
      setGenerationPlan(null); setGenerationResult(result);
      const outcome = generationOutcome(result);
      if (outcome.error) setGenerationError(outcome.error);
    } catch (cause) { setGenerationError(cause instanceof Error ? cause.message : '语音生成失败。'); }
    finally { setGenerating(false); setGeneratingKey(null); setGenerationProgress(null); }
  };
  const clearGenerationConfirmation = () => {
    if (generating) return;
    setGenerationPlan(null); setGenerationResult(null); setGenerationError(null); setGenerationKeys(undefined); setGenerationOverrides([]); setGenerationProgress(null); setGeneratingKey(null);
  };
  const refreshCurrentPack = async (): Promise<VoicePackDetail | undefined> => {
    try { const refreshed = await packService.getPack(detail.meta.id); setDetail(refreshed); return refreshed; }
    catch { return undefined; /* Static Pack data remains usable when the dev-only Bridge is unavailable. */ }
  };
  const pendingCount = summary.changed + summary['not-generated'] + summary['missing-audio'] + summary.failed;
  const textControlProfile = textControlProfileForModel(detail.meta.modelId);
  const toggleSearchResult = (line: string) => setExpandedSearchResults((expanded) => {
    const next = new Set(expanded);
    if (next.has(line)) next.delete(line); else next.add(line);
    return next;
  });
  const renderVoiceLine = (line: VoiceLine, searchIdentity?: string) => {
    const runtimeStatus = runtimeGenerationStates[line.key]; const generationStatus = displayedStatuses[line.key] ?? 'not-generated'; const isGeneratingLine = runtimeStatus === 'generating'; const audioUrl = previewAudioUrl(detail, line.key, repository); const playable = generationStatus !== 'missing-audio' && Boolean(audioUrl); const playing = playingKey === line.key; const editing = editingKey === line.key; const advanced = advancedKey === line.key; const displayedLine = editing ? lineDraft : line.line;
    const advancedSettingsId = `voice-advanced-${line.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    return <div key={line.key} className={`voice-management-screen__row${searchIdentity ? ' voice-management-screen__row--search-child' : ''}`} role="row"><span role="cell" title={line.key}>{searchIdentity ?? displayAction(line)}</span><div role="cell" className="voice-management-screen__line-cell">{editing ? <input autoFocus aria-label={`编辑台词 ${line.key}`} value={lineDraft} onChange={(event) => { setLineDraft(event.target.value); queueEdit(line, synchronizeFromPlainText(event.target.value)); }} onKeyDown={(event) => { const action = voiceLineEditorKeyAction(event.key); if (action === 'save') { event.preventDefault(); void flushPendingVoiceEdits(); setEditingKey(null); } if (action === 'cancel') { event.preventDefault(); cancelPendingEdit(line.key); setEditingKey(null); setEditError(null); } }} onBlur={() => { void flushPendingVoiceEdits(); setEditingKey(null); }} /> : <span className="voice-management-screen__line" title="双击编辑台词" onDoubleClick={() => startLineEditing(line)}>{line.line}</span>}<DisclosureButton expanded={advanced} controlsId={advancedSettingsId} onClick={() => void toggleAdvancedSettings(line)}>高级设置</DisclosureButton>{advanced ? <div id={advancedSettingsId} className="voice-management-screen__advanced" onBlur={() => void flushPendingVoiceEdits()}><EffectiveTtsTextEditor inputRef={ttsInputRef} lineKey={line.key} value={ttsDraft} onChange={(value) => { setTtsDraft(value); queueEdit(line, synchronizeFromTtsText(value, displayedLine, textControlProfile)); }} onBlur={() => void flushPendingVoiceEdits()} /><TextControlPalette profile={textControlProfile} onInsert={(token) => insertTextControl(line, token)} /><GenerationSettingsFields settings={advancedSettingsDraft} locale={detail.meta.locale} controls={detail.meta.ttsControls} onChange={(patch) => { setAdvancedSettingsDraft(patch); queueEdit(line, patch); }} /><button type="button" onClick={() => resetPronunciation(line)}>恢复默认发音</button><button type="button" onClick={() => resetLineGenerationSettings(line)}>恢复默认生成参数</button></div> : null}</div><span role="cell" title={generationStatus === 'failed' ? runtimeGenerationErrors[line.key] ?? '生成失败' : undefined} className={`voice-pack-status voice-pack-status--${isGeneratingLine ? 'generating' : generationStatus}`}>{isGeneratingLine ? '◌ 生成中' : statusLabel(generationStatus)}{generationActionLabel(generationStatus) ? <button type="button" className="voice-management-screen__generate-one" disabled={generating} onClick={() => void openGenerationPlan([line.key])}>{generationActionLabel(generationStatus)}</button> : null}</span><span role="cell"><button type="button" className="voice-management-screen__preview" aria-label={playing ? `停止试听 ${line.line}` : `试听 ${line.line}`} disabled={!playable} onClick={() => audioUrl && playOrStop(line.key, audioUrl)}>{playing ? '■' : '▶'}</button></span></div>;
  };
  return <main className="voice-management-screen" aria-labelledby="voice-management-title">
    <header className="voice-management-screen__header"><button type="button" onClick={onBack}>← 返回</button><h1 id="voice-management-title">语音管理</h1></header>
    <section className="voice-management-screen__body">
      <section className="voice-management-screen__top">
      <div className="voice-management-screen__top-controls">
      <header className="voice-management-screen__pack-header">
        <h2>{detail.meta.name}</h2><p>{localeLabel(detail.meta.locale)} · {allLines.length} 条语音</p><VoiceGenerationSummary summary={summary} />
        {saveState !== 'idle' ? <p className="voice-management-screen__save-status" role="status">{saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '已保存' : '保存失败'}</p> : null}
        <p className="voice-management-screen__preview-note">试听始终播放已生成的音频版本；编辑文本不会立即改变 MP3。</p>
        <TextControlPalette profile={textControlProfile} />
        <section className="voice-management-screen__unified-settings">
          <DisclosureButton expanded={unifiedSettingsOpen} controlsId={unifiedSettingsId} onClick={() => setUnifiedSettingsOpen((open) => !open)}>统一高级设置</DisclosureButton>
          {unifiedSettingsOpen ? <div id={unifiedSettingsId} className="voice-management-screen__advanced"><GenerationSettingsFields settings={unifiedSettingsDraft} locale={detail.meta.locale} controls={detail.meta.ttsControls} onChange={setUnifiedSettingsDraft} /><div><button type="button" onClick={() => setUnifiedSettingsDraft(defaultGenerationSettingsPatch())}>恢复默认</button><button type="button" onClick={() => void applyUnifiedSettings()}>应用到全部 {allLines.length} 条</button></div></div> : null}
        </section>
        <button type="button" className="voice-management-screen__generate-all" disabled={generating || pendingCount === 0} onClick={() => void openGenerationPlan()}>{generating ? '生成中…' : pendingCount === 0 ? '已全部生成' : '一键生成'}</button>
      </header>
      <label className="voice-management-screen__search"><span>搜索语音</span><input value={query} onChange={(event) => { setQuery(event.target.value); setExpandedSearchResults(new Set()); }} placeholder="动作或台词" /></label>
      {error || editError || generationError ? <p className="voice-management-screen__error" role="status">{generationError ?? editError ?? error}</p> : null}
      </div>
      <GenerationConfirmationPanel plan={generationPlan} lines={allLines} selectedKeys={generationKeys} generating={generating} progress={generationProgress} result={generationResult} error={generationError} onCancel={clearGenerationConfirmation} onConfirm={() => void confirmGeneration()} />
      </section>
      <div className="voice-management-screen__table" role="table" aria-label={`${detail.meta.name}语音列表`}>
        <div className="voice-management-screen__row voice-management-screen__row--heading" role="row"><span role="columnheader">动作</span><span role="columnheader">台词</span><span role="columnheader">状态</span><span role="columnheader">试听</span></div>
        <div className="voice-management-screen__rows">{searchActive
          ? searchGroups.map((group) => group.lines.length === 1
            ? renderVoiceLine(group.lines[0])
            : <VoiceSearchResultGroup key={group.line} group={group} expanded={expandedSearchResults.has(group.line)} statuses={searchStatuses} onToggle={() => toggleSearchResult(group.line)} renderLine={(line) => renderVoiceLine(line, searchVoiceLineIdentity(line))} />)
          : groupVoiceLines(lines).map(({ group, lines: groupedLines }) => <section className="voice-management-screen__group" key={group.id}><h3 className="voice-management-screen__group-title">{group.title}</h3>{groupedLines.map((line) => renderVoiceLine(line))}</section>)}</div>
      </div>
    </section>
  </main>;
}

function VoiceGenerationSummary({ summary }: { readonly summary: Record<VoiceGenerationStatus, number> }) {
  return <div className="voice-management-screen__summary" aria-label="语音生成状态摘要"><span>已生成 {summary.generated}</span><span>已修改 {summary.changed}</span><span>未生成 {summary['not-generated']}</span><span>缺失 {summary['missing-audio']}</span>{summary.failed ? <span>失败 {summary.failed}</span> : null}{summary.changed ? <strong>{summary.changed} 条语音待更新</strong> : null}</div>;
}

/** The only text editor shown for a voice line: its value is the effective TTS input. */
export function EffectiveTtsTextEditor({ inputRef, lineKey, value, onChange, onBlur }: { readonly inputRef: RefObject<HTMLTextAreaElement | null>; readonly lineKey: string; readonly value: string; readonly onChange: (value: string) => void; readonly onBlur: () => void }) {
  return <textarea ref={inputRef} className="voice-management-screen__tts-text" aria-label={`编辑 TTS 文本 ${lineKey}`} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />;
}

export function TextControlPalette({ profile, onInsert }: { readonly profile: TextControlProfile; readonly onInsert?: (token: string) => void }) {
  const [open, setOpen] = useState(false); const controlsId = useId();
  if (profile.kind === 'none') return null;
  return <section className="voice-management-screen__text-controls"><DisclosureButton expanded={open} controlsId={controlsId} onClick={() => setOpen((value) => !value)}>文本控制标签</DisclosureButton>{open ? <div id={controlsId} className="voice-management-screen__advanced"><p>{profile.help}</p>{onInsert ? <p>点击标签可插入到当前 TTS 文本框中。</p> : <p>打开某条语音的“高级设置”后可插入到当前 TTS 文本框中。</p>}{profile.groups.map((group) => <div key={group.label}><strong>{group.label}</strong><div className="voice-management-screen__text-control-buttons">{group.controls.map((control) => <button key={control.token} type="button" disabled={!onInsert} onClick={() => onInsert?.(control.token)} title={control.token}>{control.label}</button>)}</div></div>)}</div> : null}</section>;
}

/** Native button disclosure keeps all advanced areas keyboard-accessible. */
export function DisclosureButton({ expanded, controlsId, onClick, children }: { readonly expanded: boolean; readonly controlsId: string; readonly onClick: () => void; readonly children: ReactNode }) {
  return <button type="button" className="voice-management-screen__disclosure" aria-expanded={expanded} aria-controls={controlsId} onClick={onClick}>{children}<span className="voice-management-screen__disclosure-arrow" aria-hidden="true">{expanded ? '▲' : '▼'}</span></button>;
}

export function GenerationSettingsFields({ settings, locale, controls, onChange }: { readonly settings: VoiceGenerationSettingsPatch; readonly locale: string; readonly controls?: Partial<VoiceModelControls>; readonly onChange: (settings: VoiceGenerationSettingsPatch) => void }) {
  const value = { ...defaultGenerationSettingsPatch(), ...settings };
  const normalizationId = useId();
  const authoritativeControls = completeGenerationCapabilityContext(controls ? { controls } : undefined)?.controls;
  const supports = (control: keyof VoiceModelControls): boolean => authoritativeControls === undefined || authoritativeControls[control] === true;
  const update = (patch: VoiceGenerationSettingsPatch) => onChange({ ...value, ...patch });
  return <fieldset className="voice-management-screen__generation-settings"><legend>生成参数</legend>
    {supports('speed') ? <label>语速 <input aria-label="语速" type="range" min="0.5" max="2" step="0.05" value={value.speed} onChange={(event) => update({ speed: Number(event.target.value) })} /><output>{value.speed?.toFixed(2)}</output></label> : null}
    {supports('volume') ? <label>音量 <input aria-label="音量" type="range" min="-20" max="20" step="1" value={value.volume} onChange={(event) => update({ volume: Number(event.target.value) })} /><output>{value.volume} dB</output></label> : null}
    {supports('stability') ? <label>稳定性 <input aria-label="稳定性" type="range" min="0" max="1" step="0.05" value={value.stability} onChange={(event) => update({ stability: Number(event.target.value) })} /><output>{value.stability?.toFixed(2)}</output></label> : null}
    {supports('similarity') ? <label>相似度 <input aria-label="相似度" type="range" min="0" max="1" step="0.05" value={value.similarity} onChange={(event) => update({ similarity: Number(event.target.value) })} /><output>{value.similarity?.toFixed(2)}</output></label> : null}
    {supports('language') ? <div className="voice-management-screen__setting-row"><span className="voice-management-screen__setting-label">语言覆盖 <SettingHelpTooltip text="指定这一条语音生成时使用的语言提示。选择‘跟随角色语言’时使用当前角色的语言设置。只影响语音生成，不改变游戏界面语言。" /></span><select aria-label="语言覆盖" value={value.languageOverride} onChange={(event) => update({ languageOverride: event.target.value })}><option value="">跟随角色语言（{locale}）</option>{FISH_AUDIO_LANGUAGES.map((language) => <option key={language.id} value={language.locale}>{language.flag} {language.displayName}</option>)}</select></div> : null}
    {supports('textNormalization') ? <div className="voice-management-screen__setting-row"><span className="voice-management-screen__setting-label"><label htmlFor={normalizationId}>文本归一化</label> <SettingHelpTooltip text="让语音模型自动规范数字、日期、符号等文本的读法。关闭后会更接近原始文本输入。特殊发音可通过 TTS 文本进行控制。" /></span><input id={normalizationId} aria-label="文本归一化" type="checkbox" checked={value.textNormalization} onChange={(event) => update({ textNormalization: event.target.checked })} /></div> : null}
    {authoritativeControls?.pitch === true ? <label>音高 <input aria-label="音高" type="range" min="-12" max="12" step="1" value={value.pitch ?? 0} onChange={(event) => update({ pitch: Number(event.target.value) })} /><output>{value.pitch ?? 0}</output></label> : null}
    {authoritativeControls?.emotion === true ? <p className="voice-management-screen__capability-note">当前模型支持情绪，但没有可发现的合法情绪选项；不会自动发送角色元数据 emotion。</p> : null}
    {authoritativeControls?.instruction === true ? <label>风格指令 <textarea aria-label="风格指令" maxLength={1600} value={value.ttsInstruction} onChange={(event) => update({ ttsInstruction: event.target.value })} /></label> : null}
  </fieldset>;
}

export interface GenerationProgress { readonly completed: number; readonly total: number; }

export function generationTargetCount(plan: Pick<GenerationPlan, 'new' | 'changed' | 'missing'>): number {
  return plan.new + plan.changed + plan.missing;
}

/** Runtime terminal state wins until the freshly reloaded Pack confirms it. */
export function resolveRuntimeGenerationStatus(authoritative: VoiceGenerationStatus, runtime?: VoiceGenerationStatus | 'generating'): VoiceGenerationStatus {
  return runtime === 'generated' || runtime === 'failed' ? runtime : authoritative;
}

export function generationTargetKeys(plan: GenerationPlan): readonly string[] {
  return plan.items.filter((item) => item.status === 'new' || item.status === 'changed' || item.status === 'missing').map((item) => item.key);
}

export async function generatePlanTargets(
  service: VoiceGenerationService,
  packId: string,
  plan: GenerationPlan,
  overrides: readonly VoiceGenerationOverride[],
  onProgress: (progress: GenerationProgress, currentKey: string | null) => void,
  onTerminal?: (key: string, result: GenerationResult) => void | Promise<void>,
): Promise<GenerationResult> {
  const targetKeys = generationTargetKeys(plan);
  const total = generationTargetCount(plan);
  if (targetKeys.length !== total) throw new Error('语音生成计划目标无效。');
  onProgress({ completed: 0, total }, null);
  const results: GenerationResult[] = [];
  for (const [index, key] of targetKeys.entries()) {
    onProgress({ completed: index, total }, key);
    let result: GenerationResult;
    try {
      result = await service.generate(packId, [key], overrides.filter((override) => override.key === key));
    } catch (cause) {
      // A bridge/process failure is terminal for this key, but must not leave
      // the batch lock or progress indicator stuck.  Earlier successes remain
      // on disk and later retries are planned from authoritative pack state.
      result = {
        success: false, generated: 0, failed: 1, skipped: 0,
        items: [{ key, file: plan.items.find((item) => item.key === key)?.file ?? '', status: 'failed', error: cause instanceof Error ? cause.message : '语音生成失败。' }],
        error: { code: 'GENERATOR_PROCESS_FAILED', message: cause instanceof Error ? cause.message : '语音生成失败。' },
      };
    }
    results.push(result);
    await onTerminal?.(key, result);
    // A resolved result is terminal for this key whether Fish generated it or recorded a final failure.
    onProgress({ completed: index + 1, total }, null);
  }
  return mergeGenerationResults(results);
}

export function mergeGenerationResults(results: readonly GenerationResult[]): GenerationResult {
  const failed = results.find((result) => !result.success);
  return {
    success: !failed,
    generated: results.reduce((total, result) => total + result.generated, 0),
    failed: results.reduce((total, result) => total + result.failed, 0),
    skipped: results.reduce((total, result) => total + result.skipped, 0),
    items: results.flatMap((result) => result.items),
    ...(failed?.error ? { error: failed.error } : {}),
  };
}

export function GenerationConfirmationPanel({ plan, lines, selectedKeys, generating, progress, result, error, onCancel, onConfirm }: { readonly plan: GenerationPlan | null; readonly lines: readonly VoiceLine[]; readonly selectedKeys: readonly string[] | undefined; readonly generating: boolean; readonly progress: GenerationProgress | null; readonly result: GenerationResult | null; readonly error?: string | null; readonly onCancel: () => void; readonly onConfirm: () => void }) {
  if (result) return <aside className="voice-management-screen__generation-panel" aria-label="语音生成结果" aria-live="polite"><h2>{result.success ? '语音生成完成' : '语音生成结束'}</h2><p>成功：{result.generated}</p><p>失败：{result.failed}</p><p>跳过：{result.skipped}</p>{result.error ? <p className="voice-management-screen__generation-result-error">{result.error.code}: {result.error.message}</p> : null}<div><button type="button" onClick={onCancel}>关闭</button></div></aside>;
  if (!plan) return <aside className="voice-management-screen__generation-panel" aria-label="确认生成语音"><h2>确认生成语音</h2><p className="voice-management-screen__generation-panel-empty">选择单条“生成/更新”或“一键生成”后，此处会显示本次生成计划。</p>{error ? <p className="voice-management-screen__generation-result-error" role="status">{error}</p> : null}</aside>;
  const pending = plan.changed + plan.new + plan.missing;
  const selectedLine = selectedKeys?.length === 1 ? lines.find((line) => line.key === selectedKeys[0]) : undefined;
  return <aside className="voice-management-screen__generation-panel" aria-label="确认生成语音" aria-live={generating ? 'polite' : undefined}><h2>{selectedLine ? '确认生成单条语音' : '确认批量生成语音'}</h2>{selectedLine ? <><p>台词：{selectedLine.line}</p><p>实际 TTS：{effectiveTtsForDisplay(selectedLine)}</p></> : null}<p>待生成：{pending}</p><p>已修改：{plan.changed}</p><p>缺失：{plan.missing}</p><p>保持不变：{plan.unchanged}</p><p>预计消耗次数：{plan.apiCalls} 次</p>{generating && progress && progress.total > 0 ? <p role="status">当前进度：{progress.completed}/{progress.total}</p> : null}{error ? <p className="voice-management-screen__generation-result-error" role="status">{error}</p> : null}{plan.apiCalls === 0 ? <p>所有语音均为最新，无需生成。</p> : null}<div><button type="button" disabled={generating} onClick={onCancel}>{plan.apiCalls === 0 ? '关闭' : '取消'}</button>{plan.apiCalls > 0 ? <button type="button" disabled={generating} onClick={onConfirm}>{generating ? '生成中…' : '确认生成'}</button> : null}</div></aside>;
}

function useVoicePreview(volume: number) {
  const [playingKey, setPlayingKey] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const controllerRef = useRef<VoicePreviewController | null>(null);
  if (!controllerRef.current) controllerRef.current = new VoicePreviewController((url) => new Audio(url), (key, nextError) => { setPlayingKey(key); setError(nextError); });
  useEffect(() => () => controllerRef.current?.dispose(), []); useEffect(() => { controllerRef.current?.setVolume(volume); }, [volume]);
  useEffect(() => { const stop = () => controllerRef.current?.stop(); window.addEventListener('voice-pack-preview-stop', stop); return () => window.removeEventListener('voice-pack-preview-stop', stop); }, []);
  useEffect(() => { if (!error) return undefined; const timer = window.setTimeout(() => setError(null), 2500); return () => window.clearTimeout(timer); }, [error]);
  return { playingKey, error, playOrStop: (key: string, url: string) => controllerRef.current?.playOrStop(key, url, volume) };
}

export function filterVoiceLines(lines: readonly VoiceLine[], query: string): readonly VoiceLine[] { const normalized = query.trim().toLocaleLowerCase(); return normalized ? lines.filter((line) => [line.action, line.action_cn, line.line].some((value) => value?.toLocaleLowerCase().includes(normalized))) : lines; }

/** Search-only display grouping.  It intentionally never changes VoiceLine identity or persistence. */
export interface VoiceSearchLineGroup { readonly line: string; readonly lines: readonly VoiceLine[]; }

export function groupSearchVoiceLines(lines: readonly VoiceLine[]): readonly VoiceSearchLineGroup[] {
  const groups = new Map<string, VoiceLine[]>();
  for (const line of lines) {
    const displayLine = line.line.trim();
    const current = groups.get(displayLine);
    if (current) current.push(line); else groups.set(displayLine, [line]);
  }
  return [...groups.entries()].map(([line, groupedLines]) => ({ line, lines: groupedLines }));
}

type SearchDisplayStatus = VoiceGenerationStatus | 'generating';

function conciseStatusLabel(status: SearchDisplayStatus): string {
  return status === 'generated' ? '已生成' : status === 'changed' ? '已修改' : status === 'missing-audio' ? '音频缺失' : status === 'failed' ? '生成失败' : status === 'generating' ? '生成中' : '未生成';
}

/** A mixed search group never pretends that all of its independently-generated keys are current. */
export function searchGroupStatusSummary(lines: readonly VoiceLine[], statuses: Readonly<Record<string, SearchDisplayStatus | undefined>>): string {
  const counts = new Map<SearchDisplayStatus, number>();
  for (const line of lines) {
    const status = statuses[line.key] ?? 'not-generated';
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return [...counts.entries()].map(([status, count]) => counts.size === 1 ? conciseStatusLabel(status) : `${count} ${conciseStatusLabel(status)}`).join(' · ');
}

function searchVoiceLineIdentity(line: VoiceLine): string {
  return `${groupVoiceLines([line])[0]?.group.title ?? line.category} · ${line.key}`;
}

/** A duplicate display line is an expandable presentation group; each child keeps its own key and controls. */
export function VoiceSearchResultGroup({ group, expanded, statuses, onToggle, renderLine }: { readonly group: VoiceSearchLineGroup; readonly expanded: boolean; readonly statuses: Readonly<Record<string, SearchDisplayStatus | undefined>>; readonly onToggle: () => void; readonly renderLine: (line: VoiceLine) => ReactNode }) {
  return <section className="voice-management-screen__search-result-group">
    <button type="button" className="voice-management-screen__search-result-toggle" aria-expanded={expanded} onClick={onToggle}>
      <strong>{group.line}</strong><span>{group.lines.length} 条</span><span>{searchGroupStatusSummary(group.lines, statuses)}</span><span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
    </button>
    {expanded ? <div className="voice-management-screen__search-result-children">{group.lines.map(renderLine)}</div> : null}
  </section>;
}
/** Mirrors resolveEffectiveGenerationConfig(): empty overrides fall back to the normalized display line. */
export function effectiveTtsForDisplay(line: Pick<VoiceLine, 'line' | 'tts_text'>): string { return effectiveTtsText(line); }
export function insertTextControlAtSelection(text: string, token: string, start: number, end: number): string { return `${text.slice(0, start)}${token}${text.slice(end)}`; }
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
