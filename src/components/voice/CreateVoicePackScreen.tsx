import { useCallback, useEffect, useState } from 'react';
import { checkVoicePackService, LOCAL_VOICE_PACK_SERVICE, type CreateVoicePackInput, type CreateVoicePackResult, type VoicePackService } from '../../audio/voice/VoicePackService';
import { FISH_AUDIO_LANGUAGES, fishAudioLanguageById } from '../../audio/voice/fishAudioLanguages';

interface CreateVoicePackScreenProps { readonly onBack: () => void; readonly onCreated: (result: CreateVoicePackResult) => void; readonly service?: VoicePackService; }

/** Standalone creation flow. It creates Pack structure only and never starts audio generation. */
export function CreateVoicePackScreen({ onBack, onCreated, service = LOCAL_VOICE_PACK_SERVICE }: CreateVoicePackScreenProps) {
  const [input, setInput] = useState<CreateVoicePackInput>({ displayName: '', voiceId: '', locale: 'zh-CN', modelId: 'fishaudio-s21pro-flash' });
  const [languageId, setLanguageId] = useState('zh');
  const [confirming, setConfirming] = useState(false); const [creating, setCreating] = useState(false); const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const checkService = useCallback(async () => {
    setServiceStatus('loading');
    if (await checkVoicePackService(service) === 'available') { setServiceStatus('available'); setError(null); }
    else { setServiceStatus('unavailable'); setError('角色语音服务暂不可用。请通过 npm run dev 启动本地开发服务后重试。'); }
  }, [service]);
  useEffect(() => { void checkService(); }, [checkService]);
  const validate = () => {
    if (!input.displayName.trim()) return '角色名称不能为空。';
    if (!input.voiceId.trim()) return 'Fish Audio Voice ID 不能为空。';
    if (!input.modelId?.trim()) return '模型 ID 不能为空。';
    return null;
  };
  const openConfirmation = () => { if (serviceStatus !== 'available') return; const nextError = validate(); setError(nextError); if (!nextError) setConfirming(true); };
  const create = async () => {
    const nextError = validate(); if (nextError) { setError(nextError); return; }
    setCreating(true); setError(null);
    try { onCreated(await service.createPack(input)); } catch (cause) { setError(cause instanceof Error ? cause.message : '创建角色失败。'); setCreating(false); }
  };
  const unavailable = serviceStatus !== 'available';
  const language = fishAudioLanguageById(languageId);
  return <main className="voice-management-screen create-voice-pack-screen" aria-labelledby="create-voice-pack-title"><header className="voice-management-screen__header"><button type="button" onClick={onBack} disabled={creating}>← 返回</button><h1 id="create-voice-pack-title">创建角色语音</h1></header><section className="voice-management-screen__body"><div className="create-voice-pack-screen__form"><label>角色名称<input autoFocus value={input.displayName} disabled={creating} onChange={(event) => setInput({ ...input, displayName: event.target.value })} placeholder="例如：冷静女声" /></label><label>Fish Audio Voice ID<input value={input.voiceId} disabled={creating} onChange={(event) => setInput({ ...input, voiceId: event.target.value })} placeholder="粘贴 Voice ID，不是 API Key" /></label><label>语言<select aria-label="角色语言" value={languageId} disabled={creating} onChange={(event) => { const selected = fishAudioLanguageById(event.target.value); setLanguageId(selected.id); setInput(createVoicePackInputForLanguage(input, selected.id)); }}>{FISH_AUDIO_LANGUAGES.map((option) => <option key={option.id} value={option.id}>{option.flag} {option.displayName}</option>)}</select></label><label>模型 ID<input value={input.modelId} disabled={creating} onChange={(event) => setInput({ ...input, modelId: event.target.value })} placeholder="fishaudio-s21pro-flash" /></label>{serviceStatus === 'loading' ? <p role="status">正在检查角色语音服务…</p> : null}{error ? <p className="voice-management-screen__error" role="status">{error}</p> : null}{serviceStatus === 'unavailable' ? <button type="button" onClick={() => void checkService()}>重试连接</button> : null}{confirming ? <section className="create-voice-pack-screen__confirm" aria-label="创建摘要"><h2>确认创建</h2><p>角色名称：{input.displayName}</p><p>Voice ID：{input.voiceId}</p><p>语言：{language.flag} {language.displayName}</p><p>模型：{input.modelId}</p><p>语音条目：114</p><p>当前状态：0 / 114 已生成</p><p>本操作不会调用 Fish Audio，费用为 0。</p><button type="button" disabled={creating || unavailable} onClick={() => void create()}>{creating ? '创建中…' : unavailable ? '服务不可用' : '确认创建'}</button></section> : <button type="button" disabled={unavailable} onClick={openConfirmation}>{serviceStatus === 'loading' ? '正在检查服务…' : '创建角色'}</button>}</div></section></main>;
}

export function createVoicePackInputForLanguage(input: CreateVoicePackInput, languageId: string): CreateVoicePackInput {
  return { ...input, locale: fishAudioLanguageById(languageId).locale };
}
