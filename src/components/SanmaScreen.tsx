import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { MatchRuntime } from '../game/timeControl/matchRuntime';
import { sanmaPolicy, SanmaTestClock } from '../game/sanma/runtime';
import { applySanma, createSanma, legalSanmaActions, participantId } from '../game/sanma/engine';
import { chooseSanmaAction, observeSanma } from '../game/sanma/ai';
import { assertSanma } from '../game/sanma/invariants';
import { downloadSanma, replaySanma, saveSanma, writeSanmaSave, SANMA_HISTORY_KEY, type SanmaSave } from '../game/sanma/persistence';
import type { SanmaConfig } from '../game/sanma/config';
import { SANMA_SEATS, type SanmaAction, type SanmaSeat, type SanmaState } from '../game/sanma/types';
import { presentSanma, publishSanmaTransition, sanmaInteraction, sanmaHudPosition } from '../presentation/table/sanmaPresentation';
import { runPacedAutomaticAction } from '../presentation/pacing/automaticActionPacing';
import { finishHandsForAuthoritativeInput } from '../presentation/handAnimation/HandAnimationController';
import { presentationPacingGate } from '../presentation/pacing/PresentationPacingGate';
import { presentationEventBus } from '../presentation/PresentationEventBus';
import { FormalGameScreen } from './game/FormalGameScreen';
import { FormalTable3D } from '../presentation3d/FormalTable3D';
import { buildSanmaFormalScene } from '../presentation/table/sanmaFormalScene';
import { Table3DHudView, Table3DCentralHudView } from '../presentation3d/Table3DHud';
import { TableCenterView } from './game/TableCenter';
import { GameTopBarView } from './game/GameTopBar';
import { DoraIndicatorStack } from './game/DoraIndicatorStack';
import { TileActionButton, CallOptionButton } from './Board';
import { ActionPrompt, OperationButton } from './ActionPrompt';
import { GameEventOverlay } from './game/GameEventOverlay';
import { WinPresentationOverlay } from './game/WinPresentationOverlay';
import type { WinPresentation3DState } from '../presentation3d/win/winPresentation3D';
import type { LocalHandAnimation3DState } from '../presentation3d/animation/tableAnimation3D';
import { DiscardSourceSnapshotStore, type DiscardSourceSnapshot } from '../presentation/handAnimation/DiscardSourceSnapshot';
import { ResultShell, ResultDeltas, WinnerResultCards } from './ResultDialog';
import { TileDoraContext } from '../presentation/table/TileDoraContext';
import { sanmaDora } from '../game/sanma/wall';
import { sanmaTenpaiDisplay } from '../presentation/table/sanmaTenpaiPresentation';
import { TenpaiWaitPanel } from './TenpaiWaitPanel';
import { MatchRankingCards } from './MatchResultDialog';
import { sanmaWinnerRows } from '../presentation/table/sanmaResultPresentation';
import { AnalysisDrawerView } from './game/AnalysisDrawer';
import { ReplayBottomBar } from './ReplayBottomBar';
import type { ReplayController } from '../game/replay/types';
import { SceneErrorBoundary } from '../presentation3d/session/SceneErrorBoundary';
import type { TileId } from '../game/types';
import type { DiscardSourceCapture } from '../presentation/handAnimation/DiscardSourceSnapshot';
import { DEFAULT_APPEARANCE_SETTINGS, type AppearanceSettings } from '../presentation/appearance/appearanceSettings';
import { resolveHandPackForPlayer, usePlayerSlotAppearances } from '../presentation/appearance/playerSlotAppearance';
import type { PlayerProfile } from '../profile/playerProfile';
import { tileLabel, windLabel } from '../game/tileUtils';
import { MatchClockHud } from './MatchClockHud';
import './sanma.css';

interface Props { config: SanmaConfig; initialState?: SanmaState; saved?: SanmaSave; isolated?: boolean; seed?: number; replayOnly?: boolean;
  onVoiceStop?: () => void; onExit: () => void; appearance?: AppearanceSettings; profile?: PlayerProfile; onAudio?: () => void; onState?: (state: SanmaState) => void; testClock?: SanmaTestClock }
const labels: Record<SanmaAction['type'], string> = { discard: '弃牌', riichi: '立直', north: '拔北', ankan: '暗杠', kakan: '加杠', ron: '荣和', tsumo: '自摸', pass: '过', pon: '碰', minkan: '明杠', abort: '九种九牌', next: '下一局' };
export function SanmaScreen(props: Props) {
  const [voiceSessionId] = useState(() => `sanma:${crypto.randomUUID()}`);
  const [root] = useState(() => props.saved?.initial ?? props.initialState ?? createSanma(props.config, props.seed ?? Date.now() >>> 0));
  const [clock] = useState(() => props.testClock ?? (props.isolated ? new SanmaTestClock() : undefined));
  const [runtime] = useState(() => new MatchRuntime(props.saved?.state ?? root, sanmaPolicy, props.config.time, clock, 0, props.saved?.runtime));
  const [, render] = useReducer(n => n + 1, 0), [ready, setReady] = useState(false), [domReady, setDomReady] = useState(false);
  const [viewer, setViewer] = useState<SanmaSeat>(0), [selected, setSelected] = useState<string | null>(null), [riichiChoosing, setRiichiChoosing] = useState(false);
  const [fullControl, setFullControl] = useState(!!props.isolated), [details, setDetails] = useState(false), [message, setMessage] = useState('');
  const [replayStep, setReplayStep] = useState<number | null>(props.replayOnly ? props.saved?.state.actions.length ?? 0 : null);
  const [resultVisible, setResultVisible] = useState(!!runtime.state.result);
  const appearances = usePlayerSlotAppearances(), appearance = props.appearance ?? DEFAULT_APPEARANCE_SETTINGS;
  const previous = useRef(runtime.state), initialized = useRef(false), savedSequence = useRef(-1), historySaved = useRef(false), liveProps = useRef(props); liveProps.current = props;
  const state = runtime.state, replay = replayStep !== null;
  const archive = useMemo(() => saveSanma(state, undefined, root, !!props.isolated), [state, root, props.isolated]);
  const s = useMemo(() => replay ? replaySanma(archive, replayStep!) : state, [archive, replay, replayStep, state]);
  const view = useMemo(() => presentSanma(s, viewer, selected, riichiChoosing, replay && s.phase === 'ended'), [s, viewer, selected, riichiChoosing, replay]);
  const sessionKey = `sanma:${s.seed}:${s.roundSerial}:${viewer}`;
  const northSources = useRef(new Map<string, import('../presentation/handAnimation/DiscardSourceSnapshot').PresentationRect>());
  const [snapshots] = useState(() => new DiscardSourceSnapshotStore());
  const [discardSnapshot, setDiscardSnapshot] = useState<DiscardSourceSnapshot | null>(null);
  const [localAnimation, setLocalAnimation] = useState<LocalHandAnimation3DState | null>(null);
  const [winAnimation, setWinAnimation] = useState<WinPresentation3DState | null>(null);
  const [hovered, setHovered] = useState<TileId | null>(null);
  const [replayPlaying, setReplayPlaying] = useState(false), [replaySpeed, setReplaySpeed] = useState<ReplayController['speed']>(1);
  const scene = useMemo(() => buildSanmaFormalScene(s, viewer, winAnimation?.revealedPlayerIds ?? (winAnimation ? [winAnimation.action.playerId] : [])), [s, viewer, winAnimation]);
  useEffect(() => { northSources.current.clear(); snapshots.clear(); setDiscardSnapshot(null); setLocalAnimation(null); setWinAnimation(null); return () => snapshots.clear(); }, [sessionKey, snapshots]);
  const captureSource = useCallback((capture: DiscardSourceCapture) => {
    const snapshot = { ...capture, sessionKey, confirmedTurn: s.sequence + 1 };
    const clear = snapshots.capture(snapshot); setDiscardSnapshot(snapshot);
    return () => { clear(); setDiscardSnapshot(current => current === snapshot ? null : current); };
  }, [sessionKey, s.sequence, snapshots]);
  const animationChanged = useCallback((next: LocalHandAnimation3DState | null) => {
    setLocalAnimation(next); if (!next || next.handPresentation || (next.kind === 'discard' && next.phase === 'proxy-ready')) setDiscardSnapshot(null);
  }, []);
  useEffect(() => {
    if (!replay || !replayPlaying) return;
    if (replayStep! >= state.actions.length) { setReplayPlaying(false); return; }
    const timer = window.setTimeout(() => setReplayStep(n => Math.min(state.actions.length, n! + 1)), 800 / replaySpeed);
    return () => window.clearTimeout(timer);
  }, [replay, replayPlaying, replayStep, replaySpeed, state.actions.length]);
  useEffect(() => runtime.subscribe(render), [runtime]);
  const attachment = useRef(0);
  useEffect(() => { const generation = ++attachment.current; runtime.resumeAfterRemount(); return () => {
    runtime.pause(); finishHandsForAuthoritativeInput();
    queueMicrotask(() => { if (attachment.current === generation) runtime.dispose(); });
  }; }, [runtime]);
  useEffect(() => { if (ready && domReady && !props.replayOnly && !initialized.current) {
    initialized.current = true; runtime.activate(); liveProps.current.onState?.(runtime.state);
    if (!props.saved && !props.isolated) presentationEventBus.publish({ type: 'match_started', matchId: `sanma:${root.seed}`, activePlayerIds: [0, 1, 2] });
  } }, [ready, domReady, runtime, props.replayOnly, props.saved, props.isolated, root.seed]);
  useLayoutEffect(() => {
    if (previous.current !== state) {
      if (!replay) publishSanmaTransition(previous.current, state, northSources.current, voiceSessionId);
      previous.current = state; liveProps.current.onState?.(state); setRiichiChoosing(false); setSelected(null);
    }
  }, [state, replay, voiceSessionId]);
  useEffect(() => { if (replay) liveProps.current.onVoiceStop?.(); return () => liveProps.current.onVoiceStop?.(); }, [replay]);
  useEffect(() => {
    if (!s.result) { setResultVisible(false); return; }
    let active = true;
    void presentationPacingGate.waitUntilClear({ timeoutMs: 15000 }).then(() => { if (active) setResultVisible(true); });
    return () => { active = false; };
  }, [s.result]);
  const saveCurrent = useCallback(() => {
    try { writeSanmaSave(localStorage, saveSanma(runtime.state, runtime.snapshot(), root, !!props.isolated)); setMessage('已保存三人比赛及剩余时间'); }
    catch (e) { setMessage(`保存失败：${e}`); }
  }, [runtime, root, props.isolated]);
  useEffect(() => {
    if (props.isolated || props.replayOnly) return;
    const saveLatest = () => {
      if (!initialized.current || savedSequence.current === runtime.state.sequence) return;
      try { writeSanmaSave(localStorage, saveSanma(runtime.state, runtime.snapshot(), root)); savedSequence.current = runtime.state.sequence; } catch (e) { setMessage(`自动保存失败：${e}`); }
    };
    const unsub = runtime.subscribe(saveLatest);
    const unload = () => { savedSequence.current = -1; saveLatest(); };
    window.addEventListener('beforeunload', unload);
    return () => { unload(); unsub(); window.removeEventListener('beforeunload', unload); };
  }, [runtime, root, props.isolated, props.replayOnly]);
  useEffect(() => {
    if (!state.completed || props.isolated || props.replayOnly || historySaved.current) return;
    try { const history = JSON.parse(localStorage.getItem(SANMA_HISTORY_KEY) ?? '[]') as SanmaSave[]; localStorage.setItem(SANMA_HISTORY_KEY, JSON.stringify([archive, ...history.filter(h => h.state.seed !== state.seed)].slice(0, 12))); historySaved.current = true; }
    catch (e) { setMessage(`牌谱写入失败，请导出保留：${e}`); }
  }, [state.completed, archive, props.isolated, props.replayOnly]);
  const command = useCallback((seat: SanmaSeat, action: SanmaAction) => {
    if (replay) return;
    finishHandsForAuthoritativeInput();
    if (action.type === 'north' && seat === viewer) {
      const element = Array.from(document.querySelectorAll<HTMLElement>('.local-hand-area [data-tile-instance]')).find(node => node.dataset.tileInstance === action.tile);
      if (element) { const { left, top, width, height } = element.getBoundingClientRect(); northSources.current.set(action.tile, { left, top, width, height }); }
    }
    if (action.type === 'next') runtime.advance(current => applySanma(current, seat, action));
    else runtime.command(participantId(seat), runtime.decision(participantId(seat))?.id, current => applySanma(current, seat, action));
  }, [runtime, replay, viewer]);
  useEffect(() => {
    if (!ready || !domReady || fullControl || replay || runtime.paused || state.phase === 'ended') return;
    const prepared = SANMA_SEATS.filter(id => id !== 0 && legalSanmaActions(state, id).length).flatMap(seat => {
      const action = chooseSanmaAction(observeSanma(state, seat), state.config.ai[seat - 1]);
      const choice = action && runtime.preparePolicyCommand(participantId(seat), current => applySanma(current, seat, action));
      return choice ? [choice] : [];
    });
    if (!prepared.length) return;
    let cancelled = false;
    void runPacedAutomaticAction(() => {
      if (runtime.state !== state || runtime.paused) return;
      finishHandsForAuthoritativeInput(); prepared.forEach(choice => choice.commit());
    }, { isCancelled: () => cancelled });
    return () => { cancelled = true; prepared.forEach(choice => choice.cancel()); };
  }, [runtime, state, fullControl, replay, ready, domReady, runtime.paused, command]);
  const step = () => {
    const wasPaused = runtime.paused; if (wasPaused) runtime.activate();
    const seat = SANMA_SEATS.find(id => legalSanmaActions(runtime.state, id).length);
    if (seat !== undefined) { const a = chooseSanmaAction(observeSanma(runtime.state, seat), seat === 0 ? undefined : s.config.ai[seat - 1]); if (a) command(seat, a); }
    if (wasPaused) runtime.pause();
  };
  const usable = useCallback(() => setReady(true), []), handReady = useCallback(() => setDomReady(true), []);
  const interaction = sanmaInteraction(setSelected, id => command(viewer, { type: riichiChoosing ? 'riichi' : 'discard', tile: id }));
  const available = view.legal.filter(a => a.type !== 'discard' && a.type !== 'riichi' && a.type !== 'next');
  const title = s.config.length === 'east-only' ? '三人东' : '三人南';
  const status = s.phase === 'response' ? `${s.players[s.response!.actor].name}${s.response!.kind === 'north' ? '宣言拔北' : s.response!.kind === 'discard' ? '弃牌' : '宣言杠'}，等待响应` : s.phase === 'ended' ? s.result!.reason : `${s.players[s.current].name}行动`;
  const hudPlayers = view.mapping.map(m => ({ position: sanmaHudPosition(m.seat), player: view.players[view.participants.find(p => p.id === m.participantId)!.appearanceSlot!], nickname: view.participants.find(p => p.id === m.participantId)!.appearanceSlot === 0 ? props.profile?.nickname : view.participants.find(p => p.id === m.participantId)!.name }));
  const winnerHands = s.result?.winners.map(w => ({ playerId: w.winner, tiles: [...s.players[w.winner].hand.map(i => s.wall.tiles[i]), ...(w.from !== null ? [s.wall.tiles[w.tile]] : [])], winningTile: s.wall.tiles[w.tile], drawnTileInstanceId: w.from === null ? s.wall.tiles[w.tile].instanceId : null, seat: view.mapping.find(m => m.participantId === participantId(w.winner))!.seat }));
  return <TileDoraContext.Provider value={view.dora.map(t => sanmaDora(t.id))}>
        {props.isolated && !replay && <details className="sanma-test-controls"><summary>展开／收起测试控制区</summary><label><input type="checkbox" checked={fullControl} onChange={e => setFullControl(e.target.checked)} />完全控制（关闭 AI）</label><label>观察与操作席<select aria-label="三人观察席" value={viewer} onChange={e => setViewer(Number(e.target.value) as SanmaSeat)}>{s.players.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><button onClick={step}>单步推进</button><button onClick={() => clock?.advance(5000)}>测试时钟＋5秒</button><button onClick={() => { for (const key of ['autoWin', 'suppressCalls', 'autoTsumogiri'] as const) runtime.setPreference(participantId(viewer), key, false); }}>关闭自动操作</button></details>}

    <FormalGameScreen data-sanma-phase={s.phase} data-sanma-sequence={s.sequence} data-sanma-participants={s.players.length} data-sanma-payment={s.config.tsumoPolicy}
      topBar={<GameTopBarView currentName={s.current === 0 ? props.profile?.nickname ?? s.players[0].name : s.players[s.current].name} currentWind={view.players[s.current].seatWind} phaseLabel={runtime.paused ? '已暂停' : s.phase === 'turn' ? '打牌' : status} modeLabel={title} analysisOpen={details} onOpenRulesGuide={() => setDetails(true)} onOpenAudioSettings={props.onAudio ?? (() => undefined)} onToggleAnalysis={() => setDetails(v => !v)} onReturnMenu={() => { if (!props.replayOnly) saveCurrent(); props.onExit(); }} controls={!replay && <button onClick={() => runtime.paused ? runtime.activate() : runtime.pause()}>{runtime.paused ? '继续比赛' : '暂停'}</button>} />}
      table={<SceneErrorBoundary onError={error => { runtime.pause(); setMessage(error.message); }} fallback={<p role="alert">3D 场景不可用，请返回菜单重试。</p>}>
        <FormalTable3D sceneState={scene} animationSessionKey={sessionKey} animationTurn={s.sequence} animationsEnabled={ready && !replay} localDiscardSnapshots={snapshots} onLocalHandAnimationChange={animationChanged} winPresentation3D={winAnimation} appearanceSettings={appearance} onReady={usable} tileVisualContext={{ hoveredTileType: hovered, sameTileHoverEnabled: true, doraGlowEnabled: true }}
          centralHud={<Table3DCentralHudView><TableCenterView scores={view.mapping.map(m => { const p = view.players[view.participants.find(p => p.id === m.participantId)!.appearanceSlot!]; return { playerId: p.id, className: `center-score--${sanmaHudPosition(m.seat)}`, slot: m.seat, score: p.score, wind: p.seatWind, current: p.id === s.current, dealer: p.id === s.dealer }; })} roundLabel={`${windLabel(s.roundWind)}${s.handNumber}局`} honba={s.honba} remainingLabel={`剩余${s.wall.live.length}张`} centerCornerLabels={{ bottomRight: `自摸${s.config.tsumoPolicy === 'loss' ? '有损' : '无损'}` }} /></Table3DCentralHudView>}
          hud={<Table3DHudView players={hudPlayers} playerProfile={props.profile} dora={<DoraIndicatorStack gameState={{ doraIndicators: view.dora, honba: s.honba, riichiSticks: s.pot / 1000, roundWind: s.roundWind }} hoveredTileType={hovered} onHoveredTileTypeChange={setHovered} />} />} />
      </SceneErrorBoundary>}
      appearance={{ settings: appearance }}
      localHand={{ player: view.player, meldPlayer: { ...view.player, calls: [] }, isCurrent: s.current === viewer, canDiscard: view.hand.canDiscard && !runtime.paused && !replay,
        presentation: { ...view.hand, tiles: view.hand.tiles.map(t => ({ ...t, playable: t.playable && initialized.current && !runtime.paused && !replay })) }, interactionActions: interaction,
        onDiscardSourceCapture: captureSource, retainDiscardSourceSnapshot: true, discardSnapshot, localHandAnimation: localAnimation,
        onDiscard: (_, id) => interaction.discard(id), screenSpaceOverlay: true, playerProfile: viewer === 0 ? props.profile : undefined, onPresentationReady: handReady, handPack: resolveHandPackForPlayer(viewer, appearances, appearance),
        doraIndicators: view.dora, doraGlowEnabled: true, hoveredTileType: hovered, onHoveredTileTypeChange: setHovered, sameTileHoverEnabled: true }}
      winOverlay={<WinPresentationOverlay winnerHands={winnerHands} bottomPlayerId={viewer} enabled={!replay} sessionKey={sessionKey} rendererMode="3d" on3DPresentationChange={setWinAnimation} doraIndicators={view.dora} appearanceSettings={appearance} />}
      eventOverlay={<GameEventOverlay bottomPlayerId={viewer} enabled={!replay} />}
      actionPrompt={available.length || view.legal.some(a => a.type === 'riichi') ? <ActionPrompt title={message || (riichiChoosing ? '请选择高亮候选牌完成立直' : '请选择操作')}>
        {available.map((a, i) => {
          const disabled = !initialized.current || runtime.paused || replay;
          const tile = 'tile' in a ? s.wall.tiles.find(t => t.instanceId === a.tile) : a.type === 'ron' ? s.wall.tiles[s.response!.tile] : a.type === 'tsumo' ? s.wall.tiles[s.players[viewer].drawn!] : undefined;
          const onClick = () => command(viewer, a);
          if (a.type === 'north' || a.type === 'ron' || a.type === 'tsumo') return tile && <TileActionButton key={i} operation={a.type === 'north' ? 'north' : 'win'} label={labels[a.type]} tile={tile} disabled={disabled} onClick={onClick} />;
          if (a.type === 'pon' || a.type === 'minkan' || a.type === 'ankan' || a.type === 'kakan') {
            const called = s.response ? s.wall.tiles[s.response.tile] : undefined;
            const id = tile?.id ?? called!.id;
            const own = view.player.hand.filter(t => t.id === id);
            const tiles = a.type === 'kakan' ? [...view.player.calls.find(m => m.tiles[0].id === id)!.tiles, tile!] : a.type === 'ankan' ? own : [...own.slice(0, a.type === 'pon' ? 2 : 3), called!];
            return <CallOptionButton key={i} operation={a.type === 'pon' ? 'pon' : 'kan'} label={labels[a.type]} tiles={tiles} calledInstanceId={called?.instanceId} disabled={disabled} onClick={onClick} />;
          }
          return <OperationButton key={i} kind={a.type === 'pass' ? 'pass' : 'abortive'} disabled={disabled} onClick={onClick}>{labels[a.type]}</OperationButton>;
        })}
        {view.legal.some(a => a.type === 'riichi') && <OperationButton kind="riichi" disabled={runtime.paused || replay} aria-pressed={riichiChoosing} onClick={() => setRiichiChoosing(v => !v)}>{riichiChoosing ? '取消立直选牌' : '立直'}</OperationButton>}
      </ActionPrompt> : null}
      tenpai={<TenpaiWaitPanel display={sanmaTenpaiDisplay(s, viewer, selected)} />}
      result={resultVisible && !details && s.result ? <ResultShell title={s.completed ? '整场比赛总结' : s.result.reason} subtitle={s.completed ? s.endReason ?? '' : title} continueLabel={replay ? '关闭结果' : !s.completed ? '下一局' : '返回'} onReset={() => replay ? setResultVisible(false) : !s.completed ? command(0, { type: 'next' }) : props.onExit()}>
      <ResultDeltas rows={s.players.map(p => ({ playerId: p.id, label: p.name, delta: s.result!.deltas[p.id], scoreBefore: p.score - s.result!.deltas[p.id], scoreAfter: p.score }))} />
      {s.completed && <MatchRankingCards rows={s.ranking.map(r => ({ id: r.player, rank: r.rank, name: s.players[r.player].name, score: r.result }))} />}
      <WinnerResultCards winners={sanmaWinnerRows(s)} gameState={{ dealer: s.dealer, honba: s.honba, doraIndicators: view.dora }} resultRiichiSticks={s.pot / 1000} northBonus={Object.fromEntries(s.result.winners.map(w => [w.winner, w.score.northDora]))} />
      {s.result.kind === 'exhaustive' && <p>听牌：{s.result.tenpai.map(i => s.players[i].name).join('、') || '无人'}</p>}
      <button onClick={() => setDetails(true)}>查看逐笔账本</button>
    </ResultShell> : null}
    >
      {!replay && <MatchClockHud runtime={runtime} participantId={participantId(viewer)} />}
    <AnalysisDrawerView open={details} onClose={() => setDetails(false)} title="规则与账本">{details && <><h2>规则、逐笔账本与牌谱</h2><p>{s.config.ruleVersion} · 种子{s.seed} · {s.sequence}步</p><details><summary>本场规则快照</summary><pre>{JSON.stringify(s.config, null, 2)}</pre></details>
      <table><thead><tr><th>事务</th><th>原因</th><th>付款</th><th>收款</th><th>点数</th></tr></thead><tbody>{s.ledger.map(e => <tr key={e.id}><td>{e.transaction}</td><td>{{ win: '和牌', honba: '本场', riichi: '立直供托', sticks: '供托领取', noten: '不听罚符', liability: '包牌', nagashi: '流局满贯' }[e.reason]}</td><td>{e.from === 'pot' ? '供托' : s.players[e.from].name}</td><td>{e.to === 'pot' ? '供托' : s.players[e.to].name}</td><td>{e.amount}</td></tr>)}</tbody></table>
      <button onClick={saveCurrent}>保存当前状态</button><button onClick={() => downloadSanma('三人牌谱.json', saveSanma(state, runtime.snapshot(), root, !!props.isolated))}>导出三人牌谱</button>
      <button onClick={() => { runtime.pause(); setDetails(false); setReplayStep(root.actions.length); }}>从头回放</button><button onClick={() => { try { assertSanma(s); setMessage('实体牌、阶段和点棒账本检查通过'); } catch (e) { setMessage(String(e)); } }}>检查当前状态</button>
      {props.isolated && <><h3>测试全明牌检查（不传给 AI）</h3>{s.players.map(p => <p key={p.id}>{p.name}：{p.hand.map(i => tileLabel(s.wall.tiles[i])).join(' ')}</p>)}<pre>{JSON.stringify(s.events.slice(-20), null, 2)}</pre></>}
    </>}</AnalysisDrawerView>

      {replay && <label className="sanma-replay-viewer">观察席<select aria-label="三人回放观察席" value={viewer} onChange={e => setViewer(Number(e.target.value) as SanmaSeat)}>{s.players.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>}
      {replay && <ReplayBottomBar rounds={[{ id: String(root.seed), label: '整场牌谱', summary: title }]} roundIndex={0} onRoundChange={() => undefined} stepIndex={replayStep! - root.actions.length} onSeekStep={step => setReplayStep(root.actions.length + step)} controller={{ status: replayPlaying ? 'playing' : 'paused', currentEventIndex: replayStep! - root.actions.length - 1, speed: replaySpeed }} totalSteps={state.actions.length - root.actions.length} onPlay={() => setReplayPlaying(true)} onPause={() => setReplayPlaying(false)} onStepForward={() => setReplayStep(n => Math.min(state.actions.length, n! + 1))} onStepBackward={() => setReplayStep(n => Math.max(root.actions.length, n! - 1))} onSeekStart={() => setReplayStep(root.actions.length)} onSeekEnd={() => setReplayStep(state.actions.length)} onSpeedChange={setReplaySpeed} />}
    </FormalGameScreen>
  </TileDoraContext.Provider>;
}
