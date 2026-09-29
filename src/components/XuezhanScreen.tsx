import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { MatchRuntime } from '../game/timeControl/matchRuntime';
import { xzPolicy } from '../game/xuezhan/runtime';
import { applyXz, assertXzInvariants, createXzMatch, legalActions, participantId, readyScores, SEATS } from '../game/xuezhan/engine';
import { chooseXzAction, observeXz } from '../game/xuezhan/ai';
import { replayXz, saveXz, writeXzSave, type XzSave } from '../game/xuezhan/persistence';
import type { Seat, XzAction, XzState } from '../game/xuezhan/types';
import type { XzConfig } from '../game/xuezhan/config';
import { presentXz, publishXzTransition, xzInteraction } from '../presentation/table/xuezhanPresentation';
import { runPacedAutomaticAction } from '../presentation/pacing/automaticActionPacing';
import { finishHandsForAuthoritativeInput } from '../presentation/handAnimation/HandAnimationController';
import { SceneErrorBoundary } from '../presentation3d/session/SceneErrorBoundary';
import { TileFaceDomAppearance } from '../presentation/appearance/TileFaceDomAppearance';
import { DEFAULT_APPEARANCE_SETTINGS, type AppearanceSettings } from '../presentation/appearance/appearanceSettings';
import type { PlayerProfile } from '../profile/playerProfile';
import { Tile } from './Tile';
import { XuezhanCenter, XuezhanHud } from './XuezhanHud';
import { XuezhanResults } from './XuezhanResults';
import { MatchClockHud } from './MatchClockHud';
import { GameTopBarFrame } from './game/GameTopBar';
import { LocalHandArea } from './game/LocalHandArea';
import { DiscardSourceSnapshotStore } from '../presentation/handAnimation/DiscardSourceSnapshot';
import type { LocalHandAnimation3DState } from '../presentation3d/animation/tableAnimation3D';
import { resolveHandPackForPlayer, usePlayerSlotAppearances } from '../presentation/appearance/playerSlotAppearance';
import './xuezhan.css';
const Scene = lazy(() => import('../presentation3d/Table3DScene').then(m => ({ default: m.Table3DScene })));
const suitLabels = ['万', '筒', '条'];
const reasons = { win: '胡分', kong: '杠分', transfer: '呼叫转移', refund: '退税', pig: '查花猪', ready: '查叫' };
export function downloadXz(name: string, value: unknown): void { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
interface Props { config: XzConfig; initialState?: XzState; saved?: XzSave; isolated?: boolean; seed?: number; onExit: () => void; appearance?: AppearanceSettings; profile?: PlayerProfile; onAudio?: () => void; onState?: (s: XzState) => void }
export function XuezhanScreen(props: Props) {
  const [runtime] = useState(() => new MatchRuntime(props.initialState ?? (props.saved ? replayXz(props.saved) : createXzMatch(props.config, props.seed ?? (Date.now() >>> 0))), xzPolicy, props.config.time, undefined, 0, props.saved?.runtime));
  const [, redraw] = useReducer(n => n + 1, 0);
  const [message, setMessage] = useState(''), [fullControl, setFullControl] = useState(!!props.isolated), [omniscient, setOmniscient] = useState(false), [details, setDetails] = useState(false), [replayStep, setReplayStep] = useState<number | null>(null);
  const [ready, setReady] = useState(false), [fallback, setFallback] = useState(false);
  const [domReady, setDomReady] = useState(false), [localAnimation, setLocalAnimation] = useState<LocalHandAnimation3DState | null>(null);
  const [discardSources] = useState(() => new DiscardSourceSnapshotStore());
  const appearances = usePlayerSlotAppearances();
  const before = useRef(runtime.state), initialized = useRef(false);
  const state = runtime.state, isReplay = replayStep !== null;
  const s = useMemo(() => isReplay ? replayXz(saveXz(state), replayStep!) : state, [state, replayStep, isReplay]);
  const settings = props.appearance ?? DEFAULT_APPEARANCE_SETTINGS;
  const view = useMemo(() => presentXz(s, s.drafts[0], s.config.preferences.spectator, !!props.isolated && omniscient), [s, props.isolated, omniscient]);
  useEffect(() => runtime.subscribe(() => {
    const after = runtime.state;
    if (before.current !== after) props.onState?.(after);
    redraw();
  }), [runtime, props.onState]);
  useLayoutEffect(() => { if (before.current !== state) { publishXzTransition(before.current, state); before.current = state; } }, [state]);
  useEffect(() => { runtime.resumeAfterRemount(); return () => { runtime.pause(); finishHandsForAuthoritativeInput(); }; }, [runtime]);
  useEffect(() => {
    if (props.isolated) return;
    const saveLatest = () => { try { if (initialized.current) writeXzSave(localStorage, runtime.state, runtime.snapshot()); } catch (e) { setMessage(`自动保存失败：${e}`); } };
    const unsubscribe = runtime.subscribe(saveLatest);
    window.addEventListener('beforeunload', saveLatest);
    return () => { saveLatest(); unsubscribe(); window.removeEventListener('beforeunload', saveLatest); };
  }, [runtime, props.isolated]);
  useEffect(() => {
    if ((!ready && !fallback) || !domReady) return;
    runtime.activate();
    if (!initialized.current) {
      initialized.current = true;
      if (!props.saved && !props.isolated) for (const key of ['autoWin', 'suppressCalls', 'autoTsumogiri'] as const) runtime.setPreference(participantId(0), key, s.config.preferences[key]);
    }
    if (props.isolated && fullControl) runtime.pause();
  }, [ready, fallback, domReady, runtime]);
  useEffect(() => {
    if (!ready && !fallback || runtime.paused || fullControl || isReplay || s.phase === 'ended') return;
    const seat = SEATS.find(id => id !== 0 && legalActions(s, id).length > 0); if (seat === undefined) return;
    let cancelled = false;
    void runPacedAutomaticAction(() => {
      if (runtime.state !== s || runtime.paused) return;
      const a = chooseXzAction(observeXz(s, seat), s.config.ai[seat - 1]);
      if (a) runtime.command(participantId(seat), runtime.decision(participantId(seat))?.id, current => applyXz(current, seat, a));
    }, { isCancelled: () => cancelled });
    return () => { cancelled = true; };
  }, [s, ready, fallback, fullControl, isReplay, runtime, runtime.paused]);
  const command = (seat: Seat, action: XzAction) => {
    if (isReplay) return;
    const controlled = !!props.isolated && fullControl;
    if (controlled) runtime.activate();
    finishHandsForAuthoritativeInput();
    if (action.type === 'next') runtime.advance(current => applyXz(current, seat, action));
    else runtime.command(participantId(seat), runtime.decision(participantId(seat))?.id, current => applyXz(current, seat, action));
    if (controlled) runtime.pause();
  };
  const actions = xzInteraction(id => {
    if (!id) return;
    if (s.phase === 'exchange') {
      const draft = s.drafts[0] ?? [], tiles = draft.includes(id) ? draft.filter(t => t !== id) : [...draft, id];
      command(0, { type: 'exchange-draft', tiles });
    }
  }, id => command(0, { type: 'discard', tile: id }));
  const step = () => { for (const seat of SEATS) { const a = chooseXzAction(observeXz(runtime.state, seat), seat === 0 ? { difficulty: 'shintentai', personality: 'balanced' } : s.config.ai[seat - 1]); if (a) { command(seat, a); break; } } };
  const save = () => { try { writeXzSave(localStorage, runtime.state, initialized.current ? runtime.snapshot() : undefined); setMessage('血战存档已保存（含剩余预算）'); } catch (e) { setMessage(String(e)); } };
  const sceneReady = useCallback(() => setReady(true), []), sceneUnavailable = useCallback(() => setFallback(true), []);
  const handReady = useCallback(() => setDomReady(true), []);
  const waitInfo = s.config.preferences.waitsHelp && s.players[0].hand.length % 3 === 1 ? readyScores(s, 0) : [];
  const status = s.phase === 'exchange' ? `同色换${s.config.rules.exchange}张 · 已提交 ${Object.keys(s.exchanges).length}/4` : s.phase === 'missing' ? `选择定缺 · 已提交 ${Object.keys(s.declarations).length}/4` : s.phase === 'response' ? '等待全部响应裁定' : s.phase === 'ended' ? s.completed ? '整场结束' : '小局结束' : `轮到 ${s.players[s.current].name}`;
  const allLedger = [...s.results.filter(r => r.hand !== s.handNumber).flatMap(r => r.ledger), ...s.ledger];
  return <TileFaceDomAppearance settings={settings}><main className="xz-game game-screen" data-xz-legal-help={s.config.preferences.legalHelp} data-xz-phase={s.phase} data-xz-hand={s.handNumber} data-xz-sequence={s.sequence}>
    <GameTopBarFrame actions={<>
      <button onClick={() => { if (!props.isolated) save(); props.onExit(); }}>{props.isolated ? '退出测试场景' : '保存并退出'}</button><button disabled={isReplay} onClick={() => runtime.paused ? runtime.activate() : runtime.pause()}>{runtime.paused ? '继续比赛' : '暂停'}</button>
      {!props.isolated && <button onClick={save}>保存</button>}<button onClick={() => setDetails(v => !v)}>规则与账本</button>{props.onAudio && <button onClick={props.onAudio}>声音</button>}
      {props.isolated && <><label><input type="checkbox" checked={fullControl} onChange={e => { setFullControl(e.target.checked); if (e.target.checked) runtime.pause(); else runtime.activate(); }} />完全控制（冻结计时）</label><label><input type="checkbox" checked={omniscient} onChange={e => setOmniscient(e.target.checked)} />测试全知</label><button onClick={step}>逐步执行</button></>}
    </>}><strong>血战到底 · 第 {s.handNumber}/{s.config.rules.rounds} 局</strong><span>{status}</span></GameTopBarFrame>
    <section className="xz-scene table-3d-scene" data-table-renderer-requested="3d" data-table-renderer-fallback-reason={fallback ? 'unavailable' : 'none'} data-table-renderer-active={fallback ? '2d' : ready ? '3d' : 'loading'}>
      {fallback ? <p>3D 暂不可用，已切换安全牌桌；规则正常运行。</p> : <SceneErrorBoundary fallback={<p>3D 暂不可用</p>} onError={sceneUnavailable}><Suspense fallback={<p>加载公共牌桌素材…</p>}><Scene centralHud={<XuezhanCenter state={s} />} sceneState={view.scene} appearanceSettings={settings} animationsEnabled animationSessionKey={`xz:${s.seed}:${s.handNumber}`} animationTurn={s.sequence} localDiscardSnapshots={discardSources} onLocalHandAnimationChange={setLocalAnimation} onReady={sceneReady} onUnavailable={sceneUnavailable} /></Suspense></SceneErrorBoundary>}
      <XuezhanHud players={view.players} state={s} profile={props.profile} />
      {fallback && <div className="xz-fallback-rivers">{s.players.map(p => <div key={p.id}>{p.name}牌河：{p.river.filter(t => !t.claimed).map(t => <Tile key={t.instanceId} tile={t} compact interactive={false} />)}</div>)}</div>}
    </section>
    <section className="xz-controls" aria-label="血战操作区"><p role="status">{runtime.error ? `对局已停止：${runtime.error}` : message || (s.players[0].won !== null && s.phase !== 'ended' ? '你已胡牌，正在观战；其他玩家继续本局。' : status)}</p>
      {s.phase === 'exchange' && !s.exchanges[0] && <><span>选择同色 {s.config.rules.exchange} 张（再点撤销）</span><button disabled={(s.drafts[0]?.length ?? 0) !== s.config.rules.exchange} onClick={() => command(0, { type: 'exchange', tiles: s.drafts[0] ?? [] })}>提交换牌</button></>}
      {s.phase === 'missing' && s.declarations[0] === undefined && suitLabels.map((label, suit) => <button key={label} onClick={() => command(0, { type: 'missing', suit: suit as 0 | 1 | 2 })}>定缺{label}</button>)}
      {view.actions.filter(a => ['win', 'pass', 'pon', 'kan'].includes(a.type)).map((a, i) => <button key={i} disabled={runtime.paused && !fullControl || isReplay} onClick={() => command(0, a)}>{a.type === 'win' ? s.phase === 'response' ? '胡牌' : '自摸' : a.type === 'pass' ? '过' : a.type === 'pon' ? '碰' : '杠'}{'tile' in a && a.tile ? ` ${s.players[0].hand.find(t => t.instanceId === a.tile)?.rank}${suitLabels[Math.floor((s.players[0].hand.find(t => t.instanceId === a.tile)?.id ?? 0) / 9)]}` : ''}</button>)}
      <div className="xz-hand-spacer" />
      {waitInfo.length > 0 && <p>听牌：{waitInfo.map(w => `${w.id % 9 + 1}${suitLabels[Math.floor(w.id / 9)]}${s.config.preferences.fanHelp ? `（${w.score.fan}番，基值${w.score.base}）` : ''}`).join('、')}</p>}
      {s.wins.length > 0 && <div className="xz-win-summary">{s.wins.slice(-1).map(w => <p key={w.id}>{w.from === null ? '自摸' : `${s.players[w.from].name}放炮`}：{w.winners.map((id, i) => `${s.players[id].name} ${w.scores[i].label} ${w.scores[i].fan}番→计${w.scores[i].cappedFan}番`).join('；')}</p>)}</div>}
    </section>
    <LocalHandArea player={view.player} isCurrent={view.hand.canDiscard || s.phase === 'exchange'} canDiscard={view.hand.canDiscard}
      presentation={{ ...view.hand, tiles: view.hand.tiles.map(t => ({ ...t, playable: t.playable && (!runtime.paused || fullControl) && !isReplay })) }}
      interactionActions={xzInteraction(() => {}, id => s.phase === 'exchange' ? actions.selectTile(id) : actions.discard(id))}
      onDiscard={(_, id) => actions.discard(id)} screenSpaceOverlay doraGlowEnabled={false} doraBreathingEnabled={false} doraBorderEnabled={false}
      localHandAnimation={localAnimation} onPresentationReady={handReady} playerProfile={props.profile} handPack={resolveHandPackForPlayer(0, appearances, settings)}
      onDiscardSourceCapture={capture => discardSources.capture({ ...capture, sessionKey: `xz:${s.seed}:${s.handNumber}`, confirmedTurn: s.sequence + 1 })} />
    {!isReplay && <MatchClockHud runtime={runtime} participantId={participantId(0)} />}
    <XuezhanResults key={s.handNumber} state={s} onNext={() => command(0, { type: 'next' })} onLedger={() => setDetails(true)} onExit={props.onExit} />
    {details && <aside className="xz-details"><button onClick={() => setDetails(false)}>关闭明细</button><h2>规则、日志与账本</h2><p>{s.config.ruleId} · 种子 {s.seed} · 动作 {s.sequence}</p><details><summary>比赛开始后规则只读</summary><pre>{JSON.stringify(s.config, null, 2)}</pre></details>
      <table><thead><tr><th>账目／事务</th><th>原因</th><th>付款→收款</th><th>金额</th><th>源动作／源杠</th></tr></thead><tbody>{allLedger.map(e => <tr key={e.id}><td>{e.id}<br />{e.transactionId}</td><td>{reasons[e.reason]}</td><td>{s.players[e.from].name}→{s.players[e.to].name}</td><td>{e.amount}</td><td>{e.sourceAction}／{e.sourceKong ?? '—'}</td></tr>)}</tbody></table>
      <button onClick={() => downloadXz('血战回放.json', saveXz(state, initialized.current ? runtime.snapshot() : undefined))}>导出回放与账本</button>{!props.initialState && <><button onClick={() => { runtime.pause(); setReplayStep(0); }}>进入确定性回放</button>{isReplay && <><input aria-label="回放步数" type="range" min="0" max={state.actions.length} value={replayStep!} onChange={e => setReplayStep(Number(e.target.value))} /><span>第 {replayStep} 步</span><button onClick={() => { setReplayStep(null); runtime.activate(); }}>退出回放</button></>}</>}
      {props.isolated && <><button onClick={() => { try { assertXzInvariants(s); setMessage('实体牌、账本与身份不变量通过'); } catch (e) { setMessage(String(e)); } }}>检查不变量</button><pre>{JSON.stringify(s.actions, null, 2)}</pre><p>当前合法动作</p>{SEATS.map(seat => <div key={seat}>{s.players[seat].name}{legalActions(s, seat).map((a, i) => <button key={i} onClick={() => command(seat, a)}>{JSON.stringify(a)}</button>)}</div>)}</>}
    </aside>}
  </main></TileFaceDomAppearance>;
}
