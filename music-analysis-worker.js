/* Offline features, not beat tracking or melody transcription. One transferable PCM buffer. */
self.onmessage = ({ data: { samples, sampleRate, sourceHash } }) => {
  try {
    const size = 2048, hop = 512, count = Math.max(1, Math.floor((samples.length - size) / hop) + 1);
    const real = new Float64Array(size), imaginary = new Float64Array(size);
    const window = Float64Array.from({ length: size }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (size - 1)));
    const reverse = new Uint16Array(size);
    for (let i = 0; i < size; i++) {
      let value = i, reversed = 0;
      for (let bit = 0; bit < 11; bit++) { reversed = (reversed << 1) | (value & 1); value >>= 1; }
      reverse[i] = reversed;
    }
    const energy = [], centroid = [], flux = [], previousSpectrum = new Float64Array(size / 2);
    for (let frame = 0; frame < count; frame++) {
      let sum = 0;
      for (let i = 0; i < size; i++) {
        const value = samples[frame * hop + i] || 0; sum += value * value;
        real[reverse[i]] = value * window[i]; imaginary[i] = 0;
      }
      for (let length = 2; length <= size; length <<= 1) {
        const angle = -2 * Math.PI / length, stepR = Math.cos(angle), stepI = Math.sin(angle);
        for (let start = 0; start < size; start += length) {
          let rotationR = 1, rotationI = 0;
          for (let j = 0; j < length / 2; j++) {
            const a = start + j, b = a + length / 2;
            const r = rotationR * real[b] - rotationI * imaginary[b], im = rotationR * imaginary[b] + rotationI * real[b];
            real[b] = real[a] - r; imaginary[b] = imaginary[a] - im; real[a] += r; imaginary[a] += im;
            const nextR = rotationR * stepR - rotationI * stepI;
            rotationI = rotationR * stepI + rotationI * stepR; rotationR = nextR;
          }
        }
      }
      let magnitudeSum = 0, weighted = 0, novelty = 0;
      const spectrum = new Float64Array(size / 2);
      for (let i = 4; i < size / 2; i++) {
        const magnitude = Math.hypot(real[i], imaginary[i]); spectrum[i] = magnitude;
        magnitudeSum += magnitude; weighted += magnitude * i * sampleRate / size;
      }
      for (let i = 4; i < size / 2; i++) {
        const normalized = spectrum[i] / Math.max(1e-10, magnitudeSum);
        novelty += Math.max(0, normalized - previousSpectrum[i]); previousSpectrum[i] = normalized;
      }
      energy.push(Math.sqrt(sum / size)); centroid.push(weighted / Math.max(1e-10, magnitudeSum)); flux.push(novelty);
    }
    const percentile = (values, p) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]; };
    const reference = Math.max(.0001, percentile(energy, .95));
    const active = centroid.filter((_, i) => energy[i] > reference * .04);
    const low = Math.max(80, percentile(active.length ? active : [200], .05));
    const high = Math.max(low * 1.5, percentile(active.length ? active : [2000], .95));
    const round = value => Math.round(value * 10000) / 10000;
    const features = energy.map((value, i) => [round(Math.min(1, value / reference)),
      round(value > reference * .025 ? Math.max(0, Math.min(1, Math.log(Math.max(low, centroid[i]) / low) / Math.log(high / low))) : .5)]);
    const onsets = []; let previousOnset = -1;
    const startTime = size / (2 * sampleRate), step = hop / sampleRate;
    for (let i = 2; i < count - 2; i++) {
      const local = flux.slice(Math.max(0, i - 12), Math.min(count, i + 13));
      const median = percentile(local, .5), deviation = percentile(local.map(v => Math.abs(v - median)), .5);
      const time = startTime + i * step;
      if (energy[i] > reference * .075 && flux[i] > Math.max(.075, median + 1.8 * deviation) &&
        flux[i] >= flux[i - 1] && flux[i] > flux[i + 1] && time - previousOnset > .32) {
        onsets.push([round(time), round(Math.min(1, flux[i] / Math.max(.12, median + 3 * deviation)))]); previousOnset = time;
      }
    }
    self.postMessage({ sourceHash, duration: samples.length / sampleRate, sampleRate, fftSize: size, hop,
      startTime, step, referenceRms: reference, registerMethod: 'log spectral centroid, not precise pitch',
      registerHzRange: [round(low), round(high)], features, onsets });
  } catch (error) { self.postMessage({ error: error.message }); }
};
