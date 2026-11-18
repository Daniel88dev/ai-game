import { describe, expect, it, vi } from 'vitest';
import { ENEMIES, newGame, startBattle, type DomainEvent } from '../domain';
import { AudioEngine } from './audioEngine';
import { AUDIO_SETTINGS_KEY, AudioSettingsStore, DEFAULT_AUDIO_SETTINGS, parseAudioSettings } from './audioSettings';
import { cueFor, isAnimatedByBattleScene, musicFor, pickCue } from './cues';
import { SFX, SFX_IDS } from './sfx';
import { noteToMidi, Synth } from './synth';
import { chordFigure, chordTones, parsePattern, TRACK_IDS, TRACKS } from './tracks';

// ------------------------------------------------------------------ a fake WebAudio graph

function fakeParam() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

function fakeNode(extra: Record<string, unknown> = {}) {
  const node: Record<string, unknown> = {
    connect: vi.fn((next: unknown) => next),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    ...extra,
  };
  return node;
}

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state: AudioContextState = 'running';
  destination = fakeNode();
  nodesCreated = 0;
  createOscillator() {
    this.nodesCreated++;
    return fakeNode({ frequency: fakeParam(), detune: fakeParam(), type: 'sine', setPeriodicWave: vi.fn() });
  }
  createGain() {
    this.nodesCreated++;
    return fakeNode({ gain: fakeParam() });
  }
  createBiquadFilter() {
    this.nodesCreated++;
    return fakeNode({ frequency: fakeParam(), Q: fakeParam(), type: 'lowpass' });
  }
  createBufferSource() {
    this.nodesCreated++;
    return fakeNode({ buffer: null, loop: false });
  }
  createDynamicsCompressor() {
    return fakeNode({ threshold: fakeParam(), ratio: fakeParam() });
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createPeriodicWave() {
    return {};
  }
  resume = vi.fn(async () => {});
  suspend = vi.fn(async () => {});
}

const asContext = (f: FakeAudioContext) => f as unknown as AudioContext;

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

// ------------------------------------------------------------------ settings

describe('audio settings', () => {
  it('falls back to defaults for missing or broken data', () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings('not json')).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings('[1,2]').musicOn).toBe(true);
    expect(parseAudioSettings('{"musicOn":"yes","sfxVolume":7}')).toEqual({ ...DEFAULT_AUDIO_SETTINGS, sfxVolume: 1 });
  });

  it('round-trips through its own localStorage key, outside any save slot', () => {
    const storage = memoryStorage();
    const store = new AudioSettingsStore(storage);
    store.save({ musicOn: false, musicVolume: 0.25, sfxOn: true, sfxVolume: 0.4 });
    expect([...storage.data.keys()]).toEqual([AUDIO_SETTINGS_KEY]);
    expect(AUDIO_SETTINGS_KEY.startsWith('merge-conflict:save:')).toBe(false);
    expect(store.load()).toEqual({ musicOn: false, musicVolume: 0.25, sfxOn: true, sfxVolume: 0.4 });
  });

  it('survives blocked storage', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = new AudioSettingsStore(throwing);
    expect(store.load()).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(() => store.save(DEFAULT_AUDIO_SETTINGS)).not.toThrow();
    expect(new AudioSettingsStore(null).load()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});

// ------------------------------------------------------------------ music notation

describe('music notation', () => {
  it('reads notes, holds, rests and drums', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C#5')).toBe(73);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(noteToMidi('H2')).toBeNull();

    const { events, steps } = parsePattern('C4 . . - k h', 2);
    expect(steps).toBe(12);
    expect(events).toEqual([
      { step: 0, len: 6, midi: 60 },
      { step: 8, len: 2, drum: 'k' },
      { step: 10, len: 2, drum: 'h' },
    ]);
    expect(() => parsePattern('C4 X9')).toThrow(/X9/);
  });

  it('expands chord figures', () => {
    expect(chordTones('Am')).toEqual([9, 12, 16]);
    expect(chordTones('Bb')).toEqual([10, 14, 17]);
    expect(chordTones('Bdim')).toEqual([11, 14, 17]);
    expect(chordFigure(['C', 'Am'], 'R 3 5 8 -', 4)).toBe('C4 E4 G4 C5 - A4 C5 E5 A5 -');
  });

  it.each(TRACK_IDS)('track %s is an 8-bar loop with every note inside it', (id) => {
    const t = TRACKS[id];
    expect(t.steps).toBe(8 * 16);
    expect(t.bpm).toBeGreaterThan(60);
    for (const c of t.channels) {
      expect(c.events.length).toBeGreaterThan(0);
      for (const e of c.events) {
        expect(e.step).toBeGreaterThanOrEqual(0);
        expect(e.step).toBeLessThan(t.steps);
        expect(e.len).toBeGreaterThan(0);
        if (e.midi !== undefined) expect(e.midi).toBeGreaterThan(30);
      }
    }
  });
});

// ------------------------------------------------------------------ cues

describe('event cues', () => {
  const hit = (over: Partial<Extract<DomainEvent, { type: 'HeroDebugged' }>>): DomainEvent => ({
    type: 'HeroDebugged',
    damage: 5,
    missed: false,
    critical: false,
    ...over,
  });

  it('voices damage on both sides', () => {
    expect(cueFor(hit({}))?.sfx).toBe('hitEnemy');
    expect(cueFor(hit({ critical: true }))?.sfx).toBe('critEnemy');
    expect(cueFor(hit({ missed: true, damage: 0 }))?.sfx).toBe('miss');
    expect(cueFor({ type: 'AiPatchApplied', damage: 9, tokensSpent: 3 })?.sfx).toBe('aiPatch');
    expect(cueFor({ type: 'EnemyAttacked', damage: 3, attackName: 'NPE', heavy: false })).toMatchObject({ sfx: 'heroHurt', delay: 0.12 });
    expect(cueFor({ type: 'EnemyAttacked', damage: 9, attackName: 'Overflow', heavy: true })?.sfx).toBe('heroHurtHeavy');
  });

  it('voices dialogue choices and stays silent for bookkeeping', () => {
    expect(cueFor({ type: 'DialogueAdvanced', npcId: 'priya', nodeId: 'x' })?.sfx).toBe('select');
    expect(cueFor({ type: 'DialogueEnded', npcId: 'priya' })?.sfx).toBe('select');
    expect(cueFor({ type: 'RngAdvanced', seed: 1 })).toBeNull();
    expect(cueFor({ type: 'HeroMoved', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, facing: 'right' })).toBeNull();
  });

  it('plays the most important cue of a batch', () => {
    const batch: DomainEvent[] = [
      { type: 'DialogueEnded', npcId: 'priya' },
      { type: 'QuestCompleted', questId: 'LUM-7', xp: 40, tokens: 5 },
      { type: 'XpGained', amount: 40 },
      { type: 'LeveledUp', level: 2, attributePoints: 3 },
    ];
    expect(pickCue(batch)?.sfx).toBe('levelUp');
    expect(pickCue(batch.slice(0, 3))?.sfx).toBe('questComplete');
    expect(pickCue([])).toBeNull();
  });

  it('leaves battle sounds to the battle scene, except the opening sting', () => {
    const inBattle = { ...newGame(), battle: startBattle('lum7-beetle', ENEMIES.nullPointerBeetle!) };
    const started: DomainEvent = { type: 'BattleStarted', battle: inBattle.battle };
    expect(isAnimatedByBattleScene([hit({})], inBattle)).toBe(true);
    expect(isAnimatedByBattleScene([started], inBattle)).toBe(false);
    expect(isAnimatedByBattleScene([{ type: 'BattleClosed', outcome: 'won', hpAfter: 10 }], newGame())).toBe(false);
  });

  it('picks music for the screen', () => {
    expect(musicFor(newGame())).toBe('office');
    expect(musicFor({ ...newGame(), battle: startBattle('lum7-beetle', ENEMIES.nullPointerBeetle!) })).toBe('battle');
    expect(musicFor({ ...newGame(), battle: startBattle('boss', ENEMIES.heisenbug!) })).toBe('boss');
    expect(musicFor({ ...newGame(), battle: startBattle('boss', ENEMIES.phantomPackage!) })).toBe('boss');
  });
});

// ------------------------------------------------------------------ synthesis and engine

describe('synth and engine', () => {
  it.each(SFX_IDS)('sound effect %s builds a WebAudio graph', (id) => {
    const ctx = new FakeAudioContext();
    const synth = new Synth(asContext(ctx));
    expect(() => SFX[id](synth, ctx.destination as unknown as AudioNode, 0)).not.toThrow();
    expect(ctx.nodesCreated).toBeGreaterThan(0);
  });

  it('is silent and harmless without WebAudio', () => {
    const engine = new AudioEngine(new AudioSettingsStore(null), () => null);
    engine.unlock();
    engine.setMusic('office');
    engine.play('click');
    expect(engine.unlocked).toBe(false);
    expect(engine.currentTrack).toBeNull();
  });

  it('waits for unlock, then plays the wanted song and follows the music switch', () => {
    vi.useFakeTimers();
    try {
      const ctx = new FakeAudioContext();
      const storage = memoryStorage();
      const engine = new AudioEngine(new AudioSettingsStore(storage), () => asContext(ctx));
      const listener = vi.fn();
      engine.subscribe(listener);

      engine.setMusic('title');
      expect(engine.currentTrack).toBeNull(); // no gesture yet: no sound

      engine.unlock();
      expect(engine.currentTrack).toBe('title');
      engine.setMusic('battle');
      expect(engine.currentTrack).toBe('battle');

      engine.toggleMusic();
      expect(engine.currentTrack).toBeNull();
      expect(listener).toHaveBeenCalled();
      expect(JSON.parse(storage.data.get(AUDIO_SETTINGS_KEY)!).musicOn).toBe(false);

      engine.toggleMusic();
      expect(engine.currentTrack).toBe('battle');

      // The sequencer schedules notes ahead on the audio clock.
      const before = ctx.nodesCreated;
      ctx.currentTime = 2;
      vi.advanceTimersByTime(100);
      expect(ctx.nodesCreated).toBeGreaterThan(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('mutes sound effects when they are switched off', () => {
    const ctx = new FakeAudioContext();
    const engine = new AudioEngine(new AudioSettingsStore(memoryStorage()), () => asContext(ctx));
    engine.unlock();
    engine.update({ sfxOn: false });
    const before = ctx.nodesCreated;
    engine.play('hitEnemy');
    expect(ctx.nodesCreated).toBe(before);
    engine.update({ sfxOn: true });
    engine.play('hitEnemy');
    expect(ctx.nodesCreated).toBeGreaterThan(before);
  });
});
