import { CATALOG, type CatalogMeasure } from "@starplus/core";

export interface HazardSection {
  key: string;
  kbKey: string;
  tag: string;
}

export const HAZARD_SECTIONS: HazardSection[] = [
  { key: "radiation", kbKey: "hazard-radiation", tag: "radiation" },
  { key: "isolation", kbKey: "hazard-isolation-confinement", tag: "isolation_confinement" },
  { key: "distance", kbKey: "hazard-distance-from-earth", tag: "distance_from_earth" },
  { key: "gravity", kbKey: "hazard-altered-gravity", tag: "altered_gravity" },
  { key: "environment", kbKey: "hazard-hostile-environment", tag: "hostile_environment" },
];

export function measuresForHazard(tag: string): CatalogMeasure[] {
  return CATALOG.measures.filter((measure) => measure.hazards.includes(tag));
}
