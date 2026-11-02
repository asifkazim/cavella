export interface SectionPosition {
  readonly id: string;
  /** Section top relative to the viewport top, in px (from getBoundingClientRect). */
  readonly top: number;
}

/**
 * Picks the section currently being read: the last section whose top has passed the
 * reading line (just under the sticky header). At the bottom of the page the last
 * section wins, so short final sections can still become active. Returns `null` above
 * the first section.
 */
export function activeSection(
  sections: readonly SectionPosition[],
  readingLine: number,
  atPageBottom: boolean,
): string | null {
  if (sections.length === 0) return null;
  if (atPageBottom) return sections[sections.length - 1]?.id ?? null;
  let active: string | null = null;
  for (const section of sections) {
    if (section.top <= readingLine) active = section.id;
  }
  return active;
}
