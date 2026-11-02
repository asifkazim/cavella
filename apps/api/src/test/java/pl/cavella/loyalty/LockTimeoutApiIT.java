package pl.cavella.loyalty;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import pl.cavella.card.domain.CardId;
import pl.cavella.support.ApiIntegrationTest;
import pl.cavella.support.Staff;

/**
 * ARCHITECTURE §9.3: a lock timeout returns 503 {@code SERVICE_UNAVAILABLE}, which the client
 * retries safely with the same key. The transaction rolls back completely, so the retry runs
 * fresh rather than replaying (§10.1: 5xx and lock timeouts leave no idempotency record).
 *
 * <p>The lock is real: another connection holds {@code SELECT … FOR UPDATE} on the card row
 * until the app's {@code lock_timeout} (3 s) expires.
 */
class LockTimeoutApiIT extends ApiIntegrationTest {

    @Autowired
    DataSource dataSource;

    private StaffSession cashier;
    private Connection blocker;

    @BeforeEach
    void logInCashier() throws Exception {
        cashier = login(Staff.CASHIER_ANNA);
    }

    @AfterEach
    void releaseLock() throws Exception {
        if (blocker != null) {
            blocker.rollback();
            blocker.close();
            blocker = null;
        }
    }

    private void holdCardLock(CardId card) throws Exception {
        blocker = dataSource.getConnection();
        blocker.setAutoCommit(false);
        try (PreparedStatement lock = blocker.prepareStatement("SELECT id FROM card WHERE id = ? FOR UPDATE")) {
            lock.setObject(1, card.value());
            lock.executeQuery().close();
        }
    }

    private ResultActions stamp(CardId card, String key) throws Exception {
        return mvc.perform(fromClient(cashier.apply(post("/api/v1/staff/cards/{id}/stamps", card.value()))
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"quantity\":1}")));
    }

    @Test
    void aLockTimeoutIsARetryable503AndLeavesNothingBehind() throws Exception {
        CardId card = givenCard(2, 0);
        String key = UUID.randomUUID().toString();
        holdCardLock(card);

        stamp(card, key)
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string("Retry-After", "1"))
                .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"))
                .andExpect(jsonPath("$.requestId").exists());

        assertThat(ledgerCount(card)).isZero();
        assertThat(idempotencyRecordCount()).as("the claim rolled back with the rest").isZero();
        assertThat(projection(card)).containsExactly(2, 0);

        releaseLock();
        stamp(card, key)
                .andExpect(status().isCreated())
                .andExpect(header().doesNotExist("Idempotent-Replayed"))
                .andExpect(jsonPath("$.balance.stampProgress").value(3));
        assertThat(ledgerCount(card)).isEqualTo(1);
    }
}
