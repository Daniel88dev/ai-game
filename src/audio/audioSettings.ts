/**
 * Player audio preferences. They are a device setting, not game progress:
 * they live in localStorage next to the save slots (same key prefix) but are
 * never written into a save file, so an exported save stays the same on every machine.
 */
export interface AudioSettings {
  readonly musicOn: boolean;
  /** 0..1 */
  readonly musicVolume: number;
  readonly sfxOn: boolean;
  /** 0..1 */
  readonly sfxVolume: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  musicOn: true,
  musicVolume: 0.5,
  sfxOn: true,
  sfxVolume: 0.7,
};

export const AUDIO_SETTINGS_KEY = 'merge-conflict:settings:audio';

const clamp01 = (n: unknown, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
const bool = (b: unknown, fallback: boolean): boolean => (typeof b === 'boolean' ? b : fallback);

/** Tolerant parser: unknown, missing or broken fields fall back to the defaults. */
export function parseAudioSettings(raw: string | null): AudioSettings {
  if (!raw) return DEFAULT_AUDIO_SETTINGS;
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_AUDIO_SETTINGS;
    data = parsed as Record<string, unknown>;
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
  const d = DEFAULT_AUDIO_SETTINGS;
  return {
    musicOn: bool(data.musicOn, d.musicOn),
    musicVolume: clamp01(data.musicVolume, d.musicVolume),
    sfxOn: bool(data.sfxOn, d.sfxOn),
    sfxVolume: clamp01(data.sfxVolume, d.sfxVolume),
  };
}

export function mergeAudioSettings(current: AudioSettings, patch: Partial<AudioSettings>): AudioSettings {
  return parseAudioSettings(JSON.stringify({ ...current, ...patch }));
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Reads and writes the settings; silently keeps them in memory when storage is blocked. */
export class AudioSettingsStore {
  constructor(private readonly storage: KeyValueStorage | null) {}

  load(): AudioSettings {
    try {
      return parseAudioSettings(this.storage?.getItem(AUDIO_SETTINGS_KEY) ?? null);
    } catch {
      return DEFAULT_AUDIO_SETTINGS;
    }
  }

  save(settings: AudioSettings): void {
    try {
      this.storage?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* private mode / storage full: the setting still applies for this session */
    }
  }
}
