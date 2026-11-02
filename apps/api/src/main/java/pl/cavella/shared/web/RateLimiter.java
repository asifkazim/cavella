package pl.cavella.shared.web;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.stereotype.Component;

/**
 * Fixed-window, in-memory rate limiter (ARCHITECTURE §10.2). Acceptable because there is a
 * single API instance and limits are best-effort friction — every correctness guarantee lives
 * in the database. Needs a shared store (Postgres or Cloudflare rules) before scaling out.
 */
@Component
public class RateLimiter {

    /** Upper bound on tracked keys; expired windows are pruned when it is reached. */
    static final int MAX_TRACKED_KEYS = 50_000;

    private record Window(Instant start, int count) {}

    private final ConcurrentMap<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public RateLimiter(Clock clock) {
        this.clock = clock;
    }

    /**
     * Counts one request for {@code bucket}/{@code key}.
     *
     * @throws RateLimitedException when more than {@code limit} requests arrive within {@code window}
     */
    public void check(String bucket, String key, int limit, Duration window) {
        Instant now = clock.instant();
        if (windows.size() >= MAX_TRACKED_KEYS) {
            windows.values().removeIf(w -> !w.start().plus(window).isAfter(now));
        }
        Window updated = windows.compute(bucket + '|' + key, (k, current) ->
                current == null || !current.start().plus(window).isAfter(now)
                        ? new Window(now, 1)
                        : new Window(current.start(), current.count() + 1));
        if (updated.count() > limit) {
            long retryAfter = Math.max(1, Duration.between(now, updated.start().plus(window)).toSeconds());
            throw new RateLimitedException(retryAfter);
        }
    }
}
