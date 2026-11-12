"use client";

/**
 * Decorative space line-art for the dashboard, drawn inline so it works
 * offline with no image assets. Both are aria-hidden; they never carry
 * meaning, status colours or text.
 */
export function StationSilhouette({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 180"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      {/* main truss */}
      <line x1={20} y1={92} x2={380} y2={92} />
      {/* solar panel pairs */}
      <g>
        <rect x={48} y={52} width={64} height={30} rx={2} />
        <rect x={48} y={98} width={64} height={30} rx={2} />
        <line x1={64} y1={52} x2={64} y2={82} />
        <line x1={80} y1={52} x2={80} y2={82} />
        <line x1={96} y1={52} x2={96} y2={82} />
        <line x1={64} y1={98} x2={64} y2={128} />
        <line x1={80} y1={98} x2={80} y2={128} />
        <line x1={96} y1={98} x2={96} y2={128} />
        <rect x={288} y={52} width={64} height={30} rx={2} />
        <rect x={288} y={98} width={64} height={30} rx={2} />
        <line x1={304} y1={52} x2={304} y2={82} />
        <line x1={320} y1={52} x2={320} y2={82} />
        <line x1={336} y1={52} x2={336} y2={82} />
        <line x1={304} y1={98} x2={304} y2={128} />
        <line x1={320} y1={98} x2={320} y2={128} />
        <line x1={336} y1={98} x2={336} y2={128} />
      </g>
      {/* radiators */}
      <line x1={140} y1={92} x2={140} y2={64} />
      <line x1={140} y1={64} x2={172} y2={64} />
      <line x1={260} y1={92} x2={260} y2={64} />
      <line x1={228} y1={64} x2={260} y2={64} />
      {/* modules */}
      <rect x={150} y={84} width={100} height={16} rx={8} />
      <rect x={188} y={100} width={34} height={14} rx={7} />
      {/* cupola + antenna */}
      <circle cx={200} cy={76} r={6} />
      <line x1={238} y1={84} x2={238} y2={62} />
      <circle cx={238} cy={58} r={2} />
    </svg>
  );
}

export function ShuttleSketch({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      {/* fuselage */}
      <path d="M18 78 C 60 66, 118 62, 168 66 L 196 70 C 202 71, 202 79, 196 80 L 150 86 C 100 90, 48 90, 18 86 Z" />
      {/* delta wing */}
      <path d="M96 80 L 150 108 L 168 108 L 132 78" />
      {/* tail */}
      <path d="M150 68 L 166 34 L 174 34 L 162 68" />
      {/* engines */}
      <circle cx={188} cy={73} r={5} />
      <circle cx={188} cy={83} r={5} />
      {/* cockpit windows */}
      <path d="M150 68 L 158 68 L 156 73 L 148 73 Z" />
      {/* orbit dots */}
      <circle cx={30} cy={30} r={1.5} />
      <circle cx={196} cy={28} r={1.5} />
      <circle cx={52} cy={104} r={1.5} />
    </svg>
  );
}
