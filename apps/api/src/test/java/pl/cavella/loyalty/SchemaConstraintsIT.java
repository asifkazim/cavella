package pl.cavella.loyalty;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DataAccessException;
import pl.cavella.card.domain.CardId;
import pl.cavella.support.IntegrationTest;
import pl.cavella.support.Staff;

/**
 * The database enforces the critical invariants on its own, so even a bug in application code
 * (or a manual SQL fix) cannot break them (ARCHITECTURE §4.3). These guard the Flyway schema.
 */
class SchemaConstraintsIT extends IntegrationTest {

    private void insertEvent(CardId card, UUID staff, UUID key) {
        jdbc.update("""
                INSERT INTO loyalty_event (public_id, card_id, type, quantity, stamp_delta, reward_delta,
                    stamps_after, rewards_after, stamps_per_reward, staff_user_id, idempotency_key, created_at)
                VALUES (?, ?, 'STAMP', 1, 1, 0, 1, 0, 6, ?, ?, ?)""",
                UUID.randomUUID(), card.value(), staff, key, Timestamp.from(Instant.now()));
    }

    @Test
    void theDatabaseRejectsANegativeRewardBalance() {
        CardId card = givenCard(0, 0);

        assertThatThrownBy(() -> setRewards(card, -1)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void theLedgerIsAppendOnly() {
        CardId card = givenCard(0, 0);
        insertEvent(card, Staff.CASHIER_ANNA.id().value(), UUID.randomUUID());

        assertThatThrownBy(() -> jdbc.update("UPDATE loyalty_event SET quantity = 3"))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM loyalty_event"))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
        assertThat(ledgerCount(card)).isEqualTo(1);
    }

    @Test
    void oneStaffKeyCanProduceAtMostOneLedgerEntry() {
        CardId card = givenCard(0, 0);
        UUID key = UUID.randomUUID();
        insertEvent(card, Staff.CASHIER_ANNA.id().value(), key);

        assertThatThrownBy(() -> insertEvent(card, Staff.CASHIER_ANNA.id().value(), key))
                .isInstanceOf(DataIntegrityViolationException.class);
        insertEvent(card, Staff.CASHIER_BARTEK.id().value(), key); // other staff, same key: allowed
        assertThat(ledgerCount(card)).isEqualTo(2);
    }

    @Test
    void ledgerEntriesMustBelongToARealStaffMember() {
        CardId card = givenCard(0, 0);

        assertThatThrownBy(() -> insertEvent(card, UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void onlyA32ByteTokenHashCanBeStored() {
        assertThatThrownBy(() -> jdbc.update(
                        "INSERT INTO card (id, token_hash, created_at) VALUES (?, ?, now())",
                        UUID.randomUUID(), "AAECAwQFBgcICQoLDA0ODw".getBytes()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
