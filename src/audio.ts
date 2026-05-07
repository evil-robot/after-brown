export interface AudioState {
  level: number;
  frequency: Float32Array | null;
  active: boolean;
  screamIntensity: number;
  init: () => Promise<void>;
  update: () => void;
  dispose: () => void;
}

export function createAudioReactive(): AudioState {
  let analyser: AnalyserNode | null = null;
  let dataArray: any = null;
  let frequencyData: any = null;
  let context: AudioContext | null = null;
  let stream: MediaStream | null = null;

  // Scream detection state
  let peakHistory: number[] = [];
  const PEAK_WINDOW = 10;
  let screamDecay = 0;

  const state: AudioState = {
    level: 0,
    frequency: null,
    active: false,
    screamIntensity: 0,

    async init() {
      try {
        context = new AudioContext();
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        const source = context.createMediaStreamSource(stream);
        analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);

        dataArray = new Uint8Array(analyser.frequencyBinCount);
        frequencyData = new Float32Array(analyser.frequencyBinCount);
        state.frequency = frequencyData;
        state.active = true;
      } catch (err) {
        console.warn('Microphone not available:', err);
        state.active = false;
      }
    },

    update() {
      if (!analyser || !dataArray) return;

      analyser.getByteTimeDomainData(dataArray);

      // RMS amplitude
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const target = Math.min(rms * 3.0, 1.0);

      // Attack/release envelope
      if (target > state.level) {
        state.level += (target - state.level) * 0.3;
      } else {
        state.level += (target - state.level) * 0.05;
      }

      // === SCREAM DETECTION ===
      // A "scream" is a sudden, sustained loud peak
      // Track peak history to detect sustained loudness
      peakHistory.push(state.level);
      if (peakHistory.length > PEAK_WINDOW) peakHistory.shift();

      const avgPeak = peakHistory.reduce((a, b) => a + b, 0) / peakHistory.length;
      const currentPeak = state.level;

      // Scream triggers when:
      // 1. Current level is high (> 0.4)
      // 2. Average recent level is also high (sustained, not just a click)
      // 3. There's high-frequency energy (actual voice, not a thump)
      let highFreqEnergy = 0;
      if (frequencyData) {
        analyser.getFloatFrequencyData(frequencyData);
        // Check bins 20-80 (roughly 1kHz-4kHz) — scream frequencies
        for (let i = 20; i < 80 && i < frequencyData.length; i++) {
          highFreqEnergy += Math.max(0, frequencyData[i] + 60); // dB, offset
        }
        highFreqEnergy /= 60; // Normalize
        highFreqEnergy = Math.min(highFreqEnergy / 30, 1.0);
      }

      if (currentPeak > 0.35 && avgPeak > 0.25 && highFreqEnergy > 0.3) {
        // Scream detected — ramp up
        screamDecay = Math.min(screamDecay + 0.08, 1.0);
      } else {
        // Decay
        screamDecay *= 0.95;
      }

      state.screamIntensity = screamDecay;

      if (frequencyData) {
        analyser.getFloatFrequencyData(frequencyData);
      }
    },

    dispose() {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (context) context.close();
      analyser = null;
      dataArray = null;
      state.active = false;
    },
  };

  return state;
}
