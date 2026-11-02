import type { SVGProps } from 'react';

/*
 * Inline icons drawn for this project (no icon-library dependency).
 * Decorative by default: `aria-hidden` unless a `title` is provided by the caller.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const MapPinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const TramIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="5" width="12" height="12" rx="3" />
    <path d="M6 12h12M9 20l1.5-3M15 20l-1.5-3M9 2.5h6M12 2.5V5" />
    <circle cx="9.5" cy="14.5" r=".6" fill="currentColor" />
    <circle cx="14.5" cy="14.5" r=".6" fill="currentColor" />
  </Svg>
);

export const ExternalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" />
  </Svg>
);

export const MailIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="M4 7l8 6 8-6" />
  </Svg>
);

export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 3.5h3l1.5 4-2 1.2a11 11 0 0 0 6.3 6.3l1.2-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" />
  </Svg>
);

export const BoltIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z" />
  </Svg>
);

export const BeanIcon = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="12" rx="6.5" ry="8.5" transform="rotate(35 12 12)" />
    <path d="M8.5 17.5c2.5-2 1-5 3.5-7s4.5-1 4-4" />
  </Svg>
);

export const InstagramIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r=".8" fill="currentColor" stroke="none" />
  </Svg>
);

export const FacebookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 8H17V4.5h-2.8A4.2 4.2 0 0 0 10 8.7V11H7.5v3.5H10v6h3.5v-6h2.8l.7-3.5h-3.5V9a1 1 0 0 1 1-1Z" />
  </Svg>
);

export const TiktokIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3.5v11.2a3.8 3.8 0 1 1-3.8-3.8M14 3.5c.4 2.6 2.3 4.4 5 4.6" />
  </Svg>
);
