import { useCallback, useEffect, useRef, useState } from 'react';
import { checkVoicePackService, LOCAL_VOICE_PACK_SERVICE, type CreateVoicePackInput, type CreateVoicePackResult, type VoiceModelCapability, type VoiceModelDiscoveryResult, type VoicePackService } from '../../audio/voice/VoicePackService';
import { FISH_AUDIO_LANGUAGES, fishAudioLanguageById } from '../../audio/voice/fishAudioLanguages';
import { fishCloneLanguageForLocale } from '../../audio/voice/fishCloneLanguages';
import { LOCAL_CREATED_VOICE_SERVICE, type CreatedVoice, type VoiceDesign, validateBrowserAudioDurations, validateBrowserFiles } from '../../audio/voice/CreatedVoiceService';
import { creditsLabel, VOICE_CREATION_PRICING } from '../../audio/voice/voiceCreationPricing';

interface CreateVoicePackScreenProps { readonly onBack: () => void; readonly onCreated: (result: CreateVoicePackResult) => void; readonly service?: VoicePackService; }
type DiscoveryState = 'idle' | 'loading' | 'ready' | 'error';

/** Standalone creation flow. Discovery only reads Fish metadata; it never starts audio generation. */
export function CreateVoicePackScreen({ onBack, onCreated, service = LOCAL_VOICE_PACK_SERVICE }: CreateVoicePackScreenProps) {
  const [input, setInput] = useState<CreateVoicePackInput>({ displayName: '', voiceId: '', locale: 'zh-CN', modelId: '' });
  const [languageId, setLanguageId] = useState('zh');
  const [discovery, setDiscovery] = useState<VoiceModelDiscoveryResult | null>(null);
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>('idle');
  const [confirming, setConfirming] = useState(false); const [creating, setCreating] = useState(false); const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const [createdVoices, setCreatedVoices] = useState<readonly CreatedVoice[]>([]);
  const [registryState, setRegistryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const requestSequence = useRef(0);
  const checkService = useCallback(async () => {
    setServiceStatus('loading');
    if (await checkVoicePackService(service) === 'available') { setServiceStatus('available'); setError(null); }
    else { setServiceStatus('unavailable'); setError('角色语音服务暂不可用。请通过 npm run dev 启动本地开发服务后重试。'); }
  }, [service]);
  useEffect(() => { void checkService(); }, [checkService]);
  const refreshRegistry = useCallback(async () => { setRegistryState('loading'); try { setCreatedVoices(await LOCAL_CREATED_VOICE_SERVICE.list()); setRegistryState('ready'); } catch { setRegistryState('error'); } }, []);
  useEffect(() => { void refreshRegistry(); }, [refreshRegistry]);
  const discoverModels = useCallback(async () => {
    const voiceId = input.voiceId.trim();
    if (!voiceId) { setDiscovery(null); setDiscoveryState('idle'); return; }
    const sequence = ++requestSequence.current;
    setDiscovery(null); setDiscoveryState('loading'); setInput((current) => ({ ...current, modelId: '' })); setConfirming(false); setError(null);
    try {
      const next = await service.discoverVoiceModels(voiceId);
      if (!shouldApplyDiscoveryResponse(requestSequence.current, sequence, input.voiceId, voiceId)) return;
      setDiscovery(next); setDiscoveryState('ready'); setInput((current) => ({ ...current, modelId: chooseDefaultCompatibleModel(next) ?? '' }));
    } catch (cause) {
      if (!shouldApplyDiscoveryResponse(requestSequence.current, sequence, input.voiceId, voiceId)) return;
      setDiscoveryState('error'); setError(cause instanceof Error ? cause.message : '模型信息加载失败，请稍后重试。');
    }
  }, [input.voiceId, service]);
  const resetVoiceModels = (voiceId: string) => {
    requestSequence.current += 1; setDiscovery(null); setDiscoveryState('idle'); setConfirming(false); setError(null);
    setInput((current) => ({ ...current, voiceId, modelId: '' }));
  };
  const useCreatedVoice = useCallback(async (voice: CreatedVoice) => {
    const voiceId = voice.voiceId.trim(); resetVoiceModels(voiceId); const sequence = ++requestSequence.current;
    setDiscoveryState('loading'); setError(null);
    try {
      const next = await service.discoverVoiceModels(voiceId);
      if (!shouldApplyDiscoveryResponse(requestSequence.current, sequence, voiceId, voiceId)) return;
      setDiscovery(next); setDiscoveryState('ready'); setInput((current) => ({ ...current, voiceId, modelId: chooseDefaultCompatibleModel(next) ?? '' }));
    } catch (cause) { setDiscoveryState('error'); setError(cause instanceof Error ? cause.message : '模型信息加载失败，请稍后重试。'); }
  }, [service]);
  const validate = () => {
    if (!input.displayName.trim()) return '角色名称不能为空。';
    if (!input.voiceId.trim()) return 'Fish Audio Voice ID 不能为空。';
    if (discoveryState !== 'ready' || discovery?.voiceId !== input.voiceId.trim()) return '请先检查 Voice 并加载兼容模型。';
    if (!discovery.compatibleModels.length) return '当前没有可用于此 Voice 的 TTS 模型。';
    if (!input.modelId || !discovery.compatibleModels.some((model) => model.modelId === input.modelId)) return '请选择一个兼容模型。';
    return null;
  };
  const openConfirmation = () => { if (serviceStatus !== 'available') return; const nextError = validate(); setError(nextError); if (!nextError) setConfirming(true); };
  const create = async () => {
    const nextError = validate(); if (nextError) { setError(nextError); return; }
    setCreating(true); setError(null);
    try { onCreated(await service.createPack({ ...input, ttsControls: discovery?.compatibleModels.find((model) => model.modelId === input.modelId)?.controls })); } catch (cause) { setError(cause instanceof Error ? cause.message : '创建角色失败。'); setCreating(false); }
  };
  const unavailable = serviceStatus !== 'available';
  const language = fishAudioLanguageById(languageId);
  const selectedModel = discovery?.compatibleModels.find((model) => model.modelId === input.modelId);
  const creationDisabled = unavailable || creating || !canCreateWithDiscovery(input, discovery, discoveryState);
  return <main className="voice-management-screen create-voice-pack-screen" aria-labelledby="create-voice-pack-title"><header className="voice-management-screen__header"><button type="button" onClick={onBack} disabled={creating}>← 返回</button><h1 id="create-voice-pack-title">创建角色语音</h1></header><section className="voice-management-screen__body create-voice-pack-screen__workspace"><div className="create-voice-pack-screen__form"><label>角色名称<input autoFocus value={input.displayName} disabled={creating} onChange={(event) => { setConfirming(false); setInput({ ...input, displayName: event.target.value }); }} placeholder="例如：冷静女声" /></label><label>Fish Audio Voice ID<input value={input.voiceId} disabled={creating} onChange={(event) => resetVoiceModels(event.target.value)} onBlur={() => void discoverModels()} placeholder="粘贴 Voice ID，不是 API Key" /></label><label>语言<select aria-label="角色语言" value={languageId} disabled={creating} onChange={(event) => { const selected = fishAudioLanguageById(event.target.value); setLanguageId(selected.id); setInput(createVoicePackInputForLanguage(input, selected.id)); }}>{FISH_AUDIO_LANGUAGES.map((option) => <option key={option.id} value={option.id}>{option.flag} {option.displayName}</option>)}</select></label><label>模型<select aria-label="兼容模型" value={input.modelId ?? ''} disabled={creating || discoveryState !== 'ready' || !discovery?.compatibleModels.length} onChange={(event) => { setConfirming(false); setInput({ ...input, modelId: event.target.value }); }}><option value="">请选择模型</option>{discovery?.compatibleModels.map((model) => <option key={model.modelId} value={model.modelId}>{model.displayName} — {model.modelId}</option>)}</select></label>{discoveryState === 'loading' ? <p role="status">正在检查 Voice 与兼容模型…</p> : null}{discoveryState === 'ready' && discovery?.compatibleModels.length ? <><p role="status">✓ Voice 可用</p><ModelCapabilities model={selectedModel} /></> : null}{discoveryState === 'ready' && !discovery?.compatibleModels.length ? <p className="voice-management-screen__error" role="status">当前没有可用于此 Voice 的 TTS 模型。</p> : null}{error ? <p className="voice-management-screen__error" role="status">{error}</p> : null}{serviceStatus === 'loading' ? <p role="status">正在检查角色语音服务…</p> : null}{serviceStatus === 'unavailable' ? <button type="button" onClick={() => void checkService()}>重试连接</button> : null}{confirming ? <section className="create-voice-pack-screen__confirm" aria-label="创建摘要"><h2>确认创建</h2><p>角色名称：{input.displayName}</p><p>Voice ID：{input.voiceId}</p><p>语言：{language.flag} {language.displayName}</p><p>模型：{selectedModel?.displayName}（{input.modelId}）</p><p>语音条目：148</p><p>当前状态：0 / 148 已生成</p><p>本操作不会调用 Fish Audio TTS，费用为 0。</p><button type="button" disabled={creationDisabled} onClick={() => void create()}>{creating ? '创建中…' : unavailable ? '服务不可用' : '确认创建'}</button></section> : <button type="button" disabled={creationDisabled} onClick={openConfirmation}>{serviceStatus === 'loading' ? '正在检查服务…' : discoveryState === 'loading' ? '正在加载模型…' : '创建角色'}</button>}</div><GeneratedVoiceRegistry voices={createdVoices} state={registryState} onRefresh={refreshRegistry} onUse={useCreatedVoice} /><VoiceClonePanel onStored={refreshRegistry} onUse={useCreatedVoice} suggestedLanguage={input.locale} /><VoiceDesignPanel onStored={refreshRegistry} onUse={useCreatedVoice} /></section></main>;
}

function GeneratedVoiceRegistry({ voices, state, onRefresh, onUse }: { readonly voices: readonly CreatedVoice[]; readonly state: 'loading' | 'ready' | 'error'; readonly onRefresh: () => Promise<void>; readonly onUse: (voice: CreatedVoice) => Promise<void> }) {
  const [pendingDeletion, setPendingDeletion] = useState<CreatedVoice | null>(null); const [removing, setRemoving] = useState(false); const [removeError, setRemoveError] = useState<string | null>(null);
  const copy = async (voiceId: string) => { await navigator.clipboard?.writeText(voiceId).catch(() => undefined); };
  const remove = async (cloud: boolean) => { if (!pendingDeletion) return; setRemoving(true); setRemoveError(null); try { cloud ? await LOCAL_CREATED_VOICE_SERVICE.deleteCloudVoice(pendingDeletion.voiceId) : await LOCAL_CREATED_VOICE_SERVICE.remove(pendingDeletion.voiceId); setPendingDeletion(null); await onRefresh(); } catch (cause) { setRemoveError(cause instanceof Error ? cause.message : '删除音色失败。'); } finally { setRemoving(false); } };
  return <section className="create-voice-panel create-voice-pack-screen__registry" aria-labelledby="generated-voices-title"><div className="create-voice-panel__heading"><h2 id="generated-voices-title">已生成音色</h2><button type="button" onClick={() => void onRefresh()}>刷新</button></div>{state === 'loading' ? <p role="status">正在加载本地音色…</p> : state === 'error' ? <p className="voice-management-screen__error">本地音色列表加载失败。</p> : !voices.length ? <p>尚未保存本地生成的音色。</p> : <div className="created-voice-list" role="list">{voices.map((voice) => { const inUse = voice.source === 'existing' || Boolean(voice.linkedPackIds?.length); return <div className="created-voice-list__row" role="listitem" key={voice.voiceId}><button type="button" className="created-voice-list__select" onClick={() => void onUse(voice)}><strong>{voice.name}</strong><span>{voice.voiceId}</span><small>{createdVoiceSourceLabel(voice.source)}</small></button><button type="button" aria-label={`复制 ${voice.name} Voice ID`} onClick={() => void copy(voice.voiceId)}>复制 ID</button><button type="button" disabled={inUse} title={inUse ? '正在被角色使用' : undefined} onClick={() => setPendingDeletion(voice)}>{inUse ? '正在被角色使用' : '删除'}</button></div>; })}</div>}{pendingDeletion ? <section className="create-voice-panel__result" role="dialog"><strong>删除音色？</strong><span>本地移除只删除记录；云端删除不可恢复。</span>{removeError ? <p className="voice-management-screen__error">{removeError}</p> : null}<div><button type="button" disabled={removing} onClick={() => void remove(false)}>移除本地记录</button><button type="button" disabled={removing} onClick={() => void remove(true)}>删除 Fish 云端音色</button><button type="button" disabled={removing} onClick={() => setPendingDeletion(null)}>取消</button></div></section> : null}</section>;
}

function VoiceClonePanel({ onStored, onUse, suggestedLanguage }: { readonly onStored: () => Promise<void>; readonly onUse: (voice: CreatedVoice) => Promise<void>; readonly suggestedLanguage: string | undefined }) {
  const defaultLanguage = fishCloneLanguageForLocale(suggestedLanguage) ?? 'zh'; const [cloneLanguage, setCloneLanguage] = useState(defaultLanguage); const [languageTouched, setLanguageTouched] = useState(false);
  useEffect(() => { if (!languageTouched) setCloneLanguage(defaultLanguage); }, [defaultLanguage, languageTouched]);
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [referenceText, setReferenceText] = useState(''); const [files, setFiles] = useState<File[]>([]); const [authorized, setAuthorized] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [created, setCreated] = useState<CreatedVoice | null>(null); const [compatibleModels, setCompatibleModels] = useState<readonly VoiceModelCapability[]>([]);
  const submit = async () => { if (busy) return; try { validateBrowserFiles(files); await validateBrowserAudioDurations(files); if (!authorized) throw new Error('请先确认拥有合法使用权或必要授权。'); setBusy(true); setError(null); const voice = await LOCAL_CREATED_VOICE_SERVICE.clone({ name, description, referenceText, audioFiles: files, language: cloneLanguage }); setCreated(voice); await onStored(); try { setCompatibleModels((await LOCAL_VOICE_PACK_SERVICE.discoverVoiceModels(voice.voiceId)).compatibleModels); } catch { setCompatibleModels([]); } } catch (cause) { setError(cause instanceof Error ? cause.message : '创建音色失败。'); } finally { setBusy(false); } };
  const deleted = async () => { if (!created) return; await LOCAL_CREATED_VOICE_SERVICE.deleteCloudVoice(created.voiceId); setCreated(null); await onStored(); };
  return <section className="create-voice-panel create-voice-pack-screen__clone" aria-labelledby="voice-clone-title"><h2 id="voice-clone-title">声音克隆</h2><label>音色名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>音色语言<select aria-label="Clone 音色语言" value={cloneLanguage} onChange={(event) => { setLanguageTouched(true); setCloneLanguage(event.target.value); }}>{FISH_AUDIO_LANGUAGES.map((language) => { const normalized = fishCloneLanguageForLocale(language.locale); return normalized ? <option key={language.id} value={normalized}>{language.flag} {language.displayName}</option> : null; })}</select></label><label>参考音频<input aria-label="参考音频" type="file" accept=".wav,.mp3,.m4a,.ogg,.flac,audio/*" multiple onChange={(event) => { const next = Array.from(event.target.files ?? []); void (async () => { try { validateBrowserFiles(next); await validateBrowserAudioDurations(next); setFiles(next); setError(null); } catch (cause) { setFiles([]); setError(cause instanceof Error ? cause.message : '参考音频无效。'); } })(); }} /></label>{files.length ? <p>已选择 {files.length} 个参考音频。建议时长 10–20 秒，总时长不得超过 60 秒。</p> : null}<label>参考文本（可选）<textarea value={referenceText} onChange={(event) => setReferenceText(event.target.value)} /></label><label>描述（可选）<input value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="create-voice-panel__authorization"><input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} /> 我确认拥有该声音的合法使用权或已取得必要授权</label>{error ? <p className="voice-management-screen__error">{error}</p> : null}<button type="button" disabled={busy || !authorized} onClick={() => void submit()}>{busy ? '创建中…' : `创建音色 · 预计 ${VOICE_CREATION_PRICING.clone.amount} ${VOICE_CREATION_PRICING.clone.unit}`}</button>{created ? <CreatedVoiceResult voice={created} onUse={onUse} clone models={compatibleModels} onDelete={deleted} /> : null}</section>;
}

export interface VoiceDesignPreset { readonly id: string; readonly label: string; readonly prompt: string; }
export const VOICE_DESIGN_PRESET_GROUPS: readonly { readonly label: string; readonly presets: readonly VoiceDesignPreset[] }[] = [
  { label: '女性', presets: [
    { id: 'clear-spring-girl', label: '清泉少女', prompt: '25岁女生，声音像清泉一样清澈，带一点甜美的鼻音，说话轻快有活力。音色自然明亮，咬字清晰，语气亲切灵动，但不过度幼态，适合轻松活泼的年轻女性角色。' },
    { id: 'calm-girl', label: '冷静少女', prompt: '20岁左右的年轻女生，音色清冷干净，声音偏轻但有清晰的穿透力。说话节奏稳定，情绪克制，语气冷静而自信，偶尔带一点疏离感，适合沉着理性的少女角色。' },
    { id: 'energetic-girl', label: '元气少女', prompt: '18到22岁的年轻女生，声音明亮甜美，语调活泼，讲话节奏稍快，充满朝气和积极情绪。笑意自然，能表现兴奋和胜利感，但避免过度卡通化。' },
    { id: 'gentle-sister', label: '温柔姐姐', prompt: '28岁左右的女性，声音柔和温暖，音色细腻自然，语速中等偏慢。说话有耐心和亲和力，尾音柔和，给人可靠、包容和安心的感觉。' },
    { id: 'mature-woman', label: '成熟女性', prompt: '30到35岁的成熟女性，声音沉稳优雅，中低音较丰富，咬字清晰。语气自信从容，情绪表达细腻但不过分夸张，适合成熟、可靠或具有领导气质的角色。' },
    { id: 'cold-queen', label: '高冷女王', prompt: '30岁左右的女性，声音低沉冷艳，语气坚定，自信而具有压迫感。讲话节奏从容，咬字清晰利落，情绪克制，带有明显的主导感和距离感。' },
    { id: 'lazy-woman', label: '慵懒女性', prompt: '25到30岁的女性，声音柔软偏低，略带慵懒和松弛感。说话节奏稍慢，尾音自然延长，情绪随意而从容，像刚睡醒但仍保持清晰自然的表达。' },
  ] },
  { label: '男性', presets: [
    { id: 'passionate-young-man', label: '热血青年', prompt: '20多岁的年轻男性，声音明亮有力量，中高音富有穿透力。讲话节奏较快，情绪充沛，充满自信和竞争感，适合热血、好胜、容易兴奋的青年角色。' },
    { id: 'sunny-young-man', label: '阳光青年', prompt: '22到28岁的年轻男性，声音自然清爽，音色明亮但不过分尖锐。讲话轻松、有笑意，语气友善积极，适合开朗亲切、容易相处的年轻男性角色。' },
    { id: 'cool-young-man', label: '冷峻青年', prompt: '25岁左右男性，声音偏低沉，音色干净冷静，讲话简洁克制。语速稳定，情绪波动较少，带有距离感和理性气质，适合沉着寡言的男性角色。' },
    { id: 'mature-man', label: '成熟男性', prompt: '35到45岁的男性，声音厚实沉稳，中低频丰富，讲话节奏从容。咬字清晰，语气可靠自信，有一定威严感但不过度严肃。' },
    { id: 'elderly-man', label: '老年男性', prompt: '60岁以上男性，声音低沉而略带沙哑，语速偏慢，有明显的人生阅历感。表达沉稳自然，语气温和而有分量，避免刻意夸张老态。' },
  ] },
  { label: '职业 / 风格', presets: [
    { id: 'mystery-narrator', label: '悬疑播音员', prompt: '讲述悬疑故事的专业播音员，声音低沉富有磁性，语速在关键位置有明显快慢变化。语气克制、神秘，能营造紧张和未知感，同时保持清晰专业的叙述。' },
    { id: 'gentle-narrator', label: '温柔旁白', prompt: '专业旁白声音，音色温暖自然，语速平稳，中低音柔和。情绪表达克制而细腻，具有亲和力和故事感，适合长时间聆听，不产生明显压迫感。' },
    { id: 'passionate-commentator', label: '热血解说', prompt: '年轻体育或电竞解说员，声音清晰有穿透力，语速较快，情绪充沛。关键时刻能够明显提升音量和兴奋度，表现紧张、惊喜和胜利感，同时保持台词清楚易懂。' },
    { id: 'steady-host', label: '沉稳主持', prompt: '30到40岁的专业主持人，声音稳定清晰，中低音自然，吐字标准。讲话节奏适中，语气正式但不僵硬，具有较强的可信度和掌控力。' },
  ] },
];
export function selectedVoiceDesignPreset(prompt: string): string | undefined { return VOICE_DESIGN_PRESET_GROUPS.flatMap((group) => group.presets).find((preset) => preset.prompt === prompt)?.id; }
function createdVoiceSourceLabel(source: CreatedVoice['source']): string { return source === 'existing' ? '已有角色' : source === 'design' ? '音色设计' : '声音克隆'; }
function VoiceDesignPanel({ onStored, onUse }: { readonly onStored: () => Promise<void>; readonly onUse: (voice: CreatedVoice) => Promise<void> }) {
  const [prompt, setPrompt] = useState(''); const [previewText, setPreviewText] = useState('你好，这是新设计的角色声音。'); const [providers, setProviders] = useState<('fishaudio' | 'minimax')[]>(['fishaudio']); const [design, setDesign] = useState<VoiceDesign | null>(null); const [candidateId, setCandidateId] = useState(''); const [name, setName] = useState(''); const [creating, setCreating] = useState(false); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState<CreatedVoice | null>(null); const [playing, setPlaying] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const audio = useRef<HTMLAudioElement | null>(null);
  const toggleProvider = (provider: 'fishaudio' | 'minimax') => setProviders((current) => current.includes(provider) ? current.filter((value) => value !== provider) : [...current, provider]);
  const create = async () => { if (creating) return; try { if (prompt.length > 2000 || previewText.length > 150) throw new Error('请将音色描述控制在 2000 字以内、试听文本控制在 150 字以内。'); setCreating(true); setError(null); setDesign(await LOCAL_CREATED_VOICE_SERVICE.createDesign({ prompt, previewText, providers })); setCandidateId(''); } catch (cause) { setError(cause instanceof Error ? cause.message : '生成候选失败。'); } finally { setCreating(false); } };
  const preview = async (candidate: string) => { try { audio.current?.pause(); setPlaying(candidate); const blob = await LOCAL_CREATED_VOICE_SERVICE.candidateAudio(design?.designId ?? '', candidate); const url = URL.createObjectURL(blob); const element = new Audio(url); audio.current = element; element.onended = () => { URL.revokeObjectURL(url); setPlaying(null); }; await element.play(); } catch (cause) { setPlaying(null); setError(cause instanceof Error ? cause.message : '候选试听失败。'); } };
  const save = async () => { if (!design || !candidateId || saving) return; try { setSaving(true); setError(null); const voice = await LOCAL_CREATED_VOICE_SERVICE.saveDesign(design.designId, { candidateId, name }); setSaved(voice); await onStored(); } catch (cause) { setError(cause instanceof Error ? cause.message : '保存音色失败。'); } finally { setSaving(false); } };
  const selectedPreset = selectedVoiceDesignPreset(prompt);
  const selectedCandidate = design?.candidates.find((candidate) => candidate.candidateId === candidateId);
  const previewCost = providers.reduce((sum, provider) => sum + VOICE_CREATION_PRICING.designPreviewByProvider[provider], 0);
  const saveCost = selectedCandidate ? VOICE_CREATION_PRICING.designSaveByProvider[selectedCandidate.provider as 'fishaudio' | 'minimax'] : undefined;
  return <section className="create-voice-panel create-voice-pack-screen__design" aria-labelledby="voice-design-title"><h2 id="voice-design-title">音色设计</h2>{VOICE_DESIGN_PRESET_GROUPS.map((group) => <div className="create-voice-panel__preset-group" key={group.label}><h3>{group.label}</h3><div className="create-voice-panel__templates">{group.presets.map((preset) => <button type="button" className={selectedPreset === preset.id ? 'is-selected' : undefined} key={preset.id} onClick={() => setPrompt(preset.prompt)}>{preset.label}</button>)}</div></div>)}<label>音色描述<textarea maxLength={2000} value={prompt} onChange={(event) => setPrompt(event.target.value)} /><small>{prompt.length} / 2000</small></label><label>试听文本<textarea maxLength={150} value={previewText} onChange={(event) => setPreviewText(event.target.value)} /><small>{previewText.length} / 150</small></label><fieldset className="create-voice-panel__providers"><legend>Provider</legend><label className="create-voice-panel__provider-option"><input type="checkbox" checked={providers.includes('fishaudio')} onChange={() => toggleProvider('fishaudio')} /> <span>Fish Audio</span></label><label className="create-voice-panel__provider-option"><input type="checkbox" checked={providers.includes('minimax')} onChange={() => toggleProvider('minimax')} /> <span>MiniMax</span></label></fieldset>{!providers.length ? <p className="voice-management-screen__error">请选择至少一个音色生成 Provider。</p> : null}<button type="button" disabled={creating || !prompt.trim() || !previewText.trim() || !providers.length} onClick={() => void create()}>{creating ? '生成候选中…' : `生成候选 · 预计 ${creditsLabel(previewCost)}`}</button>{design ? <div className="voice-design-candidates"><h3>候选</h3>{design.candidates.map((candidate) => <div key={candidate.candidateId}><label><input type="checkbox" checked={candidateId === candidate.candidateId} onChange={() => setCandidateId((current) => current === candidate.candidateId ? '' : candidate.candidateId)} /> {candidate.label}（{candidate.provider}）</label><button type="button" onClick={() => void preview(candidate.candidateId)}>{playing === candidate.candidateId ? '试听中…' : '▶ 试听'}</button></div>)}<label>音色名称<input value={name} onChange={(event) => setName(event.target.value)} /></label>{!candidateId ? <p role="status">请先选择一个候选音色。</p> : null}<button type="button" disabled={saving || !candidateId || !name.trim()} onClick={() => void save()}>{saving ? '保存中…' : `保存此音色 · ${creditsLabel(saveCost ?? 0)}`}</button></div> : null}{saved ? <CreatedVoiceResult voice={saved} onUse={onUse} /> : null}{error ? <p className="voice-management-screen__error">{error}</p> : null}</section>;
}

function CreatedVoiceResult({ voice, onUse, clone = false, models = [], onDelete }: { readonly voice: CreatedVoice; readonly onUse: (voice: CreatedVoice) => void; readonly clone?: boolean; readonly models?: readonly VoiceModelCapability[]; readonly onDelete?: () => Promise<void> }) {
  const [previewText, setPreviewText] = useState('你好，这是新克隆的角色声音。'); const [modelId, setModelId] = useState(''); const [previewing, setPreviewing] = useState(false); const [confirmingDelete, setConfirmingDelete] = useState(false); const [error, setError] = useState<string | null>(null); const audio = useRef<HTMLAudioElement | null>(null);
  const preview = async () => { if (!modelId.trim()) { setError('请选择一个兼容模型后再生成试听。'); return; } try { setPreviewing(true); setError(null); audio.current?.pause(); const blob = await LOCAL_CREATED_VOICE_SERVICE.previewClone(voice.voiceId, { modelId, text: previewText }); const url = URL.createObjectURL(blob); const element = new Audio(url); audio.current = element; element.onended = () => URL.revokeObjectURL(url); await element.play(); } catch (cause) { setError(cause instanceof Error ? cause.message : '试听失败。'); } finally { setPreviewing(false); } };
  const remove = async () => { try { await onDelete?.(); } catch (cause) { setError(cause instanceof Error ? cause.message : '删除音色失败。'); } };
  return <section className="create-voice-panel__result" role="status"><strong>创建成功</strong><span>名称：{voice.name}</span><span>Voice ID：{voice.voiceId}</span>{clone ? <><span>创建消耗：{VOICE_CREATION_PRICING.clone.amount} {VOICE_CREATION_PRICING.clone.unit}</span><label>兼容模型<select aria-label="克隆兼容模型" value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={!models.length}><option value="">{models.length ? '请选择模型' : '正在加载兼容模型…'}</option>{models.map((model) => <option key={model.modelId} value={model.modelId}>{model.displayName} — {model.modelId}</option>)}</select></label><label>试听文本<input value={previewText} onChange={(event) => setPreviewText(event.target.value)} /></label><button type="button" disabled={previewing || !previewText.trim() || !modelId} onClick={() => void preview()}>{previewing ? '生成试听中…' : '生成试听'}</button></> : null}<button type="button" onClick={() => onUse(voice)}>使用此音色</button>{clone && onDelete ? (confirmingDelete ? <><p>删除 Fish 云端音色后无法恢复。</p><button type="button" onClick={() => void remove()}>确认删除音色</button><button type="button" onClick={() => setConfirmingDelete(false)}>取消</button></> : <button type="button" onClick={() => setConfirmingDelete(true)}>删除音色</button>) : null}{error ? <p className="voice-management-screen__error">{error}</p> : null}</section>;
}

function ModelCapabilities({ model }: { readonly model?: VoiceModelCapability }) {
  if (!model) return null;
  const labels: readonly [keyof VoiceModelCapability['controls'], string][] = [['speed', '语速'], ['volume', '音量'], ['stability', '稳定性'], ['similarity', '相似度'], ['language', '语言'], ['textNormalization', '文本归一化'], ['emotion', '情绪'], ['instruction', '指令']];
  const supported = labels.filter(([control]) => model.controls[control]).map(([, label]) => label);
  return supported.length ? <p className="create-voice-pack-screen__capabilities">模型能力：{supported.map((label) => `✓ ${label}`).join('　')}</p> : null;
}

export function chooseDefaultCompatibleModel(result: Pick<VoiceModelDiscoveryResult, 'compatibleModels' | 'recommendedModelId'>): string | undefined {
  if (result.recommendedModelId && result.compatibleModels.some((model) => model.modelId === result.recommendedModelId)) return result.recommendedModelId;
  return result.compatibleModels[0]?.modelId;
}

export function canCreateWithDiscovery(input: CreateVoicePackInput, discovery: VoiceModelDiscoveryResult | null, state: DiscoveryState): boolean {
  return Boolean(input.displayName.trim() && input.voiceId.trim() && input.modelId && state === 'ready' && discovery?.voiceId === input.voiceId.trim()
    && discovery.compatibleModels.some((model) => model.modelId === input.modelId));
}

/** Ignores slow Voice A responses after the form has moved on to Voice B. */
export function shouldApplyDiscoveryResponse(currentSequence: number, responseSequence: number, currentVoiceId: string, responseVoiceId: string): boolean {
  return currentSequence === responseSequence && currentVoiceId.trim() === responseVoiceId;
}

export function createVoicePackInputForLanguage(input: CreateVoicePackInput, languageId: string): CreateVoicePackInput {
  return { ...input, locale: fishAudioLanguageById(languageId).locale };
}
