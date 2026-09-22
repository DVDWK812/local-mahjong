/** One-shot commit of this Canvas, not another R3F root's global after-effect. */
export function requestInitialFrameCommit({ afterFrame, invalidate, hasRendered, onReady }: Readonly<{
  afterFrame: (callback: () => void) => () => void;
  invalidate: () => void;
  hasRendered: () => boolean;
  onReady: () => void;
}>): () => void {
  let active = true;
  const remove = afterFrame(() => {
    if (!active || !hasRendered()) return;
    active = false;
    remove();
    onReady();
  });
  invalidate();
  return () => { active = false; remove(); };
}

/** A lease invalidates pending callbacks on cleanup, including StrictMode replay. */
export class SceneSessionLifetime {
  private generation = 0;
  private active = false;

  activate(): () => void {
    const generation = ++this.generation;
    this.active = true;
    return () => {
      if (generation === this.generation) this.active = false;
    };
  }

  cancel(): void {
    this.active = false;
    this.generation += 1;
  }

  guard<T extends unknown[]>(callback: (...args: T) => void): (...args: T) => void {
    const generation = this.generation;
    return (...args) => {
      if (this.active && generation === this.generation) callback(...args);
    };
  }
}
