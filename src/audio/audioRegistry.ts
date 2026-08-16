import type { AudioChannel } from './audioSettings';

export type BgmTrackId = 'home' | 'game' | 'riichi';
export type SfxId = 'discard' | 'riichi' | 'draw' | 'chi' | 'pon' | 'kan' | 'win';
export type VoiceId = 'round-start' | 'win';

export interface AudioAssetDefinition {
  readonly id: string;
  readonly channel: AudioChannel;
  readonly src: string;
  readonly loop: boolean;
  readonly source: 'self-generated' | 'project-local';
}

export interface AudioAssetRegistry {
  readonly bgm: Partial<Record<BgmTrackId, AudioAssetDefinition>>;
  readonly sfx: Partial<Record<SfxId, AudioAssetDefinition>>;
  readonly voice: Partial<Record<VoiceId, AudioAssetDefinition>>;
}

// 60ms mono WAV synthesized for this project. It is intentionally tiny and contains no third-party material.
const DISCARD_SFX_DATA_URI = 'data:audio/wav;base64,UklGRuQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YcADAAB0CQgmtDIyF2/9JOFI0dPmnvzlF+8ZDhpcCLbuFeoM5qXznPybEf8YYw8RCNjyr+hv4dzztggPFQgfkg+Y++nhP+Gs7VgAXxrTHWgU2vh/6avjLeowA5sSXxomDUkAOvH15xbyw/wZC/UMHg6qBVn4TvUu8nH43vxRCBkN8giBBRn6+fNO73j4iAOtCr4QNQm9/rvwl+999Sf/Ng3AD3QLPf3k9DHx9PPAAAMJpQ1aB/0ABfmx82T4j/0NBWcGlQecA7383Pqz+IL7pf3YA88GHAWMA3X92fnw9nT7SQFcBfwIWgXm/0z4SvcK+gP/kwZGCGAGEv+R+kz4Zvnr/1EEBgcQBPIAwvy8+eH7Wf48AiADCQQ1ArD+kv0t/GP9Zf65AYMD4AIzAvj+4vwc+1D9XgCqAssEEgM/ACT8Zvuo/DL/PwNTBIUDyP9e/QT8aPy2/woCmAM5ArcAhv7V/Mn98v70AIABIgJQAYX/4f4D/oL+9/6+AMwBmQFUAaD/b/5g/XD+BwBPAYsCvgFKABX+lf0j/m3/lgFAAu4BBgC9/vP9Dv65//IA1AE0AXwAWf9o/tL+W/9iALYAHgHDANz/f//5/in/W/9NAOkA4QDJAOT/Of+a/hr/7f+iAFgB+gA8AA3/vf75/p//xQAqAQ0BFgBo//P+9P7L/24A7QCmAE8Auf80/2H/nv8kAFQAlQBwAPv/yP96/4j/nf8cAHUAegB1AP7/nv9C/37/6v9NALUAiwArAIn/WP9w/8P/XgCZAJEAFQC5/3f/cf/c/zEAdwBYADAA4/+b/6z/x/8LACYATQA/AAUA6f+8/77/xf8IADoAQgBDAAUA0f+c/7f/7v8kAF4ATQAcAMf/qf+x/9v/LQBPAE4AEADg/7v/tP/p/xUAOwAvAB0A9v/O/9X/3/8BABAAJwAjAAYA+P/e/9z/3v8BAB0AIwAmAAYA6f/L/9f/8/8QADEAKgASAOT/0//W/+r/FQAoACoACwDy/93/2P/y/wgAHQAYABEA/f/o/+r/7v///wcAFAATAAUA/v/v/+3/7P/+/w4AEwAVAAUA9f/k/+r/+P8HABkAFwALAPP/6f/p//P/CQAUABYABwD6/+//6//4/wMADgANAAoAAAD0//X/9v/+/wIACgAKAAQAAAD4//b/9f/+/wcACgAMAAQA+//y//T/+/8DAA0ADAAHAPr/9P/0//j/BAAKAAwABAD+//f/9f/7/wEABwAHAAUAAAD6//r/+v/+/wEABQAGAAIAAAD8//v/+v8=';

export const AUDIO_ASSETS: AudioAssetRegistry = Object.freeze({
  bgm: Object.freeze({}),
  sfx: Object.freeze({
    discard: Object.freeze({
      id: 'discard',
      channel: 'sfx',
      src: DISCARD_SFX_DATA_URI,
      loop: false,
      source: 'self-generated',
    }),
  }),
  voice: Object.freeze({}),
});

export const EMBEDDED_AUDIO_ASSET_BYTES = 1004;
