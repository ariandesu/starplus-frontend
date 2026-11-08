export const ONE_WAY_SECONDS: Record<string, number> = {
  iss: 5,
  moon_base: 1.3,
  mars_transit: 20 * 60,
  rover: 20 * 60,
};

export function oneWaySeconds(setting: string): number {
  return ONE_WAY_SECONDS[setting] ?? ONE_WAY_SECONDS.iss;
}

export function earliestReplySeconds(setting: string): number {
  return oneWaySeconds(setting) * 2;
}

export function formatDelay(totalSeconds: number): string {
  if (totalSeconds < 60) return `about ${Math.round(totalSeconds)} seconds`;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 90) return `about ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `about ${hours} hours` : `about ${hours}h ${rest}m`;
}

export function commsSummary(setting: string, blackout: boolean): string {
  if (blackout) return "Link in simulated blackout: nothing sends until it returns.";
  return `One-way delay ${formatDelay(oneWaySeconds(setting))}; earliest reply ${formatDelay(earliestReplySeconds(setting))} after sending.`;
}
