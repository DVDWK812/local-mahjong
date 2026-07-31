import type { ReplayRecord } from '../game/persistence/storageTypes';
import { ReplayScreen } from './ReplayScreen';

interface ReplayDetailProps {
  replay: ReplayRecord;
  onBack?: () => void;
}

export function ReplayDetail({ replay, onBack }: ReplayDetailProps) {
  return <ReplayScreen replay={replay} onBack={onBack} />;
}
