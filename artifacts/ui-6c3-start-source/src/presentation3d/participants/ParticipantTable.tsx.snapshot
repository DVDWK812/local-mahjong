import type { CandidateFrame } from './candidateAnimation';
import { preloadHandPacks, type HandPackId } from '../../hand/handPacks';
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SceneErrorBoundary, SceneLoading } from '../session/SceneErrorBoundary';
import { classifyTableRendererError } from '../rendererDiagnostics';
import { isInitialPresentationReady } from '../initialSceneReady';
import { DEFAULT_APPEARANCE_SETTINGS, type AppearanceSettings } from '../../presentation/appearance/appearanceSettings';
import { resolveHandPackForPlayer, usePlayerSlotAppearances, type PlayerSlotAppearances } from '../../presentation/appearance/playerSlotAppearance';
import { resolvePlayerSlotAvatar, resolvePlayerSlotNickname, usePlayerSlotAvatars, usePlayerSlotNicknames } from '../../presentation/appearance/playerSlotAvatars';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { Tile } from '../../components/Tile';
import type { PlayerProfile } from '../../profile/playerProfile';
import { getCustomAvatarAssetId, type AvatarId } from '../../profile/avatars';
import { appearanceAssetUrlCache } from '../../presentation/appearance/appearanceAssetResolver';
import { waitForLocalHandPresentation } from '../../components/game/localHandPresentationReady';
import type { TableParticipant } from './participantPresentation';
import { resolveParticipantLayout, type ParticipantLayoutPreset, type ParticipantSeat } from './participantLayout';
import './participantTable.css';
import { DuelHud, DuelCentralHud } from './DuelHud';

const Scene = lazy(() => import('./ParticipantScene').then(module => ({ default: module.ParticipantScene })));
export type ParticipantTableProps = {
  participants: readonly TableParticipant[]; mapping: readonly ParticipantSeat[]; preset: ParticipantLayoutPreset;
  sessionKey: string; localReady: boolean; settings?: AppearanceSettings; profile?: PlayerProfile; label: string;
  appearanceSlots?: PlayerSlotAppearances;
  dora?: ReactNode;
  candidateFrame?: CandidateFrame | null;
  onCandidatePrepared?: (eventId: string) => void;
  onAnimationReady?: (ready: boolean) => void;
  currentParticipantId?: string;
};
// Parent audio/UI updates are not scene changes and must not request demand frames.
export const ParticipantTable = memo(function ParticipantTable(props: ParticipantTableProps) { return <TableSession key={props.sessionKey} {...props} />; });
function TableSession({ participants, mapping, preset, sessionKey, localReady, settings = DEFAULT_APPEARANCE_SETTINGS, profile, label, appearanceSlots, dora, currentParticipantId, candidateFrame, onAnimationReady, onCandidatePrepared }: ParticipantTableProps) {
  const [sceneReady, setSceneReady] = useState(false);
  const [failure, setFailure] = useState('none');
  const [hudReady, setHudReady] = useState(false);
  const hudRoot = useRef<HTMLElement>(null);
  const [packReady, setPackReady] = useState(preset !== 'duel');
  const ready = isInitialPresentationReady(sceneReady, localReady && hudReady && packReady);
  const handleReady = useCallback(() => setSceneReady(true), []);
  const fail = useCallback((error: Error) => setFailure(classifyTableRendererError(error)), []);
  const avatars = usePlayerSlotAvatars();
  const nicknames = usePlayerSlotNicknames();
  const savedAppearances = usePlayerSlotAppearances();
  const appearances = appearanceSlots ?? savedAppearances;
  const packKey = preset === 'duel' ? [...new Set(participants.map(p => resolveHandPackForPlayer(p.appearanceSlot, appearances, settings).id))].join(',') : '';
  useEffect(() => {
    let live = true;
    if (!packKey) return;
    void preloadHandPacks(packKey.split(',') as HandPackId[]).then(() => { if (live) setPackReady(true); });
    return () => { live = false; };
  }, [packKey]);
  useEffect(() => { onAnimationReady?.(ready && failure === 'none'); }, [ready, failure, onAnimationReady]);
  const placed = resolveParticipantLayout(participants, mapping, preset);
  const centralHud = useMemo(() => preset === 'duel' ? <DuelCentralHud participants={participants} mapping={mapping} label={label} currentParticipantId={currentParticipantId} /> : undefined, [participants, mapping, preset, label, currentParticipantId]);
  const avatarSignature = JSON.stringify(participants.map(p => p.profile?.avatarId ?? resolvePlayerSlotAvatar(p.appearanceSlot, profile?.avatarId, avatars)));
  useEffect(() => {
    const abort = new AbortController();
    const leases = (JSON.parse(avatarSignature) as AvatarId[]).flatMap(id => {
      const assetId = getCustomAvatarAssetId(id);
      return assetId ? [appearanceAssetUrlCache.acquire({ kind: 'local', assetId }, '')] : [];
    });
    void Promise.all(leases.map(lease => lease.promise)).then(() => waitForLocalHandPresentation(
      () => Array.from(hudRoot.current?.querySelectorAll('img') ?? []), undefined, abort.signal,
    )).then(value => { if (value) setHudReady(true); });
    return () => { abort.abort(); leases.forEach(lease => lease.release()); };
  }, [avatarSignature]);
  const fallback = <section className="participant-fallback" aria-label="安全平面牌桌">
    <p>3D 暂不可用，已切换安全平面显示。</p>
    {participants.map(p => <div key={p.id}><strong>{p.name} · {p.score}</strong><div>{p.discardedTiles.map(tile => <Tile key={tile.instanceId} tile={tile} compact interactive={false} />)}</div></div>)}
  </section>;
  const scene = <Suspense fallback={null}><Scene participants={participants} mapping={mapping} preset={preset} settings={settings} appearanceSlots={appearanceSlots} sessionKey={sessionKey} onReady={handleReady} onUnavailable={fail} centralHud={centralHud} candidateFrame={candidateFrame} onCandidatePrepared={onCandidatePrepared} /></Suspense>;
  return <section ref={hudRoot} className={`participant-table ${preset === 'duel' ? 'table-renderer-layer' : ''}`} aria-label={label} data-table-renderer-requested="3d" data-table-renderer-active={failure === 'none' ? sceneReady ? '3d' : 'loading' : '2d'}
    data-table-renderer-fallback-reason={failure} data-presentation-revealed={ready || failure !== 'none'} data-participant-count={participants.length}>
    {failure !== 'none' ? fallback : <SceneErrorBoundary fallback={fallback} onError={fail}>
      {preset === 'duel' ? <section className="table-3d-scene">{scene}</section> : scene}
    </SceneErrorBoundary>}
    {preset === 'duel' ? failure === 'none' ? <DuelHud participants={participants} mapping={mapping} profile={profile} dora={dora} settings={settings} /> : null : <div className="participant-table-label">{label}</div>}
    {failure === 'none' && preset !== 'duel' ? placed.map(({ participant: p, seat, layout }) => <div key={p.id} className="participant-hud" data-participant-id={p.id} data-display-seat={seat}
      data-hand-pack={resolveHandPackForPlayer(p.appearanceSlot, appearances, settings).id}
      style={{ left: `${layout.hud[0]}%`, top: `${layout.hud[1]}%` } as CSSProperties}>
      <PlayerAvatar avatarId={p.profile?.avatarId ?? resolvePlayerSlotAvatar(p.appearanceSlot, profile?.avatarId, avatars)} />
      <strong>{p.profile?.nickname ?? resolvePlayerSlotNickname(p.appearanceSlot, profile?.nickname, nicknames, p.name)}</strong>
      <span>{p.score.toLocaleString()}{p.remainingSteps === undefined ? '' : ` · 剩 ${p.remainingSteps} 步`}</span>
    </div>) : null}
    {!ready && failure === 'none' ? <SceneLoading /> : null}
  </section>;
}
