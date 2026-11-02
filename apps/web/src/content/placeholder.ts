/**
 * Placeholder convention (PRD §0, AC-REL-01).
 *
 * Any value the owner has not confirmed yet is wrapped in `placeholder(...)`.
 * The label always renders as the literal token `[PLACEHOLDER: <label>]`, so
 * it is visible in review and can be found with `grep -rn "PLACEHOLDER"`.
 *
 * An optional `example` lets features that need a value to work (for example
 * the open-now indicator, or the Directions link) keep working during
 * development. The UI still marks such values as placeholders.
 */
export interface Placeholder<T = never> {
  readonly kind: 'placeholder';
  readonly label: string;
  readonly example?: T;
}

/** A value that is either confirmed (`T`) or still a placeholder. */
export type Editable<T> = T | Placeholder<T>;

export function placeholder<T = never>(label: string, example?: T): Placeholder<T> {
  return example === undefined ? { kind: 'placeholder', label } : { kind: 'placeholder', label, example };
}

export function isPlaceholder<T>(value: Editable<T>): value is Placeholder<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'placeholder'
  );
}

/** Confirmed value, or the placeholder's example, or `undefined`. */
export function resolveEditable<T>(value: Editable<T>): T | undefined {
  return isPlaceholder(value) ? value.example : value;
}

export function placeholderToken(label: string): string {
  return `[PLACEHOLDER: ${label}]`;
}
