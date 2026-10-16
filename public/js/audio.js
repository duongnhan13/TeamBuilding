// Sound FX Synthesizer using Web Audio API (100% Offline, Zero external dependencies)
class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freq, type = 'sine', duration = 0.2, gain = 0.2, delay = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    setTimeout(() => {
      try {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        g.gain.setValueAtTime(gain, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(g);
        g.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        // Audio error silent fallback
      }
    }, delay * 1000);
  }

  playJoin() {
    this.playTone(523.25, 'triangle', 0.1, 0.2, 0); // C5
    this.playTone(659.25, 'triangle', 0.15, 0.2, 0.08); // E5
    this.playTone(783.99, 'sine', 0.2, 0.25, 0.16); // G5
  }

  playTick() {
    this.playTone(880, 'sine', 0.04, 0.08, 0);
  }

  playUrgentTick() {
    this.playTone(1200, 'square', 0.06, 0.12, 0);
  }

  playCorrect() {
    this.playTone(587.33, 'triangle', 0.12, 0.2, 0); // D5
    this.playTone(739.99, 'triangle', 0.15, 0.2, 0.1); // F#5
    this.playTone(880.00, 'sine', 0.35, 0.3, 0.2); // A5
    this.playTone(1174.66, 'sine', 0.5, 0.35, 0.35); // D6
  }

  playWrong() {
    this.playTone(300, 'sawtooth', 0.2, 0.2, 0);
    this.playTone(220, 'sawtooth', 0.35, 0.25, 0.15);
  }

  playBuzzer() {
    this.playTone(200, 'sawtooth', 0.4, 0.3, 0);
  }

  playCheer() {
    // Fanfare chords
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C - E - G - C
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'triangle', 0.25, 0.2, idx * 0.1);
    });
    setTimeout(() => {
      this.playTone(1046.50, 'sine', 0.7, 0.4, 0);
      this.playTone(1318.51, 'sine', 0.7, 0.3, 0);
    }, 450);
  }

  playGlassClink() {
    this.playTone(2400, 'sine', 0.4, 0.3, 0);
    this.playTone(2450, 'sine', 0.3, 0.25, 0.04);
    this.playTone(1800, 'triangle', 0.5, 0.2, 0.1);
  }

  playDrumRoll() {
    for (let i = 0; i < 15; i++) {
      const speed = 0.04;
      const freq = 120 + Math.random() * 40;
      this.playTone(freq, 'triangle', 0.05, 0.15, i * speed);
    }
  }
}

window.soundFX = new SoundFX();
