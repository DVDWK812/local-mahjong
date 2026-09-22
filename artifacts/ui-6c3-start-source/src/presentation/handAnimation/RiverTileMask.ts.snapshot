export interface MaskableRiverTile {
  readonly style: { visibility: string };
  setAttribute?(name: string, value: string): void;
  removeAttribute?(name: string): void;
}

interface MaskRecord {
  readonly element: MaskableRiverTile;
  readonly previousVisibility: string;
}

export class RiverTileMask {
  private readonly records = new Map<string, MaskRecord>();

  get maskedCount(): number {
    return this.records.size;
  }

  mask(eventId: string, element: MaskableRiverTile): void {
    const current = this.records.get(eventId);
    if (current?.element === element) {
      element.style.visibility = 'hidden';
      element.setAttribute?.('data-hand-animation-masked', 'true');
      return;
    }
    this.reveal(eventId);
    this.records.set(eventId, { element, previousVisibility: element.style.visibility });
    element.style.visibility = 'hidden';
    element.setAttribute?.('data-hand-animation-masked', 'true');
  }

  reveal(eventId: string): void {
    const record = this.records.get(eventId);
    if (!record) return;
    record.element.style.visibility = record.previousVisibility;
    record.element.removeAttribute?.('data-hand-animation-masked');
    this.records.delete(eventId);
  }

  revealAll(): void {
    [...this.records.keys()].forEach((eventId) => this.reveal(eventId));
  }
}
