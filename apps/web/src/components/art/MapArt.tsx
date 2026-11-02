/**
 * Original, stylised map illustration (not geographic data). Stands in for
 * [PLACEHOLDER: static map image] until a real, licensed static map is supplied.
 */
export function MapArt({ label, className = '' }: { label: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 400 260"
      role="img"
      aria-label={label}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="400" height="260" className="fill-cream-200" />

      {/* Blocks */}
      <g className="fill-cream-300" opacity="0.8">
        <rect x="18" y="18" width="110" height="70" rx="10" />
        <rect x="150" y="18" width="90" height="56" rx="10" />
        <rect x="262" y="18" width="120" height="84" rx="10" />
        <rect x="18" y="176" width="96" height="66" rx="10" />
        <rect x="280" y="180" width="102" height="62" rx="10" />
      </g>
      <rect x="140" y="182" width="118" height="60" rx="10" className="fill-emerald-700" opacity="0.18" />

      {/* Streets */}
      <g className="stroke-cream-50" strokeWidth="14" strokeLinecap="round">
        <path d="M0 130h400" />
        <path d="M138 0v260" />
        <path d="M262 0l-20 260" />
      </g>

      {/* Tram line */}
      <g fill="none" className="stroke-caramel-500" strokeWidth="3">
        <path d="M0 124h400" />
        <path d="M0 136h400" />
      </g>
      <g className="stroke-caramel-500" strokeWidth="2" opacity="0.6">
        <path d="M20 121v18M50 121v18M80 121v18M110 121v18M290 121v18M320 121v18M350 121v18M380 121v18" />
      </g>

      {/* Stop platform */}
      <rect x="168" y="142" width="72" height="12" rx="4" className="fill-espresso-700" opacity="0.35" />

      {/* Kiosk pin */}
      <g transform="translate(204 118)">
        <ellipse cx="0" cy="34" rx="16" ry="5" className="fill-espresso-950" opacity="0.18" />
        <path d="M0 32S-22 8-22-8a22 22 0 0 1 44 0C22 8 0 32 0 32Z" className="fill-espresso-900" />
        <circle cx="0" cy="-8" r="9" className="fill-caramel-400" />
      </g>
    </svg>
  );
}
