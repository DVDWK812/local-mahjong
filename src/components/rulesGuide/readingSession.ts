/** Keeps the existing runtime and its authority-owned budget, including an earlier pause. */
export function beginRulesReading(runtime: { paused: boolean; pause: () => unknown; activate: () => void }): () => void {
  const wasPaused=runtime.paused;
  if (!wasPaused) runtime.pause();
  let closed=false;
  return () => { if (closed) return; closed=true; if (!wasPaused) runtime.activate(); };
}
