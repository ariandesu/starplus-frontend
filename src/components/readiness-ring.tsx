interface Segment {
  label: string;
  done: boolean;
}

export function ReadinessRing({
  checkIn,
  exercise,
  sleep,
  hydration,
  legend = true,
}: {
  checkIn: boolean;
  exercise: boolean;
  sleep: boolean;
  hydration: boolean;
  legend?: boolean;
}) {
  const segments: Segment[] = [
    { label: "Check-in", done: checkIn },
    { label: "Exercise", done: exercise },
    { label: "Sleep", done: sleep },
    { label: "Hydration", done: hydration },
  ];
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference / segments.length;
  const done = segments.filter((segment) => segment.done).length;

  return (
    <div className="flex items-center gap-4">
      <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`${done} of 4 daily goals done`}>
        <circle cx="66" cy="66" r={radius} fill="none" strokeWidth="12" stroke="var(--surface-2)" />
        {segments.map((segment, index) => (
          <circle
            key={segment.label}
            cx="66"
            cy="66"
            r={radius}
            fill="none"
            stroke={segment.done ? "var(--foreground)" : "transparent"}
            strokeWidth="12"
            strokeDasharray={`${arc - 4} ${circumference - arc + 4}`}
            strokeDashoffset={-index * arc + circumference / 4}
            strokeLinecap="round"
            transform="rotate(-90 66 66)"
          />
        ))}
        <text x="66" y="62" textAnchor="middle" fill="var(--foreground)" className="text-xl font-bold">
          {done}/4
        </text>
        <text x="66" y="80" textAnchor="middle" fill="var(--muted)" className="text-xs">
          today
        </text>
      </svg>
      {legend && (
        <ul className="space-y-1 text-sm">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-2">
              <span
                className={
                  segment.done
                    ? "inline-block h-3 w-3 rounded-full bg-foreground"
                    : "inline-block h-3 w-3 rounded-full bg-surface-2"
                }
              />
              <span className={segment.done ? "text-foreground" : "text-muted"}>
                {segment.label}
                {segment.done ? " ✓" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
