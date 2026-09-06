/**
 * Arcade blips, synthesised with Web Audio rather than shipped as files:
 * a handful of oscillator envelopes weigh nothing and stay crisp at any
 * volume, which is how 8-bit hardware made these noises in the first place.
 */

const MUTE_KEY = "snake-muted";

let context: AudioContext | null = null;
let muted = readStoredMute();

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  // A context built before the first user gesture starts suspended.
  if (context.state === "suspended") void context.resume();
  return context;
}

interface Tone {
  from: number;
  /** Slide to this frequency across the note. Defaults to a flat tone. */
  to?: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  delay?: number;
}

function tone({
  from,
  to = from,
  duration,
  type = "square",
  volume = 0.05,
  delay = 0,
}: Tone) {
  const ctx = audio();
  if (!ctx) return;

  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  if (to !== from) {
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  }

  // Cutting the gain dead leaves an audible click, so fade the tail out.
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

export const sfx = {
  /** Heart eaten: a short blip that snaps upward. */
  eat() {
    tone({ from: 620, to: 1180, duration: 0.07 });
  },

  /** Diamond eaten: a rising three-note flourish so it reads as rarer. */
  bonus() {
    tone({ from: 660, duration: 0.06 });
    tone({ from: 880, duration: 0.06, delay: 0.06 });
    tone({ from: 1320, duration: 0.14, delay: 0.12 });
  },

  /**
   * Multiplier picked up: a rising arpeggio over the top of the pickup blip.
   * The delay lets `bonus()` land first, so it reads as "collected, then
   * powered up" rather than one muddled chord.
   */
  powerUp() {
    const arpeggio = [523, 659, 784, 1047, 1319, 1568];
    arpeggio.forEach((note, step) => {
      tone({
        from: note,
        duration: 0.09,
        delay: 0.18 + step * 0.07,
        volume: 0.045,
      });
    });
  },

  /** Death: a long slide down to nothing. */
  die() {
    tone({
      from: 420,
      to: 60,
      duration: 0.55,
      type: "sawtooth",
      volume: 0.07,
    });
  },

  /** Run starting. */
  start() {
    tone({ from: 440, duration: 0.07 });
    tone({ from: 880, duration: 0.1, delay: 0.07 });
  },

  isMuted: () => muted,

  setMuted(next: boolean) {
    muted = next;
    try {
      localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      // storage blocked – the setting just won't survive a reload
    }
  },
};
