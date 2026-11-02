package pl.cavella.shared.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class RateLimiterTest {

    /** Clock whose time the test moves forward explicitly. */
    private static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-02T08:00:00Z");

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private final MutableClock clock = new MutableClock();
    private final RateLimiter limiter = new RateLimiter(clock);
    private static final Duration HOUR = Duration.ofHours(1);

    @Test
    void allowsUpToTheLimitThenRejectsWithRetryAfter() {
        for (int i = 0; i < 5; i++) {
            limiter.check("cards", "1.2.3.4", 5, HOUR);
        }
        clock.now = clock.now.plus(Duration.ofMinutes(20));

        assertThatThrownBy(() -> limiter.check("cards", "1.2.3.4", 5, HOUR))
                .isInstanceOfSatisfying(RateLimitedException.class,
                        e -> assertThat(e.retryAfterSeconds()).isEqualTo(Duration.ofMinutes(40).toSeconds()));
    }

    @Test
    void limitsAreSeparatePerKeyAndPerBucket() {
        for (int i = 0; i < 5; i++) {
            limiter.check("cards", "1.2.3.4", 5, HOUR);
        }

        assertThatCode(() -> limiter.check("cards", "5.6.7.8", 5, HOUR)).doesNotThrowAnyException();
        assertThatCode(() -> limiter.check("login", "1.2.3.4", 5, HOUR)).doesNotThrowAnyException();
    }

    @Test
    void theWindowResetsAfterItExpires() {
        for (int i = 0; i < 5; i++) {
            limiter.check("cards", "1.2.3.4", 5, HOUR);
        }
        clock.now = clock.now.plus(HOUR);

        assertThatCode(() -> limiter.check("cards", "1.2.3.4", 5, HOUR)).doesNotThrowAnyException();
    }
}
