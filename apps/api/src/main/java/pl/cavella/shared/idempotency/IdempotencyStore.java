package pl.cavella.shared.idempotency;

import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import pl.cavella.shared.IdempotencyKey;

/**
 * Idempotency records (ARCHITECTURE §10.1). Must be called inside the command's transaction:
 * the record commits or rolls back together with the work it protects.
 */
@Repository
public class IdempotencyStore {

    /** HTTP status stored for a successful command (201 Created). */
    private static final int SUCCESS_STATUS = 201;

    private final JdbcTemplate jdbc;

    public IdempotencyStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Raised when a key is reused for a different request. */
    public static final class FingerprintMismatch extends RuntimeException {
        FingerprintMismatch() {
            super("Idempotency key reused with a different request", null, false, false);
        }
    }

    /**
     * Claims {@code (owner, key)} — the owner is the acting staff member — for this transaction.
     *
     * <p>Returns empty when the key is new: the caller owns it and must record an outcome before
     * committing. Returns the stored outcome when the key was already used for the same request.
     *
     * <p>Concurrency: {@code INSERT … ON CONFLICT DO NOTHING} on the primary key makes a
     * concurrent duplicate <em>wait</em> until the first transaction commits or rolls back.
     * After a commit it sees the row (READ COMMITTED takes a fresh snapshot per statement) and
     * replays; after a rollback its own insert succeeds and it executes the command itself.
     *
     * @throws FingerprintMismatch if the key was used for a different request
     */
    public Optional<StoredOutcome> claim(UUID owner, IdempotencyKey key, RequestFingerprint fingerprint) {
        int inserted = jdbc.update(
                "INSERT INTO idempotency_record (staff_user_id, idem_key, request_hash) VALUES (?, ?, ?) "
                        + "ON CONFLICT DO NOTHING",
                owner, key.value(), fingerprint.sha256());
        if (inserted == 1) {
            return Optional.empty();
        }
        return Optional.of(jdbc.queryForObject(
                "SELECT request_hash, response_status, response_body ->> 'eventId', response_body ->> 'code' "
                        + "FROM idempotency_record WHERE staff_user_id = ? AND idem_key = ?",
                (rs, n) -> {
                    if (!fingerprint.matches(rs.getBytes(1))) {
                        throw new FingerprintMismatch();
                    }
                    if (rs.getObject(2) == null) {
                        // Outcomes are written in the same transaction as the claim, so a committed
                        // record without one means a bug, not a race.
                        throw new IllegalStateException("Idempotency record has no stored outcome");
                    }
                    String eventId = rs.getString(3);
                    return eventId != null
                            ? new StoredOutcome.Succeeded(UUID.fromString(eventId))
                            : new StoredOutcome.Rejected(rs.getString(4));
                },
                owner, key.value()));
    }

    public void recordSuccess(UUID owner, IdempotencyKey key, UUID eventId) {
        jdbc.update(
                "UPDATE idempotency_record SET response_status = ?, response_body = jsonb_build_object('eventId', CAST(? AS text)) "
                        + "WHERE staff_user_id = ? AND idem_key = ?",
                SUCCESS_STATUS, eventId.toString(), owner, key.value());
    }

    public void recordRejection(UUID owner, IdempotencyKey key, String code, int httpStatus) {
        jdbc.update(
                "UPDATE idempotency_record SET response_status = ?, response_body = jsonb_build_object('code', CAST(? AS text)) "
                        + "WHERE staff_user_id = ? AND idem_key = ?",
                httpStatus, code, owner, key.value());
    }
}
