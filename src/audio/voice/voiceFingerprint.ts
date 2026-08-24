import type { VoiceGenerationCacheEntry, VoiceSynthesisSettings } from './types';
import { canonicalEffectiveGenerationConfigPayload, type EffectiveGenerationConfig, VOICE_FINGERPRINT_VERSION } from './effectiveGenerationConfig';

/**
 * Canonical generation fingerprint contract shared with generate_voice.py.
 */
export function voiceFingerprint(config: EffectiveGenerationConfig): string {
  return sha256Utf8(canonicalEffectiveGenerationConfigPayload(config));
}

/** Pre-advanced-settings cache contract. It is retained only to avoid recharging existing default MP3s. */
export function legacyVoiceFingerprint(config: EffectiveGenerationConfig, synthesis: VoiceSynthesisSettings): string {
  return sha256Utf8([config.voiceId, config.modelId, config.text, pythonFloatString(synthesis.speed), synthesis.format].join('\x1f'));
}

/** The Phase 8.5.2 full-settings format had no explicit version field. */
export function v1VoiceFingerprint(config: EffectiveGenerationConfig): string {
  return sha256Utf8([
    config.voiceId, config.modelId, config.text, pythonFloatString(config.speed ?? 0), config.format,
    pythonFloatString(config.volume ?? 0), pythonFloatString(config.stability ?? 0), pythonFloatString(config.similarity ?? 0),
    config.effectiveLanguage ?? '', String(config.textNormalization ?? false),
  ].join('\x1f'));
}

export function isLegacyCacheCompatible(
  cache: VoiceGenerationCacheEntry,
  config: EffectiveGenerationConfig,
  synthesis: VoiceSynthesisSettings,
  inheritedLanguage: string,
): boolean {
  return cache.volume === undefined && cache.stability === undefined && cache.similarity === undefined
    && cache.language === undefined && cache.textNormalization === undefined
    && config.speed === synthesis.speed && config.volume === 0 && config.stability === 1 && config.similarity === 1
    // A legacy cache did not encode language, so it is safe only for the
    // original inherited Pack locale.  Python makes the same distinction.
    && config.effectiveLanguage === inheritedLanguage && config.textNormalization === true
    && cache.fingerprint === legacyVoiceFingerprint(config, synthesis);
}

export function isV1CacheCompatible(cache: VoiceGenerationCacheEntry, config: EffectiveGenerationConfig): boolean {
  return cache.fingerprintVersion === undefined
    && cache.volume !== undefined && cache.stability !== undefined && cache.similarity !== undefined
    && cache.language !== undefined && cache.textNormalization !== undefined
    && cache.fingerprint === v1VoiceFingerprint(config);
}

export function isV2CacheCompatible(cache: VoiceGenerationCacheEntry, config: EffectiveGenerationConfig): boolean {
  return cache.fingerprintVersion === VOICE_FINGERPRINT_VERSION && cache.fingerprint === voiceFingerprint(config);
}

function pythonFloatString(value: number): string {
  // The active config uses ordinary decimal speeds. Python's str(1.0) retains
  // the decimal while JavaScript's String(1) does not.
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

/** Small synchronous SHA-256 implementation so browser status checks need no network or Node APIs. */
export function sha256Utf8(value: string): string {
  const source = new TextEncoder().encode(value);
  const bitLength = source.length * 8;
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(source); bytes[source.length] = 0x80;
  bytes[paddedLength - 4] = (bitLength >>> 24) & 0xff;
  bytes[paddedLength - 3] = (bitLength >>> 16) & 0xff;
  bytes[paddedLength - 2] = (bitLength >>> 8) & 0xff;
  bytes[paddedLength - 1] = bitLength & 0xff;
  const hash = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = ((bytes[offset + index * 4] << 24) | (bytes[offset + index * 4 + 1] << 16) | (bytes[offset + index * 4 + 2] << 8) | bytes[offset + index * 4 + 3]) >>> 0;
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15]; const right = words[index - 2];
      const s0 = ((left >>> 7) | (left << 25)) ^ ((left >>> 18) | (left << 14)) ^ (left >>> 3);
      const s1 = ((right >>> 17) | (right << 15)) ^ ((right >>> 19) | (right << 13)) ^ (right >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const choice = (e & f) ^ (~e & g); const temporary1 = (h + s1 + choice + constants[index] + words[index]) >>> 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const majority = (a & b) ^ (a & c) ^ (b & c); const temporary2 = (s0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temporary1) >>> 0; d = c; c = b; b = a; a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0; hash[1] = (hash[1] + b) >>> 0; hash[2] = (hash[2] + c) >>> 0; hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0; hash[5] = (hash[5] + f) >>> 0; hash[6] = (hash[6] + g) >>> 0; hash[7] = (hash[7] + h) >>> 0;
  }
  return [...hash].map((part) => part.toString(16).padStart(8, '0')).join('');
}
