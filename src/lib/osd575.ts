/**
 * NASA OSDR OSD-575: SpaceX Inspiration4 comprehensive metabolic panel.
 * Serum glucose (mg/dL) for the four crew members (C001 to C004) at seven time points,
 * copied from LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv
 * (column glucose_value_milligram_per_deciliter), retrieved 2026-11-14.
 *
 * Used only as a population reference band on the glucose history chart. It never
 * changes a status: assess() in core/ decides every status.
 */
export const OSD_575_URL = "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575";

export const OSD_575_GLUCOSE_MG_DL: Readonly<Record<string, number>> = {
  "C001_serum_L-92": 83,
  "C001_serum_L-44": 80,
  "C001_serum_L-3": 69,
  "C001_serum_R+1": 90,
  "C001_serum_R+45": 84,
  "C001_serum_R+82": 91,
  "C001_serum_R+194": 87,
  "C002_serum_L-92": 69,
  "C002_serum_L-44": 72,
  "C002_serum_L-3": 78,
  "C002_serum_R+1": 83,
  "C002_serum_R+45": 44,
  "C002_serum_R+82": 77,
  "C002_serum_R+194": 84,
  "C003_serum_L-92": 77,
  "C003_serum_L-44": 62,
  "C003_serum_L-3": 75,
  "C003_serum_R+1": 103,
  "C003_serum_R+45": 36,
  "C003_serum_R+82": 80,
  "C003_serum_R+194": 73,
  "C004_serum_L-92": 100,
  "C004_serum_L-44": 83,
  "C004_serum_L-3": 56,
  "C004_serum_R+1": 97,
  "C004_serum_R+45": 43,
  "C004_serum_R+82": 80,
  "C004_serum_R+194": 84,
};

export interface GlucoseReference {
  /** Number of samples the band is computed from. */
  n: number;
  mean: number;
  sd: number;
  low: number;
  high: number;
  label: string;
  sourceUrl: string;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Mean ± 1 sample SD of the OSD-575 glucose values. The four R+45 samples are left out,
 * as in the backend's synthetic-data method (three of them are unexplained lows of
 * 36 to 44 mg/dL), leaving 24 samples: mean 80.5, SD 11.1, band 69.4 to 91.7 mg/dL.
 */
export function osd575GlucoseReference(): GlucoseReference {
  const values = Object.entries(OSD_575_GLUCOSE_MG_DL)
    .filter(([sample]) => !sample.endsWith("_R+45"))
    .map(([, value]) => value);
  const n = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  return {
    n,
    mean: round1(mean),
    sd: round1(sd),
    low: round1(mean - sd),
    high: round1(mean + sd),
    label: "Inspiration4 crew range",
    sourceUrl: OSD_575_URL,
  };
}
