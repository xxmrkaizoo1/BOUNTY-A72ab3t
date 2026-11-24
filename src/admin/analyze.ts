/**
 * In-browser analysis of an uploaded audio file, used to pre-fill the publish form.
 * Local files have no CORS restrictions, so we can decode the real samples.
 */

export interface Analysis {
  duration: number;
  /** 0–1, from overall loudness (RMS). */
  energy: number;
  /** Estimated tempo, or null when the signal has no clear beat. */
  bpm: number | null;
  /** Normalised peak per bin, for drawing a waveform. */
  peaks: Float32Array;
}

/** Decoding at a low sample rate keeps memory reasonable for long tracks. */
const SAMPLE_RATE = 11025;

export async function analyzeAudio(file: File, bins = 180): Promise<Analysis> {
  const ctx = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const audio = await ctx.decodeAudioData(await file.arrayBuffer());
  const mono = mixdown(audio);

  return {
    duration: audio.duration,
    energy: loudnessToEnergy(mono),
    bpm: estimateBpm(mono, audio.sampleRate),
    peaks: peaks(mono, bins),
  };
}

function mixdown(audio: AudioBuffer): Float32Array {
  if (audio.numberOfChannels === 1) return audio.getChannelData(0);
  const out = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < ch.length; i++) out[i] += ch[i] / audio.numberOfChannels;
  }
  return out;
}

function peaks(data: Float32Array, bins: number): Float32Array {
  const out = new Float32Array(bins);
  const size = Math.max(1, Math.floor(data.length / bins));
  let max = 0;
  for (let b = 0; b < bins; b++) {
    let p = 0;
    for (let i = b * size, end = Math.min(data.length, i + size); i < end; i++) p = Math.max(p, Math.abs(data[i]));
    out[b] = p;
    max = Math.max(max, p);
  }
  if (max > 0) for (let b = 0; b < bins; b++) out[b] /= max;
  return out;
}

/** Map RMS level to 0–1: about −30 dBFS (quiet) → 0, −8 dBFS (loud master) → 1. */
function loudnessToEnergy(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / Math.max(1, data.length));
  const db = 20 * Math.log10(rms || 1e-9);
  return Math.round(Math.min(1, Math.max(0, (db + 30) / 22)) * 100) / 100;
}

/**
 * Onset-envelope autocorrelation tempo estimate.
 * Analyses up to 45 s from the middle of the track, scores candidate tempos
 * 60–180 BPM, and folds the result into the common 75–165 range.
 */
export function estimateBpm(data: Float32Array, sampleRate: number): number | null {
  const hop = Math.round(sampleRate / 100); // ~100 frames per second
  const fps = sampleRate / hop;
  const span = Math.min(data.length, Math.round(45 * sampleRate));
  const start = Math.max(0, Math.floor((data.length - span) / 2));

  const frames = Math.floor(span / hop);
  if (frames < fps * 4) return null; // need at least ~4 s

  // energy envelope → half-wave-rectified difference = onset strength
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    const o = start + f * hop;
    for (let i = 0; i < hop; i++) e += data[o + i] * data[o + i];
    env[f] = Math.sqrt(e / hop);
  }
  const onset = new Float32Array(frames);
  let mean = 0;
  for (let f = 1; f < frames; f++) {
    onset[f] = Math.max(0, env[f] - env[f - 1]);
    mean += onset[f];
  }
  mean /= frames;
  for (let f = 0; f < frames; f++) onset[f] = Math.max(0, onset[f] - mean);

  const ac = (lag: number): number => {
    const l0 = Math.floor(lag);
    const frac = lag - l0;
    let s = 0;
    for (let f = 0; f + l0 + 1 < frames; f++) s += onset[f] * (onset[f + l0] * (1 - frac) + onset[f + l0 + 1] * frac);
    return s;
  };

  let best = 0;
  let bestScore = 0;
  let total = 0;
  for (let bpm = 60; bpm <= 180; bpm += 0.5) {
    const lag = (60 * fps) / bpm;
    // reward tempos whose double period also lines up (beats come in pairs/bars)
    const score = ac(lag) + 0.5 * ac(lag * 2);
    total += score;
    if (score > bestScore) {
      bestScore = score;
      best = bpm;
    }
  }
  const avg = total / 241;
  if (!best || bestScore < avg * 1.15) return null; // no clear periodicity

  while (best < 75) best *= 2;
  while (best > 165) best /= 2;
  return Math.round(best);
}
