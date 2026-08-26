// Audio-Visual Feedback Service for ROTC Mobile Scanner
// Haptic vibrations (navigator.vibrate) are strictly disabled on all alerts.
// Integrates with scannerAudio.js for distinct, single-play sound synthesis.

import scannerAudio from './scannerAudio';

export { scannerAudio };

export const playAudioBeep = (freq = 880, type = 'sine', duration = 0.15) => {
  scannerAudio.playAudioBeep?.(freq, type, duration);
};

export const playAlertSound = (type = 'WARNING') => {
  scannerAudio.triggerEventAudio(type);
};

// Haptic Vibration Trigger - Explicitly Disabled
export const triggerHaptic = (pattern) => {
  // DISABLE DEVICE VIBRATION ON ALL ALERTS
  // if (navigator.vibrate) {
  //   navigator.vibrate(pattern || [200, 100, 200]);
  // }
};

export const handleInvalidQrCode = (errorDetails, setScanErrorModal) => {
  // 1. Play steady single-play error audio chime
  scannerAudio.playInvalidQrError();

  // 2. DISABLE DEVICE VIBRATION (Comment out or remove navigator.vibrate)
  // if (navigator.vibrate) {
  //   navigator.vibrate([300, 100, 300]);
  // }

  // 3. Set steady modal state
  if (typeof setScanErrorModal === 'function') {
    setScanErrorModal({
      visible: true,
      title: 'UNAUTHORIZED QR CODE',
      message: errorDetails || 'INVALID ROTC FORMAT - Invalid format. This scanner only accepts official CSU ROTC ID cards.',
    });
  }
};

export const triggerScanAlert = (type, message, setAlertState) => {
  // DISABLE DEVICE VIBRATION ON ALL ALERTS
  // if (navigator.vibrate) {
  //   navigator.vibrate([200, 100, 200]);
  // }

  // Play distinct audio sound once, then display static UI modal/toast
  scannerAudio.triggerEventAudio(type);
  if (typeof setAlertState === 'function') {
    setAlertState({ active: true, type, message });
  }
};
