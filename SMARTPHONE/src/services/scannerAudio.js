// Dedicated Audio Feedback Engine for ROTC Mobile Scanner
// Synthesizes distinct, high-fidelity Web Audio API tones configured to play strictly once per scan trigger.

class ScannerAudioManager {
  constructor() {
    this.audioCtx = null;
    this.lastPlayTimestamp = 0;
    this.lastEventType = null;
    this.cooldownMs = 400; // Prevent duplicate rapid-fire audio overlap on the same scan tick
  }

  // Initialize or resume the AudioContext safely on user interaction
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // Check if sound can play (guaranteed single play per trigger)
  canPlay(eventType, minInterval = 300) {
    const now = Date.now();
    if (this.lastEventType === eventType && now - this.lastPlayTimestamp < minInterval) {
      return false;
    }
    this.lastPlayTimestamp = now;
    this.lastEventType = eventType;
    return true;
  }

  // 1. TIME-IN SUCCESS: Crisp, bright rising double-tone chime (Major 5th: 880Hz -> 1320Hz)
  playTimeInSuccess() {
    if (!this.canPlay('TIME_IN_SUCCESS')) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Tone 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      // Tone 2 (Higher pitch harmonic chime)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.08);
      gain2.gain.setValueAtTime(0.3, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.28);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.28);
    } catch (e) {
      console.warn("Scanner audio play error:", e);
    }
  }

  // 2. TIME-OUT SUCCESS: Warm, mellow resolving downward double-tone chime (659Hz -> 523Hz)
  playTimeOutSuccess() {
    if (!this.canPlay('TIME_OUT_SUCCESS')) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Tone 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      // Tone 2 (Resolving C5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(523.25, now + 0.08); // C5
      gain2.gain.setValueAtTime(0.28, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.3);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.3);
    } catch (e) {
      console.warn("Scanner audio play error:", e);
    }
  }

  // 3. DUPLICATE / ALREADY LOGGED: Soft subtle double tap info chime (523Hz -> 587Hz)
  playDuplicateScan() {
    if (!this.canPlay('DUPLICATE_SCAN')) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.1);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(587.33, now + 0.1);
      gain2.gain.setValueAtTime(0.2, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.22);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.22);
    } catch (e) {
      console.warn("Scanner audio play error:", e);
    }
  }

  // 4. PLATOON MISMATCH: Distinct warning buzz interval (330Hz -> 220Hz)
  playMismatchWarning() {
    if (!this.canPlay('MISMATCH_WARNING')) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(330, now);
      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(220, now + 0.14);
      gain2.gain.setValueAtTime(0.25, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.warn("Scanner audio play error:", e);
    }
  }

  // 5. UNAUTHORIZED / INVALID QR CODE: Low rejection buzz
  playInvalidQrError() {
    if (!this.canPlay('INVALID_QR_ERROR')) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.28);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } catch (e) {
      console.warn("Scanner audio play error:", e);
    }
  }

  // 6. CAPACITY QUOTA LIMIT REACHED (37 Cadets Quota): Triple pulse warning
  playQuotaLimitAlert() {
    if (!this.canPlay('QUOTA_LIMIT')) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [0, 0.1, 0.2].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx === 2 ? 370 : 440, now + offset);
        gain.gain.setValueAtTime(0.25, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.08);
      });
    } catch (e) {
      console.warn("Scanner audio play error:", e);
    }
  }

  // 7. SETUP REQUIRED: Caution notification chime
  playSetupRequiredAlert() {
    if (!this.canPlay('SETUP_REQUIRED')) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(392, now); // G4
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn("Scanner audio play error:", e);
    }
  }

  // Universal event trigger method
  triggerEventAudio(eventType) {
    switch (eventType) {
      case 'TIME_IN_SUCCESS':
      case 'TIME_IN':
        this.playTimeInSuccess();
        break;
      case 'TIME_OUT_SUCCESS':
      case 'TIME_OUT':
        this.playTimeOutSuccess();
        break;
      case 'DUPLICATE_SCAN':
      case 'ALREADY_RECORDED':
        this.playDuplicateScan();
        break;
      case 'MISMATCH_WARNING':
      case 'MISMATCH':
        this.playMismatchWarning();
        break;
      case 'INVALID_QR_ERROR':
      case 'INVALID_QR':
      case 'UNAUTHORIZED_QR':
        this.playInvalidQrError();
        break;
      case 'QUOTA_LIMIT':
      case 'CAPACITY_REACHED':
        this.playQuotaLimitAlert();
        break;
      case 'SETUP_REQUIRED':
        this.playSetupRequiredAlert();
        break;
      default:
        this.playTimeInSuccess();
        break;
    }
  }
}

export const scannerAudio = new ScannerAudioManager();
export default scannerAudio;
