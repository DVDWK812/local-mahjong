/** One continuous carry curve and contact/pose mapping for both DOM and 3D owners. */
export function resolveTsumoSlapMotion(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  const travel = p * p * (3 - 2 * p);
  return {
    travel,
    offsetY: p === 0 ? 0 : -72 * travel,
    handPhase: p < 0.25 ? 'grasp' as const : p < 1 ? 'carry' as const : 'release' as const,
    handProgress: p < 0.25 ? p / 0.25 : p < 1 ? (p - 0.25) / 0.75 : 1,
  };
}
