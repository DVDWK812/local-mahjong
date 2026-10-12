import type { MatchRuntime } from '../timeControl/matchRuntime';
import type { GbState } from './types';

/** Local reading owns only its acquired pause. An existing user/replay pause survives. */
export class GbReadingPause {
  private reasons = new Set<string>();
  private resumeOwned = false;
  constructor(private readonly runtime: MatchRuntime<GbState>) {}
  get held(): boolean { return this.reasons.size > 0; }
  acquire(reason: string): void {
    if (this.reasons.has(reason)) return;
    if (!this.held) { this.resumeOwned = !this.runtime.paused; if (this.resumeOwned) this.runtime.pauseForReading(); }
    this.reasons.add(reason);
  }
  release(reason: string, resumeAllowed = true): void {
    if (!this.reasons.delete(reason) || this.held) return;
    const resume = this.resumeOwned; this.resumeOwned = false;
    if (resume && resumeAllowed) this.runtime.activate();
  }
}
