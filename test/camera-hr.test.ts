import { describe, expect, it } from "vitest";
import { estimateHeartRate, type HrSample } from "../src/lib/adapters/camera-hr";

function sine(bpm: number, seconds: number, noise = 0): HrSample[] {
  const samples: HrSample[] = [];
  const hz = bpm / 60;
  let seed = 42;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648 - 0.5;
  };
  for (let t = 0; t < seconds * 10; t++) {
    samples.push({ at: t * 100, red: 128 + 20 * Math.sin(2 * Math.PI * hz * (t / 10)) + noise * random() });
  }
  return samples;
}

describe("estimateHeartRate", () => {
  it("estimates 72 bpm from a clean signal", () => {
    expect(estimateHeartRate(sine(72, 10))).toBe(72);
  });

  it("tolerates noise", () => {
    const bpm = estimateHeartRate(sine(60, 10, 8));
    expect(bpm).not.toBeNull();
    expect(Math.abs((bpm as number) - 60)).toBeLessThanOrEqual(2);
  });

  it("returns null for a flat signal", () => {
    const samples: HrSample[] = [];
    for (let t = 0; t < 100; t++) samples.push({ at: t * 100, red: 128 });
    expect(estimateHeartRate(samples)).toBeNull();
  });

  it("returns null for a short or tiny sample", () => {
    expect(estimateHeartRate(sine(72, 3))).toBeNull();
    expect(estimateHeartRate([])).toBeNull();
  });

  it("returns null outside 30 to 220 bpm", () => {
    expect(estimateHeartRate(sine(25, 10))).toBeNull();
  });
});
