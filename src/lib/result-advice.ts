import { localDay, todayLocal, type CatalogMeasure, type KbEntry } from "@starplus/core";
import { HAZARD_SECTIONS } from "./hazards";
import { getKbEntry } from "./kb";

const ADVICE_PHRASES = ["crew medical officer", "flight surgeon", "report"];

export const ADVICE_FALLBACK = "Tell the crew medical officer.";

/** The measure KB entry's last sentence containing an escalation phrase, quoted word for word. */
export function adviceSentence(entry: KbEntry | null): string {
  if (!entry) return ADVICE_FALLBACK;
  const sentences: string[] = [];
  for (const paragraph of entry.text) {
    for (const part of paragraph.split(/(?<=[.!?]) +/)) {
      const sentence = part.trim();
      if (sentence.length > 0) sentences.push(sentence);
    }
  }
  const lowered = (text: string) => text.toLowerCase();
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (ADVICE_PHRASES.some((phrase) => lowered(sentences[i]).includes(phrase))) {
      return sentences[i];
    }
  }
  return ADVICE_FALLBACK;
}

/** Which published side a value falls on, from the catalog's own limits. Null when neither side fires. */
export function measureSide(
  measure: CatalogMeasure | undefined,
  value: number | string | null
): "high" | "low" | null {
  if (!measure) return null;
  const numeric = typeof value === "number" ? value : value === null || value === "" ? NaN : Number(value);
  if (!Number.isFinite(numeric)) return null;
  const highs = measure.limits
    .filter((limit) => limit.op === ">" || limit.op === ">=")
    .map((limit) => limit.value);
  const lows = measure.limits
    .filter((limit) => limit.op === "<" || limit.op === "<=")
    .map((limit) => limit.value);
  if (highs.length > 0 && numeric >= Math.min(...highs)) return "high";
  if (lows.length > 0 && numeric <= Math.max(...lows)) return "low";
  return null;
}

export interface HazardLink {
  name: string;
  href: string;
}

/** One "Related hazard" link per catalog hazard tag, named like the hazards page section. */
export function hazardLinks(measure: CatalogMeasure | undefined): HazardLink[] {
  if (!measure) return [];
  const links: HazardLink[] = [];
  for (const tag of measure.hazards) {
    const section = HAZARD_SECTIONS.find((entry) => entry.tag === tag);
    const title = section ? getKbEntry(section.kbKey)?.title : null;
    if (section && title) links.push({ name: title, href: `/hazards#${tag.replace(/_/g, "-")}` });
  }
  return links;
}

/** Critical first, then watch, then today's other readings; everything else folds away. */
export function orderResultEntries<T extends { status: string }>(
  entries: T[],
  measuredAt: (entry: T) => string | null,
  timeZone: string,
  now: number
): { top: T[]; folded: T[] } {
  const today = todayLocal(timeZone, now);
  const critical: T[] = [];
  const watch: T[] = [];
  const todayRest: T[] = [];
  const rest: T[] = [];
  for (const entry of entries) {
    if (entry.status === "critical") critical.push(entry);
    else if (entry.status === "watch") watch.push(entry);
    else {
      const at = measuredAt(entry);
      if (at && localDay(at, timeZone) === today) todayRest.push(entry);
      else rest.push(entry);
    }
  }
  return { top: [...critical, ...watch, ...todayRest], folded: rest };
}
