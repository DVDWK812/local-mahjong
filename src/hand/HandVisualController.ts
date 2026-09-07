import { HAND_ASSETS, preloadHandAssets, type HandPose } from './handAssets';
import type { HandPresentationPhase } from '../presentation/handAnimation/HandPresentationSnapshot';
import type { HandAnimationPhase } from '../presentation/handAnimation/HandAnimationController';
import type { Table3DSeat } from '../presentation3d/coordinates/seatTransforms';
import './handVisual.css';

export type HandVisualPhase = HandPresentationPhase | HandAnimationPhase | 'enter' | 'proxy-ready';
export type HandContact = Readonly<{ x: number; y: number; width: number }>;
export const HAND_SEAT_VISUAL = {
  bottom: { rotation: 0, entry: [0.3, 1] },
  right: { rotation: -90, entry: [1, -0.3] },
  top: { rotation: 180, entry: [-0.3, -1] },
  left: { rotation: 90, entry: [-1, 0.3] },
} as const;
const clamp = (p: number) => Math.max(0, Math.min(1, p));
export const handEase = (p: number) => { const t = clamp(p); return t * t * (3 - 2 * t); };

export function resolveHandPose(phase: HandVisualPhase, progress: number, tsumogiri = false) {
  const p = clamp(progress);
  let from: HandPose = 'reach-open';
  let to: HandPose = from;
  let blend = 0;
  let opacity = 1;
  if (phase === 'lift') {
    opacity = handEase(p / 0.2);
    if (p < 0.4) { from = 'reach-open'; to = 'touch-contact'; blend = handEase((p - 0.2) / 0.2); }
    else { from = 'touch-contact'; to = 'pinch-grab'; blend = handEase((p - 0.4) / 0.25); }
  } else if (phase === 'grasp') {
    from = 'touch-contact'; to = 'pinch-grab'; blend = handEase(p / 0.5);
  } else if (phase === 'carry' || phase === 'travel') {
    from = 'pinch-grab'; to = 'carry-forward'; blend = handEase(p / 0.2);
  } else if (phase === 'river-settle' || phase === 'release') {
    from = 'carry-forward'; to = 'release-open'; blend = handEase(p / 0.45);
  } else if (phase === 'gap-hold' || phase === 'retreat' || phase === 'complete') {
    from = phase === 'complete' && !tsumogiri ? 'arrange-push' : 'release-open';
    to = 'retract-relaxed'; blend = handEase(p / 0.4); opacity = 1 - handEase(p);
  } else if (phase === 'insert' && !tsumogiri) {
    from = 'touch-contact'; to = 'pinch-grab'; blend = handEase(p / 0.25); opacity = handEase(p / 0.15);
  } else if (phase === 'reorder' && !tsumogiri) {
    from = 'pinch-grab'; to = 'arrange-push'; blend = handEase(p / 0.25);
  } else if (phase === 'approach') {
    to = 'touch-contact'; blend = handEase((p - 0.65) / 0.35); opacity = handEase(p);
  }
  else opacity = 0;
  return { from, to, blend, opacity };
}

export function resolveHandVisual(contact: HandContact, seat: Table3DSeat, phase: HandVisualPhase,
  progress: number, tsumogiri = false) {
  const pose = resolveHandPose(phase, progress, tsumogiri);
  const style = HAND_SEAT_VISUAL[seat];
  const reach = phase === 'lift' ? 1 - handEase(progress / 0.4)
    : phase === 'approach' ? 1 - handEase(progress) : 0;
  const retract = phase === 'gap-hold' || phase === 'complete' || phase === 'retreat' ? handEase(progress) : 0;
  const distance = (reach + retract) * 110;
  return { ...pose, x: contact.x + style.entry[0] * distance, y: contact.y + style.entry[1] * distance,
    size: Math.max(220, Math.min(320, contact.width * 5.2)),
    rotation: style.rotation + reach * 4 - retract * 4, scale: 1 - 0.035 * (reach + retract) };
}

/** Passive visual consumer. The owner's existing scheduler supplies every update and cleanup. */
export class HandVisualController {
  private root: HTMLDivElement | null = null;
  private readonly images: HTMLImageElement[] = [];
  private disposed = false;

  constructor(private readonly eventId: string, private readonly seat: Table3DSeat) {}

  update(contact: HandContact, phase: HandVisualPhase, progress: number, tsumogiri = false): void {
    if (this.disposed || typeof document === 'undefined') return;
    const visual = resolveHandVisual(contact, this.seat, phase, progress, tsumogiri);
    if (!this.root) {
      void preloadHandAssets();
      this.root = document.createElement('div');
      this.root.className = 'hand-visual-sprite';
      this.root.setAttribute('aria-hidden', 'true');
      this.root.dataset.handVisualEvent = this.eventId;
      this.root.dataset.handVisualSeat = this.seat;
      for (let i = 0; i < 2; i++) {
        const image = document.createElement('img');
        image.alt = ''; image.draggable = false;
        this.root.appendChild(image); this.images.push(image);
      }
      document.body.appendChild(this.root);
    }
    this.root.dataset.handVisualPhase = phase;
    this.root.dataset.handVisualPose = visual.blend < 0.5 ? visual.from : visual.to;
    this.root.dataset.contactX = String(contact.x);
    this.root.dataset.contactY = String(contact.y);
    Object.assign(this.root.style, { left: `${visual.x}px`, top: `${visual.y}px`,
      opacity: String(visual.opacity), transform: `rotate(${visual.rotation}deg) scale(${visual.scale})` });
    [visual.from, visual.to].forEach((pose, index) => {
      const asset = HAND_ASSETS[pose];
      const image = this.images[index];
      image.dataset.handPose = pose;
      if (image.getAttribute('src') !== asset.url) image.src = asset.url;
      Object.assign(image.style, { width: `${visual.size}px`, height: `${visual.size}px`,
        left: `${-asset.contact[0] * visual.size}px`, top: `${-asset.contact[1] * visual.size}px`,
        transformOrigin: `${asset.contact[0] * 100}% ${asset.contact[1] * 100}%`,
        transform: `rotate(${asset.rotation}deg)`, opacity: String(index === 0 ? 1 - visual.blend : visual.blend) });
    });
  }

  hide(): void { if (this.root) this.root.style.opacity = '0'; }
  dispose(): void { this.disposed = true; this.root?.remove(); this.root = null; this.images.length = 0; }
}
