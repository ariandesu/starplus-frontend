interface Segment {
  label: string;
  done: boolean;
  color: string;
}

export function ReadinessRing({
  checkIn,
  exercise,
  sleep,
  hydration,
}: {
  checkIn: boolean;
  exercise: boolean;
  sleep: boolean;
  hydration: boolean;
}) {
  const segments: Segment[] = [
    { label: "Check-in", done: checkIn, color: "#2563eb" },
    { label: "Exercise", done: exercise, color: "#16a34a" },
    { label: "Sleep", done: sleep, color: "#7c3aed" },
    { label: "Hydration", done: hydration, color: "#0891b2" },
  ];
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference / segments.length;
  const done = segments.filter((segment) => segment.done).length;

  return (
    <div className="flex items-center gap-4">
      <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`${done} of 4 daily goals done`}>
        <circle cx="66" cy="66" r={radius} fill="none" strokeWidth="12" className="stroke-slate-200" />
        {segments.map((segment, index) => (
          <circle
            key={segment.label}
            cx="66"
            cy="66"
            r={radius}
            fill="none"
            stroke={segment.done ? segment.color : "transparent"}
            strokeWidth="12"
            strokeDasharray={`${arc - 4} ${circumference - arc + 4}`}
            strokeDashoffset={-index * arc + circumference / 4}
            strokeLinecap="round"
            transform="rotate(-90 66 66)"
          />
        ))}
        <text x="66" y="62" textAnchor="middle" className="fill-slate-900 text-xl font-bold">
          {done}/4
        </text>
        <text x="66" y="80" textAnchor="middle" className="fill-slate-500 text-xs">
          today
        </text>
      </svg>
      <ul className="space-y-1 text-sm">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: segment.done ? segment.color : "#cbd5e1" }}
            />
            <span className={segment.done ? "text-slate-900" : "text-slate-500"}>
              {segment.label}
              {segment.done ? " ✓" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
