import { isPlaceholder, placeholderToken, type Editable } from '@/content/placeholder';

interface PlaceholderTokenProps {
  readonly label: string;
  readonly tone?: 'light' | 'dark';
}

/**
 * Visible `[PLACEHOLDER: …]` token for unconfirmed content (PRD AC-W-03, AC-REL-01).
 * The dashed outline makes unfinished content obvious during review.
 */
export function PlaceholderToken({ label, tone = 'light' }: PlaceholderTokenProps) {
  const toneClass =
    tone === 'dark'
      ? 'border-caramel-300/70 text-caramel-300'
      : 'border-caramel-700/60 text-caramel-700';
  return (
    <span
      data-placeholder={label}
      className={`inline-block max-w-full rounded-md border border-dashed px-1.5 py-0.5 font-mono text-[0.8em] leading-tight tracking-tight [overflow-wrap:anywhere] ${toneClass}`}
    >
      {placeholderToken(label)}
    </span>
  );
}

interface EditableTextProps {
  readonly value: Editable<string>;
  readonly tone?: 'light' | 'dark';
}

/** Renders a confirmed string, or its placeholder token. */
export function EditableText({ value, tone }: EditableTextProps) {
  return isPlaceholder(value) ? <PlaceholderToken label={value.label} tone={tone} /> : <>{value}</>;
}

interface ExampleNoteProps {
  readonly label: string;
  readonly note: string;
  readonly tone?: 'light' | 'dark';
}

/** Marks content that is shown from a placeholder's example value. */
export function ExampleNote({ label, note, tone = 'light' }: ExampleNoteProps) {
  return (
    <p className={`mt-3 text-sm ${tone === 'dark' ? 'text-cream-200' : 'text-muted'}`}>
      <PlaceholderToken label={label} tone={tone} /> <span>{note}</span>
    </p>
  );
}
