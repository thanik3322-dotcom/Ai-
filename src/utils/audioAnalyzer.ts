import { AcousticMetrics } from '../types/voiceHealth';

/**
 * Estimates dominant pitch / resonance frequency (Hz) on an active cough burst frame
 * using normalized autocorrelation.
 */
function estimateFramePitchHz(frame: Float32Array, sampleRate: number): number | null {
  const size = frame.length;
  let rms = 0;
  for (let i = 0; i < size; i++) {
    rms += frame[i] * frame[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.015) return null;

  const minLag = Math.floor(sampleRate / 650); // up to 650 Hz for cough resonance
  const maxLag = Math.min(Math.floor(sampleRate / 70), Math.floor(size / 2));

  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let cross = 0;
    let energyA = 0;
    let energyB = 0;
    const limit = size - lag;
    for (let i = 0; i < limit; i++) {
      const a = frame[i];
      const b = frame[i + lag];
      cross += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    const denom = Math.sqrt(energyA * energyB);
    const corr = denom > 0 ? cross / denom : 0;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestCorr < 0.35 || bestLag <= 0) return null;
  return sampleRate / bestLag;
}

/**
 * Extracts real acoustic biomarkers from a recorded Cough Audio Blob using the Web Audio API.
 */
export async function extractAcousticMetrics(audioBlob: Blob): Promise<AcousticMetrics> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const durationSec = Math.max(0.5, audioBuffer.duration);

    const frameSize = Math.min(2048, Math.max(512, Math.floor(sampleRate * 0.03)));
    const hopSize = Math.floor(frameSize / 2);
    const hopDurationMs = (hopSize / sampleRate) * 1000;

    const frameRmsValues: number[] = [];
    const voicedPitches: number[] = [];
    let totalZeroCrossings = 0;
    let totalSamplesCounted = 0;
    let totalSquaredSum = 0;
    let maxSampleAbs = 0;

    for (let i = 0; i < channelData.length; i++) {
      const s = channelData[i];
      const absS = Math.abs(s);
      if (absS > maxSampleAbs) maxSampleAbs = absS;
      totalSquaredSum += s * s;
      if (i > 0 && ((channelData[i - 1] >= 0 && s < 0) || (channelData[i - 1] < 0 && s >= 0))) {
        totalZeroCrossings++;
      }
      totalSamplesCounted++;
    }

    const overallRms = Math.sqrt(totalSquaredSum / Math.max(1, totalSamplesCounted));
    const averageVolumeDb = Math.max(-60, Math.min(0, 20 * Math.log10(Math.max(overallRms, 1e-5))));
    const peakVolumeDb = Math.max(-60, Math.min(0, 20 * Math.log10(Math.max(maxSampleAbs, 1e-5))));

    for (let start = 0; start + frameSize <= channelData.length; start += hopSize) {
      const frame = channelData.subarray(start, start + frameSize);
      let sq = 0;
      for (let j = 0; j < frame.length; j++) {
        sq += frame[j] * frame[j];
      }
      const rms = Math.sqrt(sq / frame.length);
      frameRmsValues.push(rms);

      const pitch = estimateFramePitchHz(frame, sampleRate);
      if (pitch !== null) {
        voicedPitches.push(pitch);
      }
    }

    // Cough burst detection using explosive energy envelope thresholding
    const maxFrameRms = frameRmsValues.reduce((m, v) => (v > m ? v : m), 0);
    const burstOnsetThreshold = Math.max(0.025, maxFrameRms * 0.36);
    const burstOffsetThreshold = burstOnsetThreshold * 0.45;

    let coughBurstCount = 0;
    let inBurst = false;
    let lastBurstEndIndex = -100;
    const minInterBurstFrames = Math.max(2, Math.floor(140 / hopDurationMs)); // >=140ms gap between distinct coughs
    const burstDurationsMs: number[] = [];
    let currentBurstStart = 0;

    for (let i = 0; i < frameRmsValues.length; i++) {
      const r = frameRmsValues[i];
      if (!inBurst && r >= burstOnsetThreshold && i - lastBurstEndIndex >= minInterBurstFrames) {
        inBurst = true;
        currentBurstStart = i;
        coughBurstCount++;
      } else if (inBurst && r < burstOffsetThreshold) {
        inBurst = false;
        lastBurstEndIndex = i;
        burstDurationsMs.push((i - currentBurstStart) * hopDurationMs);
      }
    }
    if (inBurst) {
      burstDurationsMs.push((frameRmsValues.length - currentBurstStart) * hopDurationMs);
    }

    const coughDecayMs =
      burstDurationsMs.length > 0
        ? Math.round(burstDurationsMs.reduce((a, b) => a + b, 0) / burstDurationsMs.length)
        : 240;

    // Dominant cough resonance frequency & stability
    let fundamentalFreqHz = 215;
    let pitchStabilityHz = 24;
    let jitterPercent = 1.4;

    if (voicedPitches.length > 0) {
      const sorted = [...voicedPitches].sort((a, b) => a - b);
      fundamentalFreqHz = sorted[Math.floor(sorted.length / 2)];
      const meanPitch = voicedPitches.reduce((acc, v) => acc + v, 0) / voicedPitches.length;
      const variance =
        voicedPitches.reduce((acc, v) => acc + (v - meanPitch) ** 2, 0) / voicedPitches.length;
      pitchStabilityHz = Math.sqrt(variance);

      if (voicedPitches.length > 1) {
        let periodDiffSum = 0;
        let periodSum = 0;
        let validPairs = 0;
        for (let i = 1; i < voicedPitches.length; i++) {
          const p1 = 1 / voicedPitches[i - 1];
          const p2 = 1 / voicedPitches[i];
          if (Math.abs(voicedPitches[i] - voicedPitches[i - 1]) < 80) {
            periodDiffSum += Math.abs(p2 - p1);
            periodSum += (p1 + p2) / 2;
            validPairs++;
          }
        }
        if (validPairs > 0 && periodSum > 0) {
          jitterPercent = Math.min(9.5, Math.max(0.35, (periodDiffSum / periodSum) * 100));
        }
      }
    }

    // Active cough burst energy ratio & amplitude turbulence (Shimmer)
    const activeThreshold = Math.max(0.015, overallRms * 0.45);
    const activeFrames = frameRmsValues.filter((r) => r >= activeThreshold);
    const voicingRatioPercent =
      frameRmsValues.length > 0 ? (activeFrames.length / frameRmsValues.length) * 100 : 0;

    let shimmerPercent = 3.2;
    if (activeFrames.length > 2) {
      let ampDiffSum = 0;
      let ampSum = 0;
      for (let i = 1; i < activeFrames.length; i++) {
        ampDiffSum += Math.abs(activeFrames[i] - activeFrames[i - 1]);
        ampSum += (activeFrames[i] + activeFrames[i - 1]) / 2;
      }
      if (ampSum > 0) {
        shimmerPercent = Math.min(18.0, Math.max(1.0, (ampDiffSum / ampSum) * 100));
      }
    }

    // Burst rate per second (replaces syllabic rate while keeping numeric telemetry)
    const speechRateSyllablesPerSec = Number(
      Math.max(0.2, coughBurstCount / Math.max(1, durationSec)).toFixed(2)
    );

    // Spectral brightness proxy from zero-crossing rate during active audio
    const zcrRatePerSec = totalZeroCrossings / Math.max(0.2, durationSec);
    const spectralCentroidHz = Math.min(4800, Math.max(400, zcrRatePerSec * 0.65));

    // Downsampled waveform peaks (64 bars)
    const barCount = 64;
    const step = Math.max(1, Math.floor(channelData.length / barCount));
    const waveformPeaks: number[] = [];
    for (let b = 0; b < barCount; b++) {
      const start = b * step;
      let peak = 0;
      for (let k = start; k < Math.min(channelData.length, start + step); k++) {
        const abs = Math.abs(channelData[k]);
        if (abs > peak) peak = abs;
      }
      waveformPeaks.push(Math.min(1, peak));
    }

    return {
      durationSec,
      coughBurstCount,
      coughDecayMs,
      fundamentalFreqHz,
      pitchStabilityHz,
      averageVolumeDb,
      peakVolumeDb,
      jitterPercent,
      shimmerPercent,
      voicingRatioPercent,
      speechRateSyllablesPerSec,
      spectralCentroidHz,
      waveformPeaks,
    };
  } finally {
    await audioCtx.close().catch(() => undefined);
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('ไม่สามารถแปลงไฟล์เสียงไอได้'));
    reader.readAsDataURL(blob);
  });
}
