/** Opt-in DEV diagnostics only. No timer, subscription, hidden tiles, or persisted state. */
export type CandidateTraceEntry = { at: number; label: string; detail: unknown };
declare global { interface Window { __candidateTrace?: CandidateTraceEntry[] } }
export const candidateTraceEnabled = () => import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('candidateTrace') === '1';
export function traceCandidate(label: string, detail: unknown = null) {
  if (!candidateTraceEnabled()) return;
  const entries = window.__candidateTrace ??= [];
  entries.push({ at: performance.now(), label, detail });
  if (entries.length > 4000) entries.splice(0, entries.length - 4000);
}
