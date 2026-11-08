import { MGDL_PER_MOLL } from "./ble-parse.ts";
import type { SpokenReading } from "./voice.ts";

const NUMBER = "-?\\d+(?:[.,]\\d+)?";
const UNIT_WORDS =
  "bpm|beats per minute|mmhg|mm hg|percent|%|degrees?|celsius|fahrenheit|°c|°f|kilograms?|kilos?|kg|pounds?|lbs?|lb|mg/dl|mmol/l";

export function parseDisplayReading(text: string): SpokenReading[] {
  const lowered = text.toLowerCase().replace(/[,]/g, " ").replace(/\s+/g, " ").trim();
  const readings: SpokenReading[] = [];

  const pair = new RegExp(`(${NUMBER})\\s*(/|\\bover\\b)\\s*(${NUMBER})`).exec(lowered);
  const mmhgAfterTwoNumbers = new RegExp(`(${NUMBER})\\s+(${NUMBER})\\s*mm\\s?hg`).exec(lowered);
  const pairMatch = pair ?? mmhgAfterTwoNumbers;
  if (pairMatch) {
    const systolic = Number(pairMatch[1].replace(",", "."));
    const diastolic = Number(pairMatch[pairMatch.length - 1].replace(",", "."));
    if (Number.isFinite(systolic) && Number.isFinite(diastolic)) {
      readings.push(
        { value: systolic, unit: "mmHg", metric: "blood_pressure_systolic" },
        { value: diastolic, unit: "mmHg", metric: "blood_pressure_diastolic" }
      );
      return readings;
    }
  }

  const pattern = new RegExp(`(${NUMBER})\\s*(${UNIT_WORDS})(?![a-z])`, "g");
  for (const match of lowered.matchAll(pattern)) {
    const value = Number(match[1].replace(",", "."));
    if (!Number.isFinite(value)) continue;
    const unitWord = match[2];
    const reading = readingForUnit(value, unitWord);
    if (reading) readings.push(reading);
  }
  return readings;
}

function readingForUnit(value: number, unitWord: string): SpokenReading | null {
  const word = unitWord.replace(/\s+/g, "");
  if (word === "bpm" || word === "beatsperminute") return { value, unit: "bpm", metric: "heart_rate" };
  if (word === "mmhg") return { value, unit: "mmHg", metric: null };
  if (word === "percent" || word === "%") return { value, unit: "%", metric: "oxygen_saturation" };
  if (word === "celsius" || word === "°c" || word === "degree" || word === "degrees")
    return { value, unit: "°C", metric: "temperature_c" };
  if (word === "fahrenheit" || word === "°f") {
    const celsius = Math.round((((value - 32) * 5) / 9) * 100) / 100;
    return { value: celsius, unit: "°C", metric: "temperature_c" };
  }
  if (word === "mg/dl") return { value, unit: "mg/dL", metric: "blood_glucose" };
  if (word === "mmol/l")
    return { value: Math.round(value * (MGDL_PER_MOLL / 1000) * 100) / 100, unit: "mg/dL", metric: "blood_glucose" };
  if (word === "kilogram" || word === "kilograms" || word === "kilo" || word === "kilos" || word === "kg")
    return { value, unit: "kg", metric: "body_mass" };
  if (word === "pound" || word === "pounds" || word === "lb" || word === "lbs")
    return { value: Math.round(value * 0.453_592_37 * 100) / 100, unit: "kg", metric: "body_mass" };
  return null;
}

export async function recognizeDisplay(image: Blob): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(image);
    return text;
  } finally {
    await worker.terminate();
  }
}
