import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrthographicCamera } from 'three';
import { HandVisualController, resolveHandPose, resolveHandVisual } from './HandVisualController';
import { projectHandContact } from './handProjection';
import { localHandContact } from '../components/game/LocalAnimationHand';
import { HAND_ASSETS } from './handAssets';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const contact = { x: 640, y: 500, width: 48 };

describe('passive hand visual phases', () => {
  it('reaches before lifting, stays on the proxy during carry, releases then retracts', () => {
    expect(resolveHandPose('idle', 0).opacity).toBe(0);
    expect(resolveHandPose('lift', 0).opacity).toBe(0);
    expect(resolveHandPose('lift', 0.4).from).toBe('touch-contact');
    expect(resolveHandPose('lift', 1).to).toBe('pinch-grab');
    expect(resolveHandPose('carry', 1).to).toBe('carry-forward');
    expect(resolveHandPose('river-settle', 1).to).toBe('release-open');
    expect(resolveHandPose('gap-hold', 0).opacity).toBe(1);
    expect(resolveHandPose('gap-hold', 1).opacity).toBe(0);
    expect(resolveHandPose('complete', 1).opacity).toBe(0);
  });
  it('does not re-enter between normal draw approach and grasp', () => {
    const before = resolveHandVisual(contact, 'bottom', 'approach', 1);
    const after = resolveHandVisual(contact, 'bottom', 'grasp', 0);
    expect([after.x, after.y, after.rotation, after.scale]).toEqual([before.x, before.y, before.rotation, before.scale]);
    expect(before.to).toBe(after.from);
  });
  it('guides the drawn tile and arranges only tedashi', () => {
    expect(resolveHandPose('insert', 1).to).toBe('pinch-grab');
    expect(resolveHandPose('reorder', 1).to).toBe('arrange-push');
    for (const phase of ['lift', 'carry', 'river-settle', 'complete', 'insert', 'reorder'] as const) {
      for (const p of [0, 0.25, 0.5, 1]) {
        const pose = resolveHandPose(phase, p, true);
        expect([pose.from, pose.to]).not.toContain('arrange-push');
      }
    }
  });
  it.each(['bottom', 'right', 'top', 'left'] as const)('%s follows the same contact during grab/carry and exits towards its seat', seat => {
    for (const phase of ['lift', 'carry', 'river-settle', 'insert', 'reorder'] as const) {
      const visual = resolveHandVisual(contact, seat, phase, 1);
      expect([visual.x, visual.y]).toEqual([contact.x, contact.y]);
    }
    const end = resolveHandVisual(contact, seat, 'complete', 1);
    if (seat === 'bottom') expect(end.y).toBeGreaterThan(contact.y);
    if (seat === 'right') expect(end.x).toBeGreaterThan(contact.x);
    if (seat === 'top') expect(end.y).toBeLessThan(contact.y);
    if (seat === 'left') expect(end.x).toBeLessThan(contact.x);
  });
  it('crossfades in a bounded interval with constant combined layer weight', () => {
    const visual = resolveHandPose('carry', 0.1);
    expect(visual.blend).toBeCloseTo(0.5);
    expect(resolveHandPose('carry', 0.2).blend).toBe(1);
    expect(resolveHandPose('carry', 2).blend).toBe(1);
  });
  it('uses actual local DOM rect after responsive movement', () => {
    expect(localHandContact({ left: 100, top: 400, width: 50, height: 70 })).toMatchObject({ x: 125, y: 435 });
    expect(localHandContact({ left: 900, top: 800, width: 60, height: 84 })).toMatchObject({ x: 930, y: 842 });
    expect(resolveHandVisual({ ...contact, width: 70 }, 'bottom', 'carry', 1).size).toBeLessThanOrEqual(320);
  });
  it('projects through the supplied active camera and canvas offset at both viewports', () => {
    const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    camera.position.z = 10; camera.updateMatrixWorld();
    for (const [width, height] of [[1280, 720], [1920, 1080]]) {
      expect(projectHandContact([1, 1, 0], camera, { left: 20, top: 40, width, height }))
        .toMatchObject({ x: 20 + width * 0.75, y: 40 + height * 0.25 });
    }
    camera.position.x = 1; camera.updateMatrixWorld();
    expect(projectHandContact([1, 1, 0], camera, { left: 0, top: 0, width: 1280, height: 720 }).x).toBe(640);
  });
});

class ElementStub {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  children: ElementStub[] = [];
  parent: ElementStub | null = null;
  src = '';
  setAttribute() {}
  getAttribute(name: string) { return name === 'src' ? this.src : null; }
  appendChild(child: ElementStub) { this.children.push(child); child.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
}

it.each(['skip', 'cancel', 'dispose', 'route change', 'disabled', 'speed change'])('%s removes both crossfade images and ignores stale frames', () => {
  const body = new ElementStub();
  vi.stubGlobal('document', { body, createElement: () => new ElementStub() });
  const controller = new HandVisualController('event-1', 'bottom');
  controller.update(contact, 'carry', 0.1);
  expect(body.children).toHaveLength(1);
  const root = body.children[0];
  expect(root.children).toHaveLength(2);
  expect(root.children.map(child => child.style.opacity)).toEqual(['0.5', '0.5']);
  controller.update(contact, 'river-settle', 1);
  expect(body.children[0]).toBe(root);
  controller.dispose(); controller.dispose();
  controller.update(contact, 'reorder', 0.5);
  expect(body.children).toHaveLength(0);
  const next = new HandVisualController('event-2', 'right');
  next.update(contact, 'lift', 0.5);
  expect(body.children).toHaveLength(1);
  expect(body.children[0].dataset.handVisualEvent).toBe('event-2');
  next.dispose();
  expect(body.children).toHaveLength(0);
});

it('preloads seven explicit URLs once, outside Suspense, and fails open on a decode error', async () => {
  vi.resetModules();
  const loaded: string[] = [];
  vi.stubGlobal('Image', class {
    src = '';
    decode() { loaded.push(this.src); return loaded.length === 3 ? Promise.reject(new Error('decode')) : Promise.resolve(); }
  });
  const { preloadHandAssets } = await import('./handAssets');
  let first!: Promise<void>;
  expect(() => { first = preloadHandAssets(); }).not.toThrow();
  expect(preloadHandAssets()).toBe(first);
  await expect(first).resolves.toBeUndefined();
  expect(new Set(loaded).size).toBe(7);
  expect(loaded).toEqual(Object.values(HAND_ASSETS).map(asset => asset.url));
  expect(loaded.every(url => !url.startsWith('data:'))).toBe(true);
});
