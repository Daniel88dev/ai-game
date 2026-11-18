import { mergeAudioSettings, type AudioSettings, type AudioSettingsStore } from './audioSettings';
import type { Cue } from './cues';
import { MusicPlayer } from './musicPlayer';
import { SFX, type SfxId } from './sfx';
import { Synth } from './synth';
import { TRACKS, type TrackId } from './tracks';

export type ContextFactory = () => AudioContext | null;

const browserContext: ContextFactory = () => {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor({ latencyHint: 'interactive' }) : null;
};

/** Volume sliders feel linear to the ear when the gain follows a curve. */
const curve = (v: number) => v * v;
const MUSIC_LEVEL = 0.8;
const SFX_LEVEL = 0.9;

/**
 * Presentation-side audio adapter: owns the AudioContext, the music player and
 * the player's audio settings. It does nothing until `unlock()` runs inside a user
 * gesture, which is what browsers require before a page may make sound.
 * Without WebAudio (tests, very old browsers) every call is a silent no-op.
 */
export class AudioEngine {
  private settings: AudioSettings;
  private ctx: AudioContext | null = null;
  private synth: Synth | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private music: MusicPlayer | null = null;
  private wantedTrack: TrackId | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly store: AudioSettingsStore,
    private readonly createContext: ContextFactory = browserContext,
  ) {
    this.settings = store.load();
  }

  // ------------------------------------------------------------ settings (React reads these)

  getSettings = (): AudioSettings => this.settings;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  update(patch: Partial<AudioSettings>): void {
    this.settings = mergeAudioSettings(this.settings, patch);
    this.store.save(this.settings);
    this.applyVolumes();
    this.syncMusic();
    for (const l of this.listeners) l();
  }

  toggleMusic(): void {
    this.update({ musicOn: !this.settings.musicOn });
  }

  toggleSfx(): void {
    this.update({ sfxOn: !this.settings.sfxOn });
  }

  // ------------------------------------------------------------ playback

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  get currentTrack(): TrackId | null {
    return this.music?.trackId ?? null;
  }

  /** Call from a user gesture. Creates the AudioContext the first time; safe to call often. */
  unlock(): void {
    if (!this.ctx) {
      let ctx: AudioContext | null = null;
      try {
        ctx = this.createContext();
      } catch {
        ctx = null;
      }
      if (!ctx) return;
      this.ctx = ctx;
      this.synth = new Synth(ctx);
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 8;
      limiter.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus.connect(limiter);
      this.sfxBus.connect(limiter);
      this.music = new MusicPlayer(this.synth, this.musicBus);
      this.applyVolumes(true);
    }
    if (this.ctx.state === 'suspended' && !(typeof document !== 'undefined' && document.hidden)) void this.ctx.resume().catch(() => {});
    this.syncMusic();
  }

  play(id: SfxId, delay = 0): void {
    if (!this.settings.sfxOn || !this.ctx || !this.synth || !this.sfxBus || this.ctx.state === 'closed') return;
    SFX[id](this.synth, this.sfxBus, this.ctx.currentTime + delay);
  }

  playCue(cue: Cue | null, extraDelay = 0): void {
    if (cue) this.play(cue.sfx, (cue.delay ?? 0) + extraDelay);
  }

  /** Which song fits the current screen. It starts once audio is unlocked and music is on. */
  setMusic(track: TrackId | null): void {
    this.wantedTrack = track;
    this.syncMusic();
  }

  /**
   * Browser wiring: unlock on the first gesture, a click sound for every button
   * (`data-sfx="none"` opts out, `data-sfx="<id>"` picks another sound), and
   * silence while the tab is hidden.
   */
  attach(doc: Document): () => void {
    const onGesture = () => this.unlock();
    const onClick = (e: MouseEvent) => {
      const button = (e.target as Element | null)?.closest?.('button');
      if (!button || button.disabled) return;
      const sfx = button.dataset.sfx;
      if (sfx === 'none') return;
      this.play(sfx && sfx in SFX ? (sfx as SfxId) : 'click');
    };
    const onVisibility = () => {
      if (!this.ctx) return;
      if (doc.hidden) void this.ctx.suspend().catch(() => {});
      else void this.ctx.resume().catch(() => {});
    };
    const gestures = ['pointerdown', 'keydown', 'touchend'] as const;
    for (const g of gestures) doc.addEventListener(g, onGesture, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('visibilitychange', onVisibility);
    return () => {
      for (const g of gestures) doc.removeEventListener(g, onGesture, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('visibilitychange', onVisibility);
    };
  }

  private applyVolumes(instant = false) {
    if (!this.ctx || !this.musicBus || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    const set = (g: GainNode, v: number) => {
      g.gain.cancelScheduledValues(t);
      if (instant) g.gain.setValueAtTime(v, t);
      else g.gain.setTargetAtTime(v, t, 0.05);
    };
    set(this.musicBus, this.settings.musicOn ? curve(this.settings.musicVolume) * MUSIC_LEVEL : 0);
    set(this.sfxBus, curve(this.settings.sfxVolume) * SFX_LEVEL);
  }

  private syncMusic() {
    if (!this.music) return;
    const track = this.settings.musicOn && this.wantedTrack ? TRACKS[this.wantedTrack] : null;
    this.music.play(track);
  }
}
