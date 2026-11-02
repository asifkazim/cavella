/**
 * Interim wordmark: set in Fraunces with an original cup mark drawn for this project.
 * [PLACEHOLDER: logo asset] — replace with the final brand logo (SVG) when available.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" width="30" height="30" className="shrink-0" aria-hidden="true" focusable="false">
        <circle cx="16" cy="16" r="15" className="fill-caramel-400" />
        <path
          d="M10 12.5h12l-1.4 9.2a2.5 2.5 0 0 1-2.5 2.1h-4.2a2.5 2.5 0 0 1-2.5-2.1L10 12.5Z"
          className="fill-espresso-950"
        />
        <path d="M9.2 10.5h13.6" className="stroke-espresso-950" strokeWidth="2" strokeLinecap="round" />
        <path d="M13 16.5h6" className="stroke-caramel-400" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {/* Logotype: fixed px size so it never pushes the header controls off-screen at large text sizes. */}
      <span className="font-display text-[26px] leading-none font-semibold tracking-tight whitespace-nowrap">
        Cavella
      </span>
    </span>
  );
}
