package pl.cavella.shared;

import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Client-generated key for one staff "confirm" intent (ARCHITECTURE §10.1, PRD BR-06).
 * Scoped per staff user: the same key from two different staff members is two intents.
 *
 * <p>Contract: {@code value} is non-null; {@link #parse(String)} accepts only a canonical UUID
 * and throws {@link IllegalArgumentException} otherwise.
 */
public record IdempotencyKey(UUID value) {

    /** {@link UUID#fromString} is lenient (accepts "1-1-1-1-1"); require the canonical 8-4-4-4-12 form. */
    private static final Pattern CANONICAL =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    public IdempotencyKey {
        Objects.requireNonNull(value, "value");
    }

    public static IdempotencyKey parse(String raw) {
        if (raw == null || !CANONICAL.matcher(raw).matches()) {
            throw new IllegalArgumentException("Idempotency key must be a UUID");
        }
        return new IdempotencyKey(UUID.fromString(raw));
    }

    public static IdempotencyKey random() {
        return new IdempotencyKey(UUID.randomUUID());
    }
}
