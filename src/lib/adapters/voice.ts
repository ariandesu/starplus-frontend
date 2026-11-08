const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const SCALES: Record<string, number> = { hundred: 100, thousand: 1000 };

export function parseSpokenNumber(text: string): number | null {
  const words = normalize(text).split(/\s+/).filter((word) => word.length > 0 && word !== "and");
  if (words.length === 0) return null;

  let negative = false;
  let rest = words;
  if (rest[0] === "minus" || rest[0] === "negative") {
    negative = true;
    rest = rest.slice(1);
  }
  if (rest.length === 0) return null;

  const pointAt = rest.findIndex((word) => word === "point" || word === "dot");
  const head = pointAt === -1 ? rest : rest.slice(0, pointAt);
  const tail = pointAt === -1 ? [] : rest.slice(pointAt + 1);

  const whole = parseWhole(head);
  if (whole === null) return null;
  if (tail.length > 0) {
    const digits = tail.map((word) => ONES[word]);
    if (digits.some((digit) => digit === undefined || digit > 9)) return null;
    const fraction = Number(`0.${(digits as number[]).join("")}`);
    return (negative ? -1 : 1) * (whole + fraction);
  }
  return (negative ? -1 : 1) * whole;
}

function parseWhole(words: string[]): number | null {
  if (words.length === 0) return null;
  let total = 0;
  let current = 0;
  let seen = false;
  let index = 0;
  while (index < words.length) {
    const word = words[index];
    if (
      word in ONES && ONES[word] >= 1 && ONES[word] <= 9 &&
      index + 1 < words.length && (words[index + 1] in HUNDREDS_NEXT || words[index + 1] === "oh")
    ) {
      current += ONES[word] * 100;
      seen = true;
      index += 1;
      continue;
    }
    if (word === "oh") {
      seen = true;
      index += 1;
      continue;
    }
    if (word in ONES) {
      current += ONES[word];
      seen = true;
    } else if (word in TENS) {
      current += TENS[word];
      seen = true;
    } else if (word in SCALES) {
      if (!seen) return null;
      current *= SCALES[word];
      if (SCALES[word] >= 1000) {
        total += current;
        current = 0;
      }
      seen = true;
    } else {
      return null;
    }
    index += 1;
  }
  if (!seen) return null;
  return total + current;
}

const SECOND_WORDS: Record<string, number> = { ...TENS };
const HUNDREDS_NEXT: Record<string, number> = { ...TENS };
for (const [word, value] of Object.entries(ONES)) {
  if (value >= 10) SECOND_WORDS[word] = value;
  if (value >= 10 && value < 100) HUNDREDS_NEXT[word] = value;
}

function parseBloodPressureNumber(words: string[]): number | null {
  const compact = words.filter((word) => word !== "and");
  if (compact.length === 2 && compact[0] in ONES && ONES[compact[0]] < 10 && compact[1] in SECOND_WORDS) {
    return ONES[compact[0]] * 100 + SECOND_WORDS[compact[1]];
  }
  return parseWhole(compact);
}

export interface SpokenReading {
  value: number;
  unit: string;
  metric: string | null;
}

interface MetricKeyword {
  metric: string;
  unit: string;
  patterns: RegExp[];
}

const METRICS: MetricKeyword[] = [
  { metric: "blood_pressure_systolic", unit: "mmHg", patterns: [/blood pressure/] },
  { metric: "heart_rate", unit: "bpm", patterns: [/heart rate/, /heart\b/, /\bpulse\b/] },
  { metric: "oxygen_saturation", unit: "%", patterns: [/oxygen/, /saturation/, /spo2/, /\bo2\b/] },
  { metric: "temperature_c", unit: "°C", patterns: [/temperature/, /\btemp\b/, /fever/] },
  { metric: "blood_glucose", unit: "mg/dL", patterns: [/blood sugar/, /glucose/, /sugar/] },
  { metric: "body_mass", unit: "kg", patterns: [/weight/, /\bweigh\b/] },
  { metric: "respiratory_rate", unit: "/min", patterns: [/breathing rate/, /breathing/, /\bbreath\b/, /respiratory/] },
];

const UNIT_FALLBACK: Array<{ metric: string | null; unit: string; patterns: RegExp[] }> = [
  { metric: "heart_rate", unit: "bpm", patterns: [/beats per minute/, /beats a minute/, /\bbpm\b/] },
  { metric: null, unit: "mmHg", patterns: [/\bmmhg\b/] },
  { metric: "oxygen_saturation", unit: "%", patterns: [/percent/, /percentage/] },
  { metric: "temperature_c", unit: "°C", patterns: [/degrees/, /celsius/] },
  { metric: "temperature_c", unit: "°C", patterns: [/fahrenheit/] },
  { metric: "body_mass", unit: "kg", patterns: [/kilograms?/, /\bkilos?\b/] },
  { metric: "body_mass", unit: "kg", patterns: [/pounds?/, /\blbs?\b/] },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
}

function longestNumber(words: string[]): number | null {
  for (let start = 0; start < words.length; start++) {
    for (let end = words.length; end > start; end--) {
      const value = parseSpokenNumber(words.slice(start, end).join(" "));
      if (value !== null) return value;
    }
  }
  return null;
}

export function extractReadings(text: string): SpokenReading[] {
  const lowered = normalize(text);

  const overAt = lowered.search(/\bover\b/);
  if (overAt !== -1) {
    const left = longestBpNumber(lowered.slice(0, overAt));
    const right = longestBpNumber(lowered.slice(overAt + 4));
    if (left !== null && right !== null) {
      return [
        { value: left, unit: "mmHg", metric: "blood_pressure_systolic" },
        { value: right, unit: "mmHg", metric: "blood_pressure_diastolic" },
      ];
    }
  }

  for (const entry of METRICS) {
    for (const pattern of entry.patterns) {
      const match = pattern.exec(lowered);
      if (!match || match.index === undefined) continue;
      const after = lowered.slice(match.index + match[0].length).split(/\s+/).filter((w) => w.length > 0);
      const value = longestNumber(after);
      if (value !== null) return [{ value, unit: entry.unit, metric: entry.metric }];
    }
  }

  for (const entry of UNIT_FALLBACK) {
    for (const pattern of entry.patterns) {
      const match = pattern.exec(lowered);
      if (!match || match.index === undefined) continue;
      const before = lowered.slice(0, match.index).split(/\s+/).filter((w) => w.length > 0);
      const value = longestNumber(before);
      if (value !== null) return [{ value, unit: entry.unit, metric: entry.metric }];
    }
  }

  const bare = parseSpokenNumber(lowered);
  if (bare !== null) return [{ value: bare, unit: "", metric: null }];
  return [];
}

function longestBpNumber(fragment: string): number | null {
  const words = fragment.split(/\s+/).filter((w) => w.length > 0);
  for (let start = 0; start < words.length; start++) {
    for (let end = words.length; end > start; end--) {
      const value = parseBloodPressureNumber(words.slice(start, end));
      if (value !== null) return value;
    }
  }
  return null;
}
