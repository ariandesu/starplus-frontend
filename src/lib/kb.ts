import type { KbEntry, KbCitation } from "@starplus/core";
import explainCache from "@starplus/core/content/explain-cache.json" with { type: "json" };
import hazardAlteredGravity from "@starplus/core/content/kb/hazard-altered-gravity.json" with { type: "json" };
import hazardDistance from "@starplus/core/content/kb/hazard-distance-from-earth.json" with { type: "json" };
import hazardEnvironment from "@starplus/core/content/kb/hazard-hostile-environment.json" with { type: "json" };
import hazardIsolation from "@starplus/core/content/kb/hazard-isolation-confinement.json" with { type: "json" };
import hazardRadiation from "@starplus/core/content/kb/hazard-radiation.json" with { type: "json" };
import aidAnaphylaxis from "@starplus/core/content/kb/firstaid-anaphylaxis.json" with { type: "json" };
import aidBleeding from "@starplus/core/content/kb/firstaid-bleeding.json" with { type: "json" };
import aidBurns from "@starplus/core/content/kb/firstaid-burns.json" with { type: "json" };
import aidChestPain from "@starplus/core/content/kb/firstaid-chest-pain.json" with { type: "json" };
import aidChoking from "@starplus/core/content/kb/firstaid-choking.json" with { type: "json" };
import aidCpr from "@starplus/core/content/kb/firstaid-cpr.json" with { type: "json" };
import aidFainting from "@starplus/core/content/kb/firstaid-fainting.json" with { type: "json" };
import aidLowSugar from "@starplus/core/content/kb/firstaid-low-blood-sugar.json" with { type: "json" };
import aidUnresponsive from "@starplus/core/content/kb/firstaid-unresponsive.json" with { type: "json" };
import measureActivity from "@starplus/core/content/kb/measure-activity.json" with { type: "json" };
import measureBodyMass from "@starplus/core/content/kb/measure-body-mass.json" with { type: "json" };
import measureCabinCo2 from "@starplus/core/content/kb/measure-cabin-co2.json" with { type: "json" };
import measureCabinO2 from "@starplus/core/content/kb/measure-cabin-o2.json" with { type: "json" };
import measureCabinTemperature from "@starplus/core/content/kb/measure-cabin-temperature.json" with { type: "json" };
import measureCalories from "@starplus/core/content/kb/measure-calories.json" with { type: "json" };
import measureDiastolic from "@starplus/core/content/kb/measure-diastolic-bp.json" with { type: "json" };
import measureGlucose from "@starplus/core/content/kb/measure-glucose.json" with { type: "json" };
import measureHeartRate from "@starplus/core/content/kb/measure-heart-rate.json" with { type: "json" };
import measureHrv from "@starplus/core/content/kb/measure-hrv.json" with { type: "json" };
import measureHydration from "@starplus/core/content/kb/measure-hydration.json" with { type: "json" };
import measureMood from "@starplus/core/content/kb/measure-mood.json" with { type: "json" };
import measureRadiation from "@starplus/core/content/kb/measure-radiation.json" with { type: "json" };
import measureReaction from "@starplus/core/content/kb/measure-reaction.json" with { type: "json" };
import measureResp from "@starplus/core/content/kb/measure-respiratory-rate.json" with { type: "json" };
import measureSleep from "@starplus/core/content/kb/measure-sleep.json" with { type: "json" };
import measureSleepQuality from "@starplus/core/content/kb/measure-sleep-quality.json" with { type: "json" };
import measureSpo2 from "@starplus/core/content/kb/measure-spo2.json" with { type: "json" };
import measureStress from "@starplus/core/content/kb/measure-stress.json" with { type: "json" };
import measureSystolic from "@starplus/core/content/kb/measure-systolic-bp.json" with { type: "json" };
import measureTemp from "@starplus/core/content/kb/measure-temperature.json" with { type: "json" };
import measureWater from "@starplus/core/content/kb/measure-water.json" with { type: "json" };
import modelJson from "@starplus/core/content/model.json" with { type: "json" };
import type { ModelDefinition } from "@starplus/core";

const ENTRIES: Record<string, KbEntry> = {
  "hazard-altered-gravity": hazardAlteredGravity as KbEntry,
  "hazard-distance-from-earth": hazardDistance as KbEntry,
  "hazard-hostile-environment": hazardEnvironment as KbEntry,
  "hazard-isolation-confinement": hazardIsolation as KbEntry,
  "hazard-radiation": hazardRadiation as KbEntry,
  "firstaid-anaphylaxis": aidAnaphylaxis as KbEntry,
  "firstaid-bleeding": aidBleeding as KbEntry,
  "firstaid-burns": aidBurns as KbEntry,
  "firstaid-chest-pain": aidChestPain as KbEntry,
  "firstaid-choking": aidChoking as KbEntry,
  "firstaid-cpr": aidCpr as KbEntry,
  "firstaid-fainting": aidFainting as KbEntry,
  "firstaid-low-blood-sugar": aidLowSugar as KbEntry,
  "firstaid-unresponsive": aidUnresponsive as KbEntry,
  "measure-activity": measureActivity as KbEntry,
  "measure-body-mass": measureBodyMass as KbEntry,
  "measure-cabin-co2": measureCabinCo2 as KbEntry,
  "measure-cabin-o2": measureCabinO2 as KbEntry,
  "measure-cabin-temperature": measureCabinTemperature as KbEntry,
  "measure-calories": measureCalories as KbEntry,
  "measure-diastolic-bp": measureDiastolic as KbEntry,
  "measure-glucose": measureGlucose as KbEntry,
  "measure-heart-rate": measureHeartRate as KbEntry,
  "measure-hrv": measureHrv as KbEntry,
  "measure-hydration": measureHydration as KbEntry,
  "measure-mood": measureMood as KbEntry,
  "measure-radiation": measureRadiation as KbEntry,
  "measure-reaction": measureReaction as KbEntry,
  "measure-respiratory-rate": measureResp as KbEntry,
  "measure-sleep": measureSleep as KbEntry,
  "measure-sleep-quality": measureSleepQuality as KbEntry,
  "measure-spo2": measureSpo2 as KbEntry,
  "measure-stress": measureStress as KbEntry,
  "measure-systolic-bp": measureSystolic as KbEntry,
  "measure-temperature": measureTemp as KbEntry,
  "measure-water": measureWater as KbEntry,
};

export function getKbEntry(key: string): KbEntry | null {
  return ENTRIES[key] ?? null;
}

// Mirror of tools/pregenerate.ts: MODEL + ":standard+simple:" + model + ":prompts-v" + PROMPT_VERSION.
const EXPLAIN_MODEL = "muse-spark-1.3-contributor";
const EXPLAIN_PROMPTS = "prompts-v1";

async function explainKey(id: string, text: string[]): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${id}\n${text.join("\n")}`));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex}:standard+simple:${EXPLAIN_MODEL}:${EXPLAIN_PROMPTS}`;
}

interface ExplainCacheFile {
  entries: Record<string, { standard: string; simple: string; status: string }>;
}

/** Reviewed AI text for an entry, or null (rejected/missing/changed source). */
export async function getExplanation(entryId: string, level: "standard" | "simple"): Promise<string | null> {
  const entry = ENTRIES[entryId];
  if (!entry) return null;
  const key = await explainKey(entry.id, entry.text);
  const cached = (explainCache as unknown as ExplainCacheFile).entries[key];
  if (!cached || cached.status !== "reviewed") return null;
  return cached[level] ?? null;
}

export function getModelDefinition(): ModelDefinition {
  return modelJson as unknown as ModelDefinition;
}

export function citeLabel(citation: KbCitation): string {
  return `${citation.title} — ${citation.publisher}, ${citation.year}`;
}

export function reasonText(reason: string): string {
  switch (reason) {
    case "limit_watch":
      return "at or beyond a watch limit";
    case "limit_critical":
      return "at or beyond a critical limit";
    case "baseline_watch":
      return "rising against the personal baseline";
    case "baseline_critical":
      return "rising strongly against the personal baseline";
    case "within_limits":
      return "inside the safety limits";
    case "insufficient_baseline":
      return "not enough history yet — a baseline needs 5 readings older than 3 days";
    case "estimate_abnormal":
      return "estimated and outside the limits — confirm with a device";
    case "refuted_estimate":
      return "an earlier estimate a device reading overruled";
    default:
      return reason;
  }
}
