package pl.cavella.loyalty.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import pl.cavella.card.domain.CardId;
import pl.cavella.card.domain.CardStatus;
import pl.cavella.loyalty.application.LedgerEntry;
import pl.cavella.loyalty.domain.Balance;
import pl.cavella.loyalty.domain.LoyaltyEventType;
import pl.cavella.shared.IdempotencyKey;
import pl.cavella.staff.StaffId;

/**
 * Ledger + balance projection (ARCHITECTURE §8.4 option C). The {@code card} row is the
 * projection and the per-card lock; {@code loyalty_event} is the append-only audit truth.
 */
@Repository
public class LoyaltyRepository {

    private final JdbcTemplate jdbc;

    public LoyaltyRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record CardState(CardId id, CardStatus status, Balance balance, Instant lastEventAt) {}

    public record NewEvent(
            UUID publicId,
            CardId cardId,
            LoyaltyEventType type,
            int quantity,
            int stampDelta,
            int rewardDelta,
            Balance after,
            int stampsPerReward,
            StaffId staff,
            IdempotencyKey idempotencyKey,
            Instant createdAt) {}

    private static final String CARD_COLUMNS = "id, status, stamp_progress, rewards_available, last_event_at";

    private static CardState mapCard(ResultSet rs, int n) throws SQLException {
        OffsetDateTime last = rs.getObject("last_event_at", OffsetDateTime.class);
        return new CardState(
                new CardId(rs.getObject("id", UUID.class)),
                CardStatus.valueOf(rs.getString("status")),
                new Balance(rs.getInt("stamp_progress"), rs.getInt("rewards_available")),
                last == null ? null : last.toInstant());
    }

    /**
     * Reads the card and takes a row-level write lock held until the transaction ends. Every
     * command on the same card queues here, so balance checks and updates cannot interleave.
     */
    public Optional<CardState> lockCard(CardId id) {
        return jdbc.query("SELECT " + CARD_COLUMNS + " FROM card WHERE id = ? FOR UPDATE", LoyaltyRepository::mapCard, id.value())
                .stream()
                .findFirst();
    }

    public Optional<CardState> findCard(CardId id) {
        return jdbc.query("SELECT " + CARD_COLUMNS + " FROM card WHERE id = ?", LoyaltyRepository::mapCard, id.value())
                .stream()
                .findFirst();
    }

    public Optional<CardState> findCardByTokenHash(byte[] tokenHash) {
        return jdbc.query("SELECT " + CARD_COLUMNS + " FROM card WHERE token_hash = ?", LoyaltyRepository::mapCard, tokenHash)
                .stream()
                .findFirst();
    }

    public void appendEvent(NewEvent event) {
        jdbc.update("""
                INSERT INTO loyalty_event (public_id, card_id, type, quantity, stamp_delta, reward_delta,
                    stamps_after, rewards_after, stamps_per_reward, staff_user_id, idempotency_key, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                event.publicId(),
                event.cardId().value(),
                event.type().name(),
                event.quantity(),
                event.stampDelta(),
                event.rewardDelta(),
                event.after().stampProgress(),
                event.after().rewardsAvailable(),
                event.stampsPerReward(),
                event.staff().value(),
                event.idempotencyKey().value(),
                OffsetDateTime.ofInstant(event.createdAt(), ZoneOffset.UTC));
    }

    /** Writes the new balance; a PREISSUED card becomes ACTIVE on its first event (ARCHITECTURE §8.1). */
    public void updateProjection(CardId id, Balance balance, int stampsAdded, int redemptionsAdded, Instant at) {
        int updated = jdbc.update("""
                UPDATE card
                   SET stamp_progress = ?,
                       rewards_available = ?,
                       lifetime_stamps = lifetime_stamps + ?,
                       lifetime_redemptions = lifetime_redemptions + ?,
                       last_event_at = ?,
                       status = CASE WHEN status = 'PREISSUED' THEN 'ACTIVE' ELSE status END
                 WHERE id = ?""",
                balance.stampProgress(),
                balance.rewardsAvailable(),
                stampsAdded,
                redemptionsAdded,
                OffsetDateTime.ofInstant(at, ZoneOffset.UTC),
                id.value());
        if (updated != 1) {
            throw new IllegalStateException("Locked card row vanished during the transaction");
        }
    }

    private static LedgerEntry mapEvent(ResultSet rs, int n) throws SQLException {
        return new LedgerEntry(
                rs.getObject("public_id", UUID.class),
                new CardId(rs.getObject("card_id", UUID.class)),
                LoyaltyEventType.valueOf(rs.getString("type")),
                rs.getInt("quantity"),
                rs.getInt("stamp_delta"),
                rs.getInt("reward_delta"),
                rs.getInt("stamps_after"),
                rs.getInt("rewards_after"),
                new StaffId(rs.getObject("staff_user_id", UUID.class)),
                new IdempotencyKey(rs.getObject("idempotency_key", UUID.class)),
                rs.getObject("created_at", OffsetDateTime.class).toInstant());
    }

    private static final String EVENT_COLUMNS = "public_id, card_id, type, quantity, stamp_delta, reward_delta, "
            + "stamps_after, rewards_after, stamps_per_reward, staff_user_id, idempotency_key, created_at";

    public record StoredEvent(LedgerEntry entry, int stampsPerReward) {}

    public StoredEvent getEvent(UUID publicId) {
        return jdbc.queryForObject(
                "SELECT " + EVENT_COLUMNS + " FROM loyalty_event WHERE public_id = ?",
                (rs, n) -> new StoredEvent(mapEvent(rs, n), rs.getInt("stamps_per_reward")),
                publicId);
    }

    /** Oldest first; the identity column gives a total order even for equal timestamps. */
    public List<LedgerEntry> events(CardId card) {
        return jdbc.query(
                "SELECT " + EVENT_COLUMNS + " FROM loyalty_event WHERE card_id = ? ORDER BY id",
                LoyaltyRepository::mapEvent,
                card.value());
    }
}
