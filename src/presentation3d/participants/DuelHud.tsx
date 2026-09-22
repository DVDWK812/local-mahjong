import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Table3DPlayerFrame } from '../Table3DHud';
import { getAvatarFrameTuning, TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';
import { resolvePlayerSlotAvatar, resolvePlayerSlotNickname, usePlayerSlotAvatars, usePlayerSlotNicknames } from '../../presentation/appearance/playerSlotAvatars';
import type { PlayerProfile } from '../../profile/playerProfile';
import type { TableParticipant } from './participantPresentation';
import type { ParticipantSeat } from './participantLayout';
import { resolveHandPackForPlayer, usePlayerSlotAppearances } from '../../presentation/appearance/playerSlotAppearance';
import type { AppearanceSettings } from '../../presentation/appearance/appearanceSettings';

export function DuelHud({ participants, mapping, profile, dora, settings }: {
  participants: readonly TableParticipant[]; mapping: readonly ParticipantSeat[]; profile?: PlayerProfile; dora?: ReactNode; settings: AppearanceSettings;
}) {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: TABLE_PRESENTATION_TUNING.responsiveLayout.referenceWidth as number, height: TABLE_PRESENTATION_TUNING.responsiveLayout.referenceHeight as number });
  const avatars = usePlayerSlotAvatars();
  const names = usePlayerSlotNicknames();
  const appearances = usePlayerSlotAppearances();
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const update = () => { const { width, height } = element.getBoundingClientRect(); setSize(old => old.width === width && old.height === height ? old : { width, height }); };
    update();
    const observer = new ResizeObserver(update); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <section ref={ref} className="table-3d-hud" aria-label="17步牌桌信息层">
    <div className="table-3d-dora-layer">{dora}</div>
    {mapping.map(({ participantId, seat }) => {
      const p = participants.find(p => p.id === participantId)!;
      const position = seat === 'bottom' ? 'south' : 'north';
      const tuning = getAvatarFrameTuning(seat, size.width, size.height);
      return <div key={p.id} className={`table-3d-player-frame table-3d-player-frame--${position}`} data-player-slot={seat} data-participant-id={p.id} data-player-index={p.appearanceSlot}
        data-hand-pack={resolveHandPackForPlayer(p.appearanceSlot, appearances, settings).id}
        style={{ '--avatar-frame-offset-x': `${tuning.x}px`, '--avatar-frame-offset-y': `${tuning.y}px`, '--avatar-frame-size': tuning.size } as CSSProperties}>
        <Table3DPlayerFrame player={{ name: p.name, river: [...p.discardedTiles] }} position={position} tsumoGiriDisplayEnabled={false}
          avatarId={resolvePlayerSlotAvatar(p.appearanceSlot, profile?.avatarId, avatars)} nickname={resolvePlayerSlotNickname(p.appearanceSlot, profile?.nickname, names, p.name)} />
      </div>;
    })}
  </section>;
}

export function DuelCentralHud({ participants, mapping, label, currentParticipantId }: {
  participants: readonly TableParticipant[]; mapping: readonly ParticipantSeat[]; label: string; currentParticipantId?: string;
}) {
  return <div className="table-3d-console-hud" aria-label="17步中央信息区" data-hud-anchor="central-console-3d"
    style={{ '--table-3d-hud-font-size': TABLE_PRESENTATION_TUNING.centralHud.fontSize } as CSSProperties}>
    <section className="table-center" aria-label="中央计分区"><div className="center-score-grid">
      {mapping.map(({ participantId, seat }) => {
        const p = participants.find(p => p.id === participantId)!;
        return <div key={p.id} className={`center-score center-score--${seat === 'bottom' ? 'south' : 'north'} ${currentParticipantId === p.id ? 'center-score--current' : ''}`} data-center-slot={seat} data-participant-id={p.id}>
          <span>{seat === 'bottom' ? '本家' : '对家'} · 剩{p.remainingSteps}步</span><strong>{p.score.toLocaleString()}</strong>
        </div>;
      })}
      <div className="center-round"><strong>{label}</strong><span>17步麻将</span></div>
    </div></section>
  </div>;
}
