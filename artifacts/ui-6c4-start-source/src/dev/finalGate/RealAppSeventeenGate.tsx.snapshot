import { useState } from 'react';
import App from '../../App';
import { createSeventeenPresentationFixture } from '../seventeenPresentationFixtures';

/** Uses App's real AudioManager, policy, library and route cleanup. No harness audio consumer. */
export default function RealAppSeventeenGate() {
  const [fixture] = useState(() => createSeventeenPresentationFixture('ron'));
  return <App initialSeventeenGate={fixture} />;
}
