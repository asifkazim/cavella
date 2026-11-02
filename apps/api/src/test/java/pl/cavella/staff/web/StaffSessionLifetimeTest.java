package pl.cavella.staff.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import pl.cavella.support.MutableClock;

/** PRD FR-S-02: a staff session lasts one shift from login, however actively it is used. */
class StaffSessionLifetimeTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-02T06:00:00Z"));
    private final StaffSessionLifetime lifetime =
            new StaffSessionLifetime(clock, Duration.ofHours(12), Duration.ofHours(12), Duration.ofMinutes(10));
    private final MockHttpSession session = new MockHttpSession();

    @Test
    void aPreLoginSessionGetsTheShortTimeoutAndLoginRestoresTheShiftTimeout() {
        lifetime.limitIfAnonymous(session);
        assertThat(session.getMaxInactiveInterval()).isEqualTo(10 * 60);

        lifetime.start(session);
        assertThat(session.getMaxInactiveInterval()).isEqualTo(12 * 60 * 60);

        lifetime.limitIfAnonymous(session); // a signed-in session fetching a fresh CSRF token
        assertThat(session.getMaxInactiveInterval()).isEqualTo(12 * 60 * 60);
    }

    @Test
    void aSessionIsValidUntilTwelveHoursAfterLogin() {
        lifetime.start(session);

        clock.advance(Duration.ofHours(12).minusSeconds(1));
        assertThat(lifetime.isExpired(session)).isFalse();

        clock.advance(Duration.ofSeconds(1));
        assertThat(lifetime.isExpired(session)).isTrue();
    }

    @Test
    void aStaffSessionWithoutALoginTimeIsTreatedAsExpired() {
        // E.g. a session created before this rule was deployed: fail closed.
        assertThat(lifetime.isExpired(session)).isTrue();
    }

    @Test
    void loggingInAgainStartsANewShift() {
        lifetime.start(session);
        clock.advance(Duration.ofHours(11));
        lifetime.start(session);

        clock.advance(Duration.ofHours(11));
        assertThat(lifetime.isExpired(session)).isFalse();
    }
}
