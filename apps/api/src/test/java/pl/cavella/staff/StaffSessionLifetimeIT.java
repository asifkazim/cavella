package pl.cavella.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import pl.cavella.card.domain.CardId;
import pl.cavella.support.ApiIntegrationTest;
import pl.cavella.support.MutableClock;
import pl.cavella.support.Staff;

/**
 * PRD FR-S-02 / T-06 (M1): a staff session ends 12 h after login even when it is used all the
 * time. Spring Session's own timeout only covers inactivity and slides with every request.
 */
class StaffSessionLifetimeIT extends ApiIntegrationTest {

    @TestConfiguration(proxyBeanMethods = false)
    static class ControlledTime {
        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock(Instant.parse("2026-11-02T06:00:00Z"));
        }
    }

    @Autowired
    MutableClock clock;

    private void expectSignedIn(StaffSession session) throws Exception {
        mvc.perform(fromClient(get("/api/v1/staff/me")).cookie(session.cookie())).andExpect(status().isOk());
    }

    @Test
    void anActivelyUsedSessionStillEndsTwelveHoursAfterLogin() throws Exception {
        StaffSession session = login(Staff.CASHIER_ANNA);

        // Busy shift: a request every hour keeps the idle timeout from ever firing.
        for (int hour = 1; hour < 12; hour++) {
            clock.advance(Duration.ofHours(1));
            expectSignedIn(session);
        }
        clock.advance(Duration.ofMinutes(59));
        expectSignedIn(session);

        clock.advance(Duration.ofMinutes(1));
        mvc.perform(fromClient(get("/api/v1/staff/me")).cookie(session.cookie()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        String sessionId = new String(Base64.getDecoder().decode(session.cookie().getValue()));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM spring_session WHERE session_id = ?", Integer.class, sessionId))
                .as("the expired session is destroyed server-side, not just ignored")
                .isZero();
    }

    @Test
    void anExpiredSessionCannotWrite() throws Exception {
        StaffSession session = login(Staff.CASHIER_ANNA);
        CardId card = givenCard(0, 0);
        clock.advance(Duration.ofHours(12));

        mvc.perform(fromClient(session.apply(post("/api/v1/staff/cards/{id}/stamps", card.value())))
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":1}"))
                .andExpect(status().isUnauthorized());
        assertThat(ledgerCount(card)).isZero();
    }

    @Test
    void signingInAgainStartsAFreshShift() throws Exception {
        login(Staff.CASHIER_ANNA);
        clock.advance(Duration.ofHours(12));

        StaffSession next = login(Staff.CASHIER_ANNA);
        clock.advance(Duration.ofHours(11));
        expectSignedIn(next);
    }
}
