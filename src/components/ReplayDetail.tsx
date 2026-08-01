import type { ReplayRecord } from '../game/persistence/storageTypes';
import { ReplayScreen } from './ReplayScreen';
import type { TestScenarioV1 } from '../game/testMode/types';

interface ReplayDetailProps {
  replay: ReplayRecord;
  onBack?: () => void;
  testModeEnabled?: boolean;
  onConvertToTestScenario?: (scenario: TestScenarioV1) => void;
}

export function ReplayDetail({ replay, onBack, testModeEnabled = false, onConvertToTestScenario }: ReplayDetailProps) {
  return <ReplayScreen replay={replay} onBack={onBack} testModeEnabled={testModeEnabled} onConvertToTestScenario={onConvertToTestScenario} />;
}
