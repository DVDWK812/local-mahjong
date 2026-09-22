import { useEffect, useMemo, useRef, useState } from 'react';
import { getTileAlt } from '../../game/tileAssets';
import { Board } from '../../components/Board';
import { SeventeenStepsScreen } from '../../components/SeventeenStepsScreen';
import { getRulePreset } from '../../game/match/matchRules';
import { applyOfficialTestModeAction, type OfficialTestModeAction } from '../../game/testMode/actions';
import { AudioManager } from '../../audio/AudioManager';
import { AudioPresentationConsumer } from '../../audio/AudioPresentationConsumer';
import { GAME_SFX_GROUP_BY_ACTION } from '../../audio/musicRegistry';
import type { GameSfxId } from '../../audio/musicTypes';
import { MusicLibrary } from '../../audio/musicLibrary';
import { createMusicLibraryStorage } from '../../audio/musicLibraryStorage';
import { DEFAULT_AUDIO_SETTINGS } from '../../audio/audioSettings';
import { createDefaultAudioBackend } from '../../audio/audioBackend';
import { presentationEventBus } from '../../presentation/PresentationEventBus';
import { presentationPacingGate } from '../../presentation/pacing/PresentationPacingGate';
import { QaMotionContext } from '../../presentation/animation/QaMotionContext';
import { loadAppearanceSettings } from '../../presentation/appearance/appearanceSettingsStorage';
import { finalGateRoute } from './route';
import { createFourGateFixture, createSeventeenGateFixture, finalGateScenarios, gateAction, isSeventeenGate } from './scenarios';
import './finalGate.css';

type Trace = { at: number; type: string; detail: string };
export default function FinalGate() {
  const [index, setIndex] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [replay, setReplay] = useState(false);
  const [active, setActive] = useState(true);
  const [audioOn, setAudioOn] = useState(() => finalGateRoute(location.search, import.meta.env.DEV).audio);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [reduced, setReduced] = useState(false);
  const [sweepCheck, setSweepCheck] = useState<{ at: number; counts: string } | null>(null);
  const [inspection, setInspection] = useState('');
  const [cueCounts, setCueCounts] = useState<Record<string, number>>({});
  const [trace, setTrace] = useState<Trace[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean[]>>({});
  const scenario = finalGateScenarios[index];
  const policy = useRef({ audioOn, muted }); policy.current = { audioOn, muted };
  const audio = useRef<AudioManager | null>(null);
  const motion = useMemo(() => ({ speed, reduced }), [speed, reduced]);
  const [ready, setReady] = useState(false);
  const [appearance] = useState(() => loadAppearanceSettings(localStorage));

  useEffect(() => {
    let live = true;
    const log = (type: string, detail: string) => { if (live) setTrace(rows => [...rows, { at: performance.now(), type, detail }].slice(-10)); };
    const backend = createDefaultAudioBackend();
    const create = backend.createPlayback.bind(backend);
    backend.createPlayback = asset => {
      log('媒体创建', `${asset.id} ${asset.src}`);
      const handle = create(asset), play = handle.play.bind(handle);
      handle.onEnded(() => log('媒体结束', asset.id));
      handle.onError?.(() => log('媒体错误', asset.id));
      handle.play = async () => {
        try { await play(); log('媒体开始', asset.id); }
        catch (error) { log('播放失败', `${asset.id}: ${String(error)}`); throw error; }
      };
      return handle;
    };
    // Builtins in an isolated memory catalog. Neither selection cursors nor settings touch storage.
    const library = new MusicLibrary(createMusicLibraryStorage(null as unknown as IDBFactory));
    const manager = new AudioManager(DEFAULT_AUDIO_SETTINGS, backend);
    manager.setMusicLibrary(library); audio.current = manager;
    const consumer = new AudioPresentationConsumer(manager, undefined, () => active && policy.current.audioOn,
      (cue, sound, allowed) => {
        const group = sound ? GAME_SFX_GROUP_BY_ACTION[sound as GameSfxId] ?? sound : undefined;
        if (live) setCueCounts(counts => { const key = `${cue.event.eventId} ${cue.kind} → ${group}`; return { ...counts, [key]: (counts[key] ?? 0) + 1 }; });
        log('语义节点', `${cue.event.eventId} ${cue.event.type} ${cue.phase}@${cue.progress} ${cue.kind} → ${group}；${allowed ? '允许' : '静音策略'}；generation=${cue.generation}`); });
    const unsubscribe = presentationEventBus.subscribe(event => log('正式事件', `${event.eventId} ${event.type}`));
    void library.initialize().then(() => { if (live) setReady(true); });
    return () => { live = false; unsubscribe(); consumer.dispose(); manager.dispose(); library.dispose(); audio.current = null; };
  }, [generation, index, active]);

  useEffect(() => {
    audio.current?.setSettings({ ...DEFAULT_AUDIO_SETTINGS, sfxEnabled: !muted });
    if (!audioOn || muted) audio.current?.stopSfx();
  }, [audioOn, muted, generation, index, active]);

  const reset = (next = index, replayAction = false) => {
    setReplay(replayAction); setSweepCheck(null); setInspection('');
    audio.current?.stopSfx(); setReady(false); setTrace([]); setCueCounts({}); setActive(true); setIndex(next); setGeneration(value => value + 1);
  };
  useEffect(() => {
    if (!ready || !active || !replay) return;
    let done = false;
    const start = () => {
      if (isSeventeenGate(scenario.id) && !document.querySelector('[data-qa-animation-ready="true"]')) return;
      if (done || !document.querySelector('[data-presentation-revealed="true"], [data-initial-scene-ready="true"][data-local-presentation-ready="true"][data-critical-hand-packs-ready="true"]')) return;
      if (scenario.id === 'AV-17' || scenario.id === 'VIS-01' || scenario.id === 'VIS-03') { done = true; observer.disconnect(); return; }
      const button = scenario.id === 'AV-18'
        ? [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === '荣和')
        : document.querySelector<HTMLButtonElement>(isSeventeenGate(scenario.id)
        ? '.seventeen-steps-candidate-grid button:not(:disabled)' : '.final-gate-action button');
      if (!button) return;
      done = true; observer.disconnect(); button.click();
    };
    const observer = new MutationObserver(start);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    start();
    return () => observer.disconnect();
  }, [ready, active, replay, generation, scenario.id]);
  const stage = useMemo(() => !active || !ready ? null : isSeventeenGate(scenario.id)
    ? <SeventeenStepsScreen key={`${scenario.id}-${generation}`} initialState={createSeventeenGateFixture(scenario.id)} qaHideResult={scenario.id.startsWith('VIS-')} ruleConfig={getRulePreset('east-round')}
      appearanceSettings={appearance} onBack={() => setActive(false)} />
    : <FourScenario key={`${scenario.id}-${generation}`} id={scenario.id} appearance={appearance} onExit={() => setActive(false)} />,
  [active, ready, scenario.id, generation, appearance]);
  const labels = scenario.id.startsWith('VIS-') ? ['牌河可辨认且无遮挡', '落点与比例正确', '过渡自然且无跳动', '无残留或重复牌'] : ['视觉动作正确', '声音时机自然', '只播放一次', '无额外声音'];
  return <QaMotionContext.Provider value={motion}>
    {stage}
    <details className="final-gate-controls" open>
      <summary>UI Final Gate · {scenario.id} · QA 音频：{audioOn ? 'ON' : 'OFF'}（可折叠看全桌）</summary>
      <div className="final-gate-body">
        <label>验收场景 <select aria-label="验收场景" value={index} onChange={event => reset(Number(event.target.value))}>
          {['A. 音画同步', 'B. 17步视觉', 'C. 清理与策略'].map(section => <optgroup key={section} label={section}>{finalGateScenarios.map((item, i) => item.section === section ? <option key={item.id} value={i}>{item.id} {item.name}</option> : null)}</optgroup>)}
        </select></label>
        <div><button disabled={!index} onClick={() => reset(index - 1)}>上一项</button><button disabled={index === finalGateScenarios.length - 1} onClick={() => reset(index + 1)}>下一项</button><button onClick={() => reset()}>重置场景 / 重演准备</button><button onClick={() => reset(index, true)}>重演动作</button></div>
        <p>{scenario.name} · 预期：{scenario.expected}</p>
        <p>使用桌面正式动作按钮或“执行下一动作”。重演先重置，再执行新动作。初始宝牌、5秒扫光、结果弹窗均不应额外发声。</p>
        <label><input type="checkbox" checked={audioOn} onChange={event => setAudioOn(event.target.checked)} />显式开启 QA 音频</label>
        <p>普通 Test Mode 保持静音。仅本次 Final Gate 允许音效；不保存设置，使用内置音效。</p>
        <label><input type="checkbox" checked={muted} onChange={event => setMuted(event.target.checked)} />临时 SFX OFF</label>
        <label>速度 <select aria-label="动画速度" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={1}>1x</option><option value={2}>2x</option></select></label>
        <label><input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} />临时减少动态效果</label>
        <button onClick={() => { audio.current?.stopSfx(); setActive(false); }}>取消 / 退出场景</button>
        <a href="?testMode=1">返回普通静音 Test Mode</a>
        <button onClick={() => {
          const renderer = document.querySelector('[data-table-renderer-active]');
          setInspection(`${innerWidth}×${innerHeight} CSS；Canvas=${document.querySelectorAll('canvas').length}；renderer=${renderer?.getAttribute('data-table-renderer-active')}；fallback=${renderer?.getAttribute('data-table-renderer-fallback-reason')}；牌河=${document.querySelector('[data-qa-river-counts]')?.getAttribute('data-qa-river-counts') ?? '四人'}`);
        }}>读取场景状态</button><output>{inspection}</output>
        {scenario.id === 'AV-13' ? <div><button onClick={() => setSweepCheck({ at: performance.now(), counts: JSON.stringify(cueCounts) })}>开始等待宝牌扫光</button><button disabled={!sweepCheck} onClick={() => setInspection(sweepCheck ? `已等待 ${((performance.now() - sweepCheck.at) / 1000).toFixed(1)} 秒；cue ${sweepCheck.counts === JSON.stringify(cueCounts) ? '未增加' : '有变化'}` : '')}>读取等待结果</button></div> : null}
        <details><summary>人工检查 · {Object.values(checks).filter(values => values.length === 4 && values.every(Boolean)).length} / {finalGateScenarios.length}（不会自动通过）</summary>
          {labels.map((label, i) => <label key={label}><input type="checkbox" checked={checks[scenario.id]?.[i] ?? false} onChange={event => setChecks(previous => {
            const values = [...(previous[scenario.id] ?? [false, false, false, false])]; values[i] = event.target.checked; return { ...previous, [scenario.id]: values };
          })} />{label}</label>)}
        </details>
        <details><summary>真实管线 Trace（最近10条）</summary><pre data-final-gate-counts>{JSON.stringify(cueCounts, null, 2)}</pre><ol data-final-gate-trace>{trace.map((row, i) => <li key={`${row.at}-${i}`}>{row.at.toFixed(1)} {row.type}：{row.detail}</li>)}</ol></details>
        <small>人耳同步待确认。VIS-01/02：1280×720；VIS-03：1920×1080；VIS-04：同场景缩放后弃牌。QA-02 在落点前取消，QA-03 在落点后退出。</small>
      </div>
    </details>
  </QaMotionContext.Provider>;
}

function FourScenario({ id, appearance, onExit }: { id: string; appearance: ReturnType<typeof loadAppearanceSettings>; onExit: () => void }) {
  const [state, setState] = useState(() => createFourGateFixture(id));
  const [error, setError] = useState('');
  const action = (value: OfficialTestModeAction) => {
    if (presentationPacingGate.pendingCount) { setError('请等当前动作完成后继续。'); return; }
    try { const next = applyOfficialTestModeAction(state, value); setState(next); setError(next === state ? '动作未被规则接受；请检查阶段。' : ''); }
    catch (reason) { setError(String(reason)); }
  };
  return <>
    <Board gameState={state} controlledPlayerId={0} tableBottomPlayerId={0} handAnimationsEnabled appearanceSettings={appearance}
      onDiscard={(playerId, tileInstanceId) => action({ type: 'discard', playerId, tileInstanceId })}
      onDeclareRiichi={(playerId, tileInstanceId) => action({ type: 'riichi', playerId, tileInstanceId })}
      onTsumo={playerId => action({ type: 'tsumo', playerId })} onRon={playerId => action({ type: 'ron', playerId })}
      onPassRon={playerId => action({ type: 'pass-ron', playerId })} onPon={playerId => action({ type: 'pon', playerId })}
      onChi={(playerId, optionIndex) => action({ type: 'chi', playerId, optionIndex })}
      onKan={(playerId, kanType, tileId) => action({ type: 'kan', playerId, kanType, tileId })}
      onChankanRon={playerId => action({ type: 'chankan-ron', playerId })} onPassChankan={playerId => action({ type: 'pass-chankan', playerId })}
      onPassCall={() => action({ type: 'pass-call' })} onSkipDrawActions={() => {}} onDeclareKyuushuKyuuhai={playerId => action({ type: 'kyuushu-kyuuhai', playerId })}
      onReset={onExit} onReturnMenu={onExit} />
    <div className="final-gate-action"><button onClick={() => {
      const next = gateAction(id, state);
      if (next.type === 'discard' && next.playerId === 0) {
        const tile = state.players[0].hand.find(tile => tile.instanceId === next.tileInstanceId)!;
        const buttons = [...document.querySelectorAll<HTMLButtonElement>('.local-hand-area button:not(:disabled)')];
        const button = buttons.find(button => state.players[0].drawnTile?.instanceId === tile.instanceId
          ? button.dataset.drawn === 'true' : button.getAttribute('aria-label') === getTileAlt(tile));
        if (button) { button.click(); return; }
        setError('请先关闭可执行操作提示，然后点击指定手牌。'); return;
      }
      action(next);
    }}>执行下一动作</button><span>{state.phase} · 玩家{state.currentPlayer + 1}</span><span role="status">{error}</span></div>
  </>;
}
