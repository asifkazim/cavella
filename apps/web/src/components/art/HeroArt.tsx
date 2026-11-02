/**
 * Original illustration created for this project (no third-party assets): a Cavella
 * takeaway cup over a curving tram line. Decorative — hidden from assistive tech.
 * [PLACEHOLDER: hero photo] — can be swapped for licensed photography later (docs/ASSETS.md).
 */
export function HeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 440 480"
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="232" cy="246" r="206" className="fill-caramel-400" opacity="0.13" />
      <circle
        cx="232"
        cy="246"
        r="160"
        fill="none"
        className="stroke-cream-100"
        strokeOpacity="0.16"
        strokeDasharray="2 10"
        strokeLinecap="round"
        strokeWidth="2"
      />

      {/* Tram rails */}
      <g fill="none" className="stroke-cream-50" strokeOpacity="0.2" strokeWidth="2.5">
        <path d="M-20 418C120 344 290 344 460 262" />
        <path d="M-20 436C124 362 296 362 460 282" />
      </g>
      <g className="stroke-cream-50" strokeOpacity="0.12" strokeWidth="3" strokeLinecap="round">
        <path d="M40 392v26M100 370v26M160 357v26M330 340v26M390 314v26" />
      </g>

      {/* Steam */}
      <g fill="none" className="stroke-caramel-300" strokeWidth="5" strokeLinecap="round" opacity="0.9">
        <path d="M198 88c-12-14 12-24 0-40" />
        <path d="M228 80c-12-16 14-28 0-48" />
        <path d="M258 88c-12-14 12-24 0-40" />
      </g>

      {/* Lid */}
      <path d="M166 100h132l8 18H158z" className="fill-espresso-600" />
      <ellipse cx="258" cy="108" rx="10" ry="3" className="fill-espresso-950" opacity="0.6" />
      <rect x="148" y="116" width="168" height="24" rx="10" className="fill-espresso-700" />

      {/* Cup body */}
      <path d="M156 140h152l-22 240q-1 12-14 12h-80q-13 0-14-12z" className="fill-cream-50" />
      <path d="M296 140h12l-22 240q-1 12-14 12h-8q13 0 14-12z" className="fill-cream-300" opacity="0.7" />

      {/* Sleeve */}
      <path d="M162.4 210h139.2l-7.3 80H169.7z" className="fill-espresso-800" />
      <circle cx="232" cy="250" r="25" className="fill-caramel-400" />
      <path d="M220 243h24l-2.6 15.5a3 3 0 0 1-3 2.5h-12.8a3 3 0 0 1-3-2.5z" className="fill-espresso-950" />
      <path d="M218.5 239.5h27" className="stroke-espresso-950" strokeWidth="3" strokeLinecap="round" />

      {/* Coffee beans */}
      <g className="fill-espresso-600">
        <ellipse cx="96" cy="196" rx="14" ry="20" transform="rotate(-30 96 196)" />
        <ellipse cx="366" cy="162" rx="11" ry="16" transform="rotate(25 366 162)" />
        <ellipse cx="372" cy="402" rx="12" ry="17" transform="rotate(-15 372 402)" />
      </g>
      <g fill="none" className="stroke-caramel-400" strokeWidth="2.5" strokeLinecap="round">
        <path d="M90 184c8 6 2 18 12 24" />
        <path d="M362 152c-4 7 6 14 2 21" />
        <path d="M368 391c6 6-1 15 6 22" />
      </g>
    </svg>
  );
}
