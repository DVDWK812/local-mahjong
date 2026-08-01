export interface RandomSource {
  readonly seed?: string;
  next(): number;
  nextId(scope: string): string;
}

export const productionRandomSource: RandomSource = {
  next: () => Math.random(),
  nextId: (scope) => {
    const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    return `${scope}-${randomId}`;
  },
};

export function createSeededRandomSource(seed: string): RandomSource {
  const normalizedSeed = seed.trim() || 'seed';
  const safeSeed = normalizedSeed.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'seed';
  let state = hashSeed(normalizedSeed);
  let idSequence = 0;
  return {
    seed: normalizedSeed,
    next: () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    nextId: (scope) => {
      const sequence = idSequence;
      idSequence += 1;
      return `${safeSeed}-${String(sequence).padStart(4, '0')}-${scope}`;
    },
  };
}

export function randomValue(source: RandomSource | (() => number)): number {
  return typeof source === 'function' ? source() : source.next();
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
