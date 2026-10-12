import type { ReactNode } from 'react';
import { regionMatrix, type RegionTuning } from './regionTuning';

/** Identity by default; one matrix moves tiles and their actual hit targets together. */
export function RegionGroup({ tuning, children }: { tuning?: RegionTuning; children: ReactNode }) {
  return <group matrix={regionMatrix(tuning)} matrixAutoUpdate={false}>{children}</group>;
}
