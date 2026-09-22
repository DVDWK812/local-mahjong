import { useEffect, useRef, useState } from 'react';
import { ParticipantTable } from '../presentation3d/participants/ParticipantTable';
import type { TableParticipant } from '../presentation3d/participants/participantPresentation';
import type { ParticipantSeat } from '../presentation3d/participants/participantLayout';
import { loadAppearanceSettings } from '../presentation/appearance/appearanceSettingsStorage';
import { loadPlayerProfile } from '../profile/playerProfileStorage';
import { waitForLocalHandPresentation } from '../components/game/localHandPresentationReady';
import type { TileId } from '../game/types';
import { createTile } from '../game/tileUtils';
import { DEFAULT_PLAYER_SLOT_APPEARANCES } from '../presentation/appearance/playerSlotAppearance';

const previewAppearances = { ...DEFAULT_PLAYER_SLOT_APPEARANCES,
  0: { ...DEFAULT_PLAYER_SLOT_APPEARANCES[0], tileBack: { texture: 'inherit' as const, sideColor: '#236c55' } },
  1: { ...DEFAULT_PLAYER_SLOT_APPEARANCES[1], tileBack: { texture: 'inherit' as const, sideColor: '#345aa0' } },
  2: { ...DEFAULT_PLAYER_SLOT_APPEARANCES[2], tileBack: { texture: 'inherit' as const, sideColor: '#984a45' } },
};

/** Only imported by the DEV branch in main. No Rules/GameState or production navigation. */
export function previewParticipants(riverCount: number): readonly TableParticipant[] {
  return [0, 1, 2].map((slot) => ({
    id: `preview:${slot}`, appearanceSlot: slot as 0 | 1 | 2, name: `预览玩家${slot + 1}`, score: 25000 + slot * 1200,
    profile: { nickname: ['青竹', '蓝海', '赤枫'][slot], avatarId: (['animal-rabbit', 'avatar-04', 'avatar-03'] as const)[slot] },
    fixedHand: { visibility: 'hidden', count: 13 }, discardCandidates: { visibility: 'hidden', count: 0 },
    discardedTiles: Array.from({ length: riverCount }, (_, index) => ({ ...createTile(((index + slot * 9) % 34) as TileId, 0), instanceId: `preview:${slot}:river:${index}`, red: index === 4 && slot === 0 })),
  }));
}
export default function ParticipantLayoutPreview() {
  const [many, setMany] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const [settings] = useState(() => loadAppearanceSettings(localStorage));
  const [profile] = useState(() => loadPlayerProfile(localStorage));
  useEffect(() => {
    const abort = new AbortController();
    void waitForLocalHandPresentation(() => Array.from(ref.current?.querySelectorAll('img') ?? []), undefined, abort.signal).then(value => { if (value) setReady(true); });
    return () => abort.abort();
  }, []);
  const seats = ['bottom', 'right', 'left'] as const;
  const mapping: ParticipantSeat[] = seats.map((seat, index) => ({ participantId: `preview:${(index + rotation) % 3}`, seat }));
  return <main ref={ref} className="participant-preview">
    <header><h1>布局预览，非三人玩法</h1>
      <button onClick={() => setMany(value => !value)}>切换少量/18张牌河</button>
      <button onClick={() => setRotation(value => (value + 1) % 3)}>轮换显示位置</button>
      <button onClick={() => setMounted(value => !value)}>{mounted ? '退出预览' : '重新进入'}</button>
      <a href="/">返回主菜单</a>
    </header>
    {mounted ? <ParticipantTable participants={previewParticipants(many ? 18 : 3)} mapping={mapping} preset="three-preview" sessionKey="three-preview" localReady={ready} settings={settings} profile={profile} appearanceSlots={previewAppearances} label="布局预览，非三人玩法" /> : <p>预览已退出</p>}
  </main>;
}
