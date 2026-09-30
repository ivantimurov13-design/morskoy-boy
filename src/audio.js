let context;
export function unlockAudio() { try { context ||= new (window.AudioContext || window.webkitAudioContext)(); if (context.state === 'suspended') context.resume().catch(() => {}); } catch { /* Sound is optional. */ } }
export function playSound(kind, enabled) {
  if (!enabled || !context) return;
  try {
    const notes = kind === 'win' ? [392, 494, 587, 784] : kind === 'sunk' ? [220, 330, 440] : kind === 'hit' ? [150, 90] : kind === 'radar' ? [880, 1320] : [440, 280];
    notes.forEach((frequency, i) => {
      const osc = context.createOscillator(), gain = context.createGain(), t = context.currentTime + i * .12;
      osc.type = kind === 'hit' ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(frequency, t);
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.10, t + .015); gain.gain.exponentialRampToValueAtTime(.001, t + .22);
      osc.connect(gain); gain.connect(context.destination); osc.start(t); osc.stop(t + .24);
    });
  } catch { /* A paused iPad audio context must not interrupt play. */ }
}
