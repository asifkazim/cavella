package pl.cavella.support;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import pl.cavella.card.domain.CardId;
import pl.cavella.staff.StaffPrincipal;

/**
 * Base class for integration tests: full Spring context against PostgreSQL in Docker.
 *
 * <p>Fixtures are written with plain SQL on purpose, so a test of one contract (e.g. redeem)
 * does not depend on another still-unimplemented contract (e.g. card issuance).
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
public abstract class IntegrationTest {

    @Autowired
    protected JdbcTemplate jdbc;

    private static final SecureRandom RANDOM = new SecureRandom();

    @BeforeEach
    void resetDatabase() {
        // TRUNCATE is allowed for the test superuser; the production role is not granted it.
        jdbc.execute("TRUNCATE loyalty_event, idempotency_record, card, staff_user RESTART IDENTITY CASCADE");
        for (StaffPrincipal staff : List.of(Staff.CASHIER_ANNA, Staff.CASHIER_BARTEK, Staff.OWNER_OLA)) {
            jdbc.update(
                    "INSERT INTO staff_user (id, email, display_name, role) VALUES (?, ?, ?, ?)",
                    staff.id().value(),
                    staff.id().value() + "@staff.test",
                    staff.role().name().toLowerCase() + "-" + staff.id().value().toString().substring(34),
                    staff.role().name());
        }
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ---- fixtures -------------------------------------------------------------------------

    /** Inserts an ACTIVE card with the given balance and returns its id. */
    protected CardId givenCard(int stampProgress, int rewardsAvailable) {
        return givenCard(stampProgress, rewardsAvailable, "ACTIVE");
    }

    protected CardId givenCard(int stampProgress, int rewardsAvailable, String status) {
        UUID id = UUID.randomUUID();
        byte[] hash = new byte[32];
        RANDOM.nextBytes(hash);
        jdbc.update(
                "INSERT INTO card (id, token_hash, status, stamp_progress, rewards_available, created_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                id, hash, status, stampProgress, rewardsAvailable, Timestamp.from(Instant.now()));
        return new CardId(id);
    }

    protected void setRewards(CardId card, int rewardsAvailable) {
        jdbc.update("UPDATE card SET rewards_available = ? WHERE id = ?", rewardsAvailable, card.value());
    }

    // ---- observations ---------------------------------------------------------------------

    /** Current projection on the card row: [stamp_progress, rewards_available]. */
    protected int[] projection(CardId card) {
        return jdbc.queryForObject(
                "SELECT stamp_progress, rewards_available FROM card WHERE id = ?",
                (rs, n) -> new int[] {rs.getInt(1), rs.getInt(2)},
                card.value());
    }

    protected int ledgerCount(CardId card) {
        return jdbc.queryForObject("SELECT count(*) FROM loyalty_event WHERE card_id = ?", Integer.class, card.value());
    }

    protected int ledgerCount(CardId card, String type) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM loyalty_event WHERE card_id = ? AND type = ?", Integer.class, card.value(), type);
    }

    protected int idempotencyRecordCount() {
        return jdbc.queryForObject("SELECT count(*) FROM idempotency_record", Integer.class);
    }

    protected List<Map<String, Object>> ledgerRows(CardId card) {
        return jdbc.queryForList("SELECT * FROM loyalty_event WHERE card_id = ? ORDER BY id", card.value());
    }

    /**
     * Re-derives the balance from the ledger alone (what the nightly reconciliation will do,
     * ARCHITECTURE §8.4) given the balance the card started with.
     */
    protected int[] ledgerFold(CardId card, int startProgress, int startRewards) {
        int[] sums = jdbc.queryForObject(
                "SELECT coalesce(sum(stamp_delta), 0), coalesce(sum(reward_delta), 0) FROM loyalty_event WHERE card_id = ?",
                (rs, n) -> new int[] {rs.getInt(1), rs.getInt(2)},
                card.value());
        return new int[] {startProgress + sums[0], startRewards + sums[1]};
    }
}
