import type { KbEntry } from "@starplus/core";
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

export function getModelDefinition(): ModelDefinition {
  return modelJson as unknown as ModelDefinition;
}
