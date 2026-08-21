import { VOICE_PACK_REPOSITORY, VoicePackRepository } from '../../audio/voice/VoicePackRepository';
import type { VoicePackSummary } from '../../audio/voice/types';

interface VoicePackSettingsProps {
  readonly selectedVoicePackId: string | null;
  readonly onSelect: (packId: string) => void;
  readonly onManage: (packId: string) => void;
  readonly repository?: VoicePackRepository;
}

/** Lightweight Audio Settings entry point. Full line management lives on its own screen. */
export function VoicePackSettings({ selectedVoicePackId, onSelect, onManage, repository = VOICE_PACK_REPOSITORY }: VoicePackSettingsProps) {
  const packs = repository.listPacks();
  return (
    <section className="voice-pack-settings" aria-labelledby="voice-pack-settings-title">
      <h4 id="voice-pack-settings-title">角色语音</h4>
      {packs.length === 0 ? <p className="voice-pack-settings__empty">暂无可用角色语音包。</p> : (
        <div className="voice-pack-settings__list">
          {packs.map((pack) => (
            <VoicePackCard
              key={pack.id}
              pack={pack}
              selected={pack.id === selectedVoicePackId}
              onSelect={() => onSelect(pack.id)}
              onManage={() => onManage(pack.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function VoicePackCard({ pack, selected, onSelect, onManage }: { readonly pack: VoicePackSummary; readonly selected: boolean; readonly onSelect: () => void; readonly onManage: () => void }) {
  return (
    <div className={`voice-pack-card${selected ? ' voice-pack-card--selected' : ''}`}>
      <button type="button" className="voice-pack-card__select" aria-pressed={selected} onClick={onSelect}>
        <span className="voice-pack-card__name">{pack.name}</span>
        <span className="voice-pack-card__locale">{localeLabel(pack.locale)}</span>
      </button>
      <button type="button" className="voice-pack-card__manage" aria-label={`管理 ${pack.name} 语音`} onClick={onManage}>管理 &gt;</button>
    </div>
  );
}

function localeLabel(locale: string): string {
  return locale.toLowerCase() === 'zh-cn' ? '中文' : locale;
}
