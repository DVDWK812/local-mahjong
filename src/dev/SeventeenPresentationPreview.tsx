import { SeventeenStepsScreen } from '../components/SeventeenStepsScreen';
import { getRulePreset } from '../game/match/matchRules';
import { createSeventeenPresentationFixture } from './seventeenPresentationFixtures';
import { loadAppearanceSettings } from '../presentation/appearance/appearanceSettingsStorage';
import { loadPlayerProfile } from '../profile/playerProfileStorage';
import { useState } from 'react';
import { loadPlayerSlotAppearances, type PlayerSlotAppearances } from '../presentation/appearance/playerSlotAppearance';

export default function SeventeenPresentationPreview() {
  const [appearances] = useState<PlayerSlotAppearances>(() => {
    const saved = loadPlayerSlotAppearances();
    return new URLSearchParams(location.search).get('seventeenPacks') === 'split'
      ? { ...saved, 0: { ...saved[0], handAppearance: 'female' }, 1: { ...saved[1], handAppearance: 'male' } } : saved;
  });
  const [state] = useState(() => {
    const fixture = new URLSearchParams(location.search).get('seventeenFixture');
    return createSeventeenPresentationFixture(fixture === 'initial' || fixture === 'ron' || fixture === 'cross-row' ? fixture : 'last-turn');
  });
  return <SeventeenStepsScreen initialState={state} previewAppearances={appearances} matchConfig={state.matchConfig} ruleConfig={getRulePreset('east-round')}
    appearanceSettings={loadAppearanceSettings(localStorage)} playerProfile={loadPlayerProfile(localStorage)} onBack={() => { location.href = '/'; }} />;
}
