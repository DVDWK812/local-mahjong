/** Explicit development-only harness. Replay and ordinary Test Mode never opt in. */
export function finalGateRoute(search: string, development: boolean) {
  const params = new URLSearchParams(search);
  const enabled = development && params.get('testMode') === '1' && params.get('uiFinalGate') === '1';
  return { enabled, audio: enabled && params.get('qaAudio') === '1' };
}
