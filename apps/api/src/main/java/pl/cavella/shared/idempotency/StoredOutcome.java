package pl.cavella.shared.idempotency;

import java.util.UUID;

/** What an earlier request with the same key produced. */
public sealed interface StoredOutcome {

    /** The request committed and produced ledger event {@code eventId}. */
    record Succeeded(UUID eventId) implements StoredOutcome {}

    /** The request was rejected by a business rule; {@code code} is the stable error code. */
    record Rejected(String code) implements StoredOutcome {}
}
