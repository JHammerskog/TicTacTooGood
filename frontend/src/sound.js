/**
 * A pencil scratch, synthesised rather than sampled: no audio file enters the
 * repo and nothing is downloaded. A scratch is essentially filtered noise with
 * a sharp attack, which the Web Audio API builds in a few nodes.
 */

/** Created lazily: browsers refuse to start audio without a user gesture, and
 *  every call here follows a click. */
let context = null;

function audioContext() {
  if (context === null) {
    context = new AudioContext();
  }
  return context;
}

/** Plays one scratch. Silently does nothing if audio is unavailable. */
export function playPencil() {
  try {
    const ctx = audioContext();

    // Slight variation per move, so repeated moves do not sound mechanical.
    const duration = 0.09 + Math.random() * 0.05;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      // Noise, faded out across the buffer: the graphite leaves the paper.
      samples[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400 + Math.random() * 600;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration);
  } catch {
    return;
  }
}
