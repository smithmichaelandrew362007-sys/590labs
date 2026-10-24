/**
 * 590 LABS® — Audio & Sensory Feedback Engine
 * Uses Web Audio API for zero-latency, realistic mechanical clicks and chimes.
 */

const SoundEngine = (function() {
  let audioCtx = null;
  let isSoundEnabled = localStorage.getItem("590labs_sound_enabled") === "true";

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playClick() {
    if (!isSoundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.04);
    } catch (e) {
      // Audio autoplay restrictions graceful fallback
    }
  }

  function playAddCart() {
    if (!isSoundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      
      const now = audioCtx.currentTime;
      // High-tone sleek double ping
      [580, 880].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.1, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.12);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.12);
      });
    } catch (e) {}
  }

  function playSuccess() {
    if (!isSoundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      
      const now = audioCtx.currentTime;
      const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(0.12, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.25);
      });
    } catch (e) {}
  }

  function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem("590labs_sound_enabled", isSoundEnabled);
    if (isSoundEnabled) {
      initAudio();
      playClick();
    }
    return isSoundEnabled;
  }

  return {
    init: initAudio,
    click: playClick,
    addCart: playAddCart,
    success: playSuccess,
    toggle: toggleSound,
    isEnabled: () => isSoundEnabled
  };
})();
