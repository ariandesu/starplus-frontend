export interface HrSample {
  at: number;
  red: number;
}

export function estimateHeartRate(samples: HrSample[]): number | null {
  if (samples.length < 10) return null;
  const span = samples[samples.length - 1].at - samples[0].at;
  if (span < 5000) return null;
  const reds = samples.map((sample) => sample.red);
  const mean = reds.reduce((sum, red) => sum + red, 0) / reds.length;
  const variance = reds.reduce((sum, red) => sum + (red - mean) ** 2, 0) / reds.length;
  if (variance <= 0) return null;
  const sd = Math.sqrt(variance);
  const peaks: number[] = [];
  for (let i = 1; i < samples.length - 1; i++) {
    if (
      reds[i] > reds[i - 1] &&
      reds[i] >= reds[i + 1] &&
      reds[i] > mean + 0.5 * sd &&
      (peaks.length === 0 || samples[i].at - peaks[peaks.length - 1] >= 300)
    ) {
      const denominator = reds[i - 1] - 2 * reds[i] + reds[i + 1];
      const shift = denominator === 0 ? 0 : (0.5 * (reds[i - 1] - reds[i + 1])) / denominator;
      peaks.push(samples[i].at + shift * (samples[i + 1].at - samples[i].at));
    }
  }
  if (peaks.length < 2) return null;
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) intervals.push(peaks[i] - peaks[i - 1]);
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  if (median <= 0) return null;
  const bpm = Math.round(60000 / median);
  if (bpm < 30 || bpm > 220) return null;
  return bpm;
}

export interface CameraReader {
  stop: () => void;
  samples: HrSample[];
}

export async function startCameraReader(
  video: HTMLVideoElement,
  onSample: (sample: HrSample) => void
): Promise<CameraReader> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser has no camera support");
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  video.srcObject = stream;
  await video.play();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser cannot read camera pixels");
  const samples: HrSample[] = [];
  let stopped = false;
  const timer = window.setInterval(() => {
    if (stopped || video.videoWidth === 0) return;
    canvas.width = 32;
    canvas.height = 32;
    context.drawImage(video, 0, 0, 32, 32);
    const data = context.getImageData(0, 0, 32, 32).data;
    let red = 0;
    for (let i = 0; i < data.length; i += 4) red += data[i];
    red /= data.length / 4;
    const sample = { at: Date.now(), red };
    samples.push(sample);
    onSample(sample);
  }, 100);
  return {
    samples,
    stop: () => {
      stopped = true;
      window.clearInterval(timer);
      for (const track of stream.getTracks()) track.stop();
    },
  };
}
