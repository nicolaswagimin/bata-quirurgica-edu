// Voice and sound feedback for the AR game, all generated in the browser (no audio files, nothing
// sent anywhere). Browsers only allow audio after a user gesture, so `unlock()` runs on the first tap.
const VOICE_KEY = 'bata.arVoz';
const SOUND_KEY = 'bata.arSonido';

function stored(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'off';
  } catch {
    return true;
  }
}

function store(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    // Without storage the preference lasts for this visit only.
  }
}

type Tone = { freq: number; ms: number; type?: OscillatorType; gain?: number };

export class ArFeedback {
  voice = stored(VOICE_KEY);
  sound = stored(SOUND_KEY);
  private ctx: AudioContext | null = null;
  private lastSpoken = '';

  /** Call from a tap: creates the audio context and primes speech synthesis. */
  unlock(): void {
    try {
      this.ctx ??= new AudioContext();
      void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }

  setVoice(on: boolean): void {
    this.voice = on;
    store(VOICE_KEY, on);
    if (!on && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  setSound(on: boolean): void {
    this.sound = on;
    store(SOUND_KEY, on);
  }

  /** Reads an instruction aloud once; a newer instruction interrupts the previous one. */
  say(text: string): void {
    if (!this.voice || !text || text === this.lastSpoken || !('speechSynthesis' in window)) return;
    this.lastSpoken = text;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    const voice = synth.getVoices().find((v) => v.lang.startsWith('es'));
    if (voice) utterance.voice = voice;
    utterance.rate = 1;
    synth.speak(utterance);
  }

  private play(tones: Tone[]): void {
    const ctx = this.ctx;
    if (!this.sound || !ctx) return;
    let t = ctx.currentTime;
    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone.type ?? 'sine';
      osc.frequency.value = tone.freq;
      const peak = tone.gain ?? 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.ms / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + tone.ms / 1000 + 0.02);
      t += tone.ms / 1000;
    }
  }

  /** Step done: a short rising major third. */
  success(): void {
    this.play([
      { freq: 660, ms: 110 },
      { freq: 880, ms: 170 },
    ]);
  }

  /** Sterile-technique warning: a low double buzz. */
  error(): void {
    this.play([
      { freq: 196, ms: 140, type: 'square', gain: 0.08 },
      { freq: 165, ms: 180, type: 'square', gain: 0.08 },
    ]);
  }

  /** Countdown and button activation. */
  tick(): void {
    this.play([{ freq: 520, ms: 70, gain: 0.12 }]);
  }

  /** Final celebration: a quick arpeggio. */
  fanfare(): void {
    this.play([
      { freq: 523, ms: 120 },
      { freq: 659, ms: 120 },
      { freq: 784, ms: 120 },
      { freq: 1047, ms: 260 },
    ]);
  }

  dispose(): void {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    void this.ctx?.close();
    this.ctx = null;
  }
}
