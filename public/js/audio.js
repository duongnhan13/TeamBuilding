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

  // Biometric scanner sounds
  playBiometricScan() {
    this.playTone(800, 'sine', 0.06, 0.1, 0);
    this.playTone(1200, 'sine', 0.08, 0.15, 0.08);
    this.playTone(1600, 'sine', 0.1, 0.2, 0.16);
    this.playTone(2000, 'triangle', 0.2, 0.25, 0.26);
  }

  playBiometricSuccess() {
    this.playTone(523.25, 'triangle', 0.1, 0.2, 0);
    this.playTone(659.25, 'triangle', 0.12, 0.2, 0.08);
    this.playTone(783.99, 'triangle', 0.15, 0.25, 0.16);
    this.playTone(1046.50, 'sine', 0.35, 0.3, 0.24);
  }

  playBiometricError() {
    this.playTone(180, 'sawtooth', 0.15, 0.3, 0);
    this.playTone(140, 'sawtooth', 0.25, 0.3, 0.12);
  }

  // Question-specific celebration sound themes
  playTheme(theme) {
    switch (theme) {
      case 'royal-gold':
        // Royal fanfare
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, idx) => {
          this.playTone(f, 'triangle', 0.3, 0.3, idx * 0.12);
        });
        break;

      case 'fish-memory':
        // Underwater bubbling arpeggio
        [350, 440, 523, 659, 783, 987].forEach((f, idx) => {
          this.playTone(f, 'sine', 0.15, 0.25, idx * 0.08);
        });
        break;

      case 'shopping-spree':
        // Cash register cha-ching!
        this.playTone(987.77, 'square', 0.08, 0.25, 0);
        this.playTone(1318.51, 'sine', 0.45, 0.35, 0.1);
        this.playTone(2093.00, 'triangle', 0.6, 0.25, 0.15);
        break;

      case 'sleeping-cloud':
        // Lullaby music box chimes
        [783.99, 659.25, 523.25, 659.25, 783.99].forEach((f, idx) => {
          this.playTone(f, 'sine', 0.4, 0.2, idx * 0.18);
        });
        break;

      case 'music-concert':
        // Rock guitar synth chords
        this.playTone(220, 'sawtooth', 0.2, 0.3, 0);
        this.playTone(277.18, 'sawtooth', 0.2, 0.3, 0.1);
        this.playTone(329.63, 'sawtooth', 0.25, 0.35, 0.2);
        this.playTone(440, 'sawtooth', 0.5, 0.4, 0.32);
        break;

      case 'snack-party':
        // Whistle & pop
        this.playTone(600, 'sine', 0.1, 0.2, 0);
        this.playTone(1200, 'sine', 0.25, 0.3, 0.08);
        this.playTone(1800, 'triangle', 0.35, 0.25, 0.2);
        break;

      case 'arctic-freeze':
        // Shivering ice crystal glide
        [1200, 1400, 1600, 1900, 2400].forEach((f, idx) => {
          this.playTone(f, 'sine', 0.3, 0.18, idx * 0.07);
        });
        break;

      case 'lightning-neon':
        // Electric zap & cyber bass
        this.playTone(1500, 'sawtooth', 0.08, 0.3, 0);
        this.playTone(800, 'sawtooth', 0.12, 0.35, 0.06);
        this.playTone(120, 'square', 0.4, 0.4, 0.14);
        break;

      case 'speed-rocket':
        // Rocket liftoff acceleration
        [200, 320, 500, 800, 1200, 1800].forEach((f, idx) => {
          this.playTone(f, 'triangle', 0.2, 0.25, idx * 0.08);
        });
        break;

      case 'party-beer':
        // Clinking beer mugs + cheering fanfare
        this.playGlassClink();
        setTimeout(() => this.playCheer(), 200);
        break;

      case 'money-rain':
        // Gold coins cascade
        [1500, 1650, 1800, 1950, 2100, 2400].forEach((f, idx) => {
          this.playTone(f, 'triangle', 0.15, 0.2, idx * 0.06);
        });
        break;

      case 'rainbow-magic':
        // Magic twinkle
        [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, idx) => {
          this.playTone(f, 'sine', 0.3, 0.25, idx * 0.09);
        });
        break;

      default:
        this.playCheer();
    }
  }
}

window.soundFX = new SoundFX();

