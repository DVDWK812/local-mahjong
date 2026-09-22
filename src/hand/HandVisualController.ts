import {
  DEFAULT_HAND_PACK,
  preloadHandPack,
  resolveHandPoseAsset,
  type HandPack,
  type HandPoseKey,
} from './handPacks';
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
  let from: HandPoseKey = 'reach-open';
  let to: HandPoseKey = from;
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
    // Retain the grip through the landing, then open fingers near contact.
    from = 'carry-forward'; to = 'release-open'; blend = handEase((p - 0.65) / 0.35);
  } else if (phase === 'gap-hold' || phase === 'retreat' || phase === 'complete') {
    from = phase === 'complete' && !tsumogiri ? 'arrange-push' : 'release-open';
    to = 'retract-relaxed'; blend = handEase(p / 0.4); opacity = 1 - handEase(p);
  } else if (phase === 'insert' && !tsumogiri) {
    opacity = handEase(p / 0.18);
    if (p < 0.28) { from = 'reach-open'; to = 'touch-contact'; blend = handEase(p / 0.28); }
    else { from = 'touch-contact'; to = 'pinch-grab'; blend = handEase((p - 0.28) / 0.18); }
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
    : phase === 'approach' ? 1 - handEase(progress)
    : phase === 'insert' && !tsumogiri ? 0.55 * (1 - handEase(progress / 0.28)) : 0;
  const retract = phase === 'gap-hold' || phase === 'complete' || phase === 'retreat' ? handEase(progress) : 0;
  const distance = (reach + retract) * 110;
  return { ...pose, x: contact.x + style.entry[0] * distance, y: contact.y + style.entry[1] * distance,
    size: Math.max(216, Math.min(296, contact.width * 4.8)),
    rotation: style.rotation + reach * 4 - retract * 4, scale: 1 - 0.035 * (reach + retract) };
}

/** Passive visual consumer. The owner's existing scheduler supplies every update and cleanup. */
export class HandVisualController {
  private root: HTMLDivElement | null = null;
  private readonly images: HTMLImageElement[] = [];
  private disposed = false;

  constructor(
    private readonly eventId: string,
    private readonly seat: Table3DSeat,
    private readonly pack: HandPack = DEFAULT_HAND_PACK,
    private readonly playerId?: number,
  ) {}

  update(contact: HandContact, phase: HandVisualPhase, progress: number, tsumogiri = false): void {
    if (this.disposed || typeof document === 'undefined') return;
    const visual = resolveHandVisual(contact, this.seat, phase, progress, tsumogiri);
    if (!this.root) {
      void preloadHandPack(this.pack);
      this.root = document.createElement('div');
      this.root.className = 'hand-visual-sprite';
      this.root.setAttribute('aria-hidden', 'true');
      this.root.dataset.handVisualEvent = this.eventId;
      this.root.dataset.handVisualSeat = this.seat;
      this.root.dataset.handPack = this.pack.id;
      if (this.playerId !== undefined) this.root.dataset.handPlayerId = String(this.playerId);
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
      const asset = resolveHandPoseAsset(this.pack, pose);
      const fallback = DEFAULT_HAND_PACK.poses[pose];
      const image = this.images[index];
      image.dataset.handPose = pose;
      image.dataset.handPack = this.pack.id;
      image.onerror = () => {
        if (image.dataset.handPose !== pose || image.getAttribute('src') === fallback.url) return;
        image.src = fallback.url;
        image.dataset.handAssetFallback = 'female';
      };
      if (image.getAttribute('src') !== asset.url) image.src = asset.url;
      const assetSize = visual.size * asset.scale;
      const crop = asset.crop;
      Object.assign(image.style, { width: `${assetSize}px`, height: `${assetSize}px`,
        left: `${-asset.contact[0] * assetSize + asset.offset[0] * visual.size}px`,
        top: `${-asset.contact[1] * assetSize + asset.offset[1] * visual.size}px`,
        transformOrigin: `${asset.contact[0] * 100}% ${asset.contact[1] * 100}%`,
        transform: `rotate(${asset.rotation}deg)`,
        clipPath: crop ? `inset(${crop.map((value) => `${value * 100}%`).join(' ')})` : '',
        opacity: String(index === 0 ? 1 - visual.blend : visual.blend) });
    });
  }

  hide(): void { if (this.root) this.root.style.opacity = '0'; }
  dispose(): void { this.disposed = true; this.root?.remove(); this.root = null; this.images.length = 0; }
}
