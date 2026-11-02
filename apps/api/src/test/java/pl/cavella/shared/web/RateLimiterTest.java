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

    // ---- M2 ------------------------------------------------------------------------------

    @Test
    void cleanupNeverResetsAWindowEarlyUsingAnotherBucketsLength() {
        RateLimiter small = new RateLimiter(clock, 2);
        small.check("card-create", "1.2.3.4", 1, HOUR); // hourly limit used up
        small.check("card-read", "5.6.7.8", 60, Duration.ofMinutes(1));
        clock.now = clock.now.plus(Duration.ofMinutes(2));

        small.check("card-read", "9.9.9.9", 60, Duration.ofMinutes(1)); // map full → cleanup

        assertThatThrownBy(() -> small.check("card-create", "1.2.3.4", 1, HOUR))
                .as("58 minutes of the hourly window are left")
                .isInstanceOf(RateLimitedException.class);
    }

    @Test
    void whenFullOfActiveClientsNewClientsShareAnOverflowWindowAndMemoryStaysBounded() {
        RateLimiter small = new RateLimiter(clock, 3);
        for (String ip : new String[] {"10.0.0.1", "10.0.0.2", "10.0.0.3"}) {
            small.check("card-create", ip, 2, HOUR);
        }

        small.check("card-create", "10.0.0.4", 2, HOUR);
        small.check("card-create", "10.0.0.5", 2, HOUR);
        assertThatThrownBy(() -> small.check("card-create", "10.0.0.6", 2, HOUR))
                .isInstanceOf(RateLimitedException.class);
        assertThat(small.trackedKeys()).isLessThanOrEqualTo(3 + 1);

        // Clients already tracked keep their own window.
        assertThatCode(() -> small.check("card-create", "10.0.0.1", 2, HOUR)).doesNotThrowAnyException();
    }

    @Test
    void expiredWindowsAreReclaimedOnceTheMapIsFull() {
        RateLimiter small = new RateLimiter(clock, 2);
        small.check("card-read", "10.0.0.1", 1, Duration.ofMinutes(1));
        small.check("card-read", "10.0.0.2", 1, Duration.ofMinutes(1));
        clock.now = clock.now.plus(Duration.ofMinutes(1));

        small.check("card-read", "10.0.0.3", 1, Duration.ofMinutes(1));
        assertThatCode(() -> small.check("card-read", "10.0.0.4", 1, Duration.ofMinutes(1)))
                .as("a new client gets its own window, not the overflow one")
                .doesNotThrowAnyException();
        assertThat(small.trackedKeys()).isEqualTo(2);
    }

    @Test
    void ipv6ClientsCannotDodgeTheLimitByRotatingAddressesInTheirSlash64() {
        for (int i = 1; i <= 5; i++) {
            limiter.checkClient("card-create", "2001:db8:aa:bb::" + Integer.toHexString(i), 5, HOUR);
        }

        assertThatThrownBy(() -> limiter.checkClient("card-create", "2001:db8:aa:bb:ffff:1:2:3", 5, HOUR))
                .isInstanceOf(RateLimitedException.class);
        assertThatCode(() -> limiter.checkClient("card-create", "2001:db8:aa:cc::1", 5, HOUR))
                .as("another /64 is another client")
                .doesNotThrowAnyException();
    }
}
