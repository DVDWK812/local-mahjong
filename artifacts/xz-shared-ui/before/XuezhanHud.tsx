import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { XzState } from '../game/xuezhan/types';
import type { PlayerProfile } from '../profile/playerProfile';
import { Table3DPlayerFrame } from '../presentation3d/Table3DHud';
import { getAvatarFrameTuning, TABLE_PRESENTATION_TUNING } from '../presentation3d/table/tablePresentationTuning';
import { resolvePlayerSlotAvatar, resolvePlayerSlotNickname, usePlayerSlotAvatars, usePlayerSlotNicknames } from '../presentation/appearance/playerSlotAvatars';
const positions = ['south', 'east', 'north', 'west'] as const;
const slots = ['bottom', 'right', 'top', 'left'] as const;
/** Same cards, avatars and frozen responsive placement as the four-player HUD. */
export function XuezhanHud({ state, profile }: { state: XzState; profile?: PlayerProfile }) {
  const ref = useRef<HTMLElement>(null), avatars = usePlayerSlotAvatars(), nicknames = usePlayerSlotNicknames();
  const [size, setSize] = useState<{ width: number; height: number }>({ width: TABLE_PRESENTATION_TUNING.responsiveLayout.referenceWidth, height: TABLE_PRESENTATION_TUNING.responsiveLayout.referenceHeight });
  useEffect(() => { const root = ref.current; if (!root) return; const update = () => { const r = root.getBoundingClientRect(); if (r.width && r.height) setSize({ width: r.width, height: r.height }); }; const observer = new ResizeObserver(update); observer.observe(root); update(); return () => observer.disconnect(); }, []);
  return <section ref={ref} className="table-3d-hud" aria-label="血战四座信息">{state.players.map(p => {
    const tuning = getAvatarFrameTuning(slots[p.id], size.width, size.height);
    return <div key={p.participantId} className={`table-3d-player-frame table-3d-player-frame--${positions[p.id]} xz-player-frame`} data-participant-id={p.participantId} data-won={p.won !== null}
      style={{ '--avatar-frame-offset-x': `${tuning.x}px`, '--avatar-frame-offset-y': `${tuning.y}px`, '--avatar-frame-size': tuning.size } as CSSProperties}>
      <Table3DPlayerFrame player={p} position={positions[p.id]} tsumoGiriDisplayEnabled={false} avatarId={resolvePlayerSlotAvatar(p.id, profile?.avatarId, avatars)} nickname={resolvePlayerSlotNickname(p.id, profile?.nickname, nicknames, p.name)}
        status={<span className="xz-player-status">{p.score} 分<br />{p.won !== null ? `已胡 · 顺位 ${p.won}` : p.missing === null ? state.config.rules.missing === 'dynamic' ? '自由打缺' : '待定缺' : `缺${['万', '筒', '条'][p.missing]}`}</span>} />
    </div>;
  })}</section>;
}
