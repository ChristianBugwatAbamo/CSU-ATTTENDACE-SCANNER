import jsQR from 'jsqr';

self.onmessage = function (e) {
  const { data, width, height } = e.data;
  if (!data || !width || !height) {
    self.postMessage({ success: false, error: 'Invalid frame payload' });
    return;
  }

  try {
    const code = jsQR(data, width, height, {
      inversionAttempts: 'dontInvert'
    });

    if (code && code.data) {
      self.postMessage({ success: true, data: code.data });
    } else {
      self.postMessage({ success: false });
    }
  } catch (err) {
    self.postMessage({ success: false, error: err?.message || 'Worker decode error' });
  }
};
