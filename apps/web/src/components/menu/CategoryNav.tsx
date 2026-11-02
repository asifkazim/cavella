'use client';

import { useEffect, useRef, useState } from 'react';
import { activeSection } from '@/lib/scrollspy';

interface CategoryNavProps {
  readonly label: string;
  readonly categories: readonly { readonly id: string; readonly name: string }[];
}

/**
 * Reading line below the viewport top. At least the sticky header + this bar (anchor jumps
 * land at 144 px via scroll-padding), and a third of the viewport on tall screens so a
 * section activates while its heading is comfortably in view.
 */
const MIN_READING_LINE_PX = 170;
const READING_LINE_RATIO = 0.33;

/**
 * Sticky, horizontally scrollable category links. Plain anchor links work without
 * JavaScript; the script only highlights the section currently being read.
 */
export function CategoryNav({ label, categories }: CategoryNavProps) {
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const positions = categories.flatMap((c) => {
        const el = document.getElementById(c.id);
        return el ? [{ id: c.id, top: el.getBoundingClientRect().top }] : [];
      });
      const doc = document.documentElement;
      const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
      const readingLine = Math.max(MIN_READING_LINE_PX, window.innerHeight * READING_LINE_RATIO);
      setActive(activeSection(positions, readingLine, atBottom));
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [categories]);

  // Keep the active chip visible inside the horizontal scroller (never scrolls the page).
  useEffect(() => {
    const list = listRef.current;
    const chip = active ? list?.querySelector<HTMLElement>(`[data-category="${active}"]`) : null;
    if (!list || !chip) return;
    const left = chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2;
    list.scrollTo({ left, behavior: 'smooth' });
  }, [active]);

  return (
    <nav
      aria-label={label}
      className="sticky top-[calc(var(--header-height)+env(safe-area-inset-top,0px))] z-30 border-b border-espresso-900/10 bg-cream-100"
    >
      <ul
        ref={listRef}
        className="container-page flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((category) => {
          const isActive = active === category.id;
          return (
            <li key={category.id} className="shrink-0">
              <a
                href={`#${category.id}`}
                data-category={category.id}
                aria-current={isActive ? 'location' : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-5 text-[0.95rem] font-semibold ${
                  isActive
                    ? 'bg-espresso-900 text-cream-50'
                    : 'bg-cream-50 text-espresso-900 ring-1 ring-espresso-900/10 hover:ring-espresso-900/30'
                }`}
              >
                {category.name}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
