package pl.cavella.shared.web;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Fixed-window, in-memory rate limiter (ARCHITECTURE §10.2). Acceptable because there is a
 * single API instance and limits are best-effort friction — every correctness guarantee lives
 * in the database. Needs a shared store (Postgres or Cloudflare rules) before scaling out.
 *
 * <p>Memory is bounded (M2):
 * <ul>
 *   <li>Each window stores its own end, so cleanup never expires one early using another
 *       bucket's length.</li>
 *   <li>Cleanup runs only when the map is full, and at most once per {@link #PRUNE_INTERVAL}, so
 *       a full map does not cost a scan on every request.</li>
 *   <li>If the map is still full of active clients, new clients share one overflow window per
 *       bucket: degraded, but neither unlimited nor a lockout of tracked clients.</li>
 * </ul>
 */
@Component
public class RateLimiter {

    /** Upper bound on tracked keys (plus one overflow window per bucket). */
    static final int MAX_TRACKED_KEYS = 50_000;
    static final Duration PRUNE_INTERVAL = Duration.ofSeconds(10);
    static final String OVERFLOW_KEY = "*overflow*";

    private record Window(Instant end, int count) {}

    private final ConcurrentMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicReference<Instant> nextPrune = new AtomicReference<>(Instant.MIN);
    private final Clock clock;
    private final int maxTrackedKeys;

    @Autowired
    public RateLimiter(Clock clock) {
        this(clock, MAX_TRACKED_KEYS);
    }

    RateLimiter(Clock clock, int maxTrackedKeys) {
        this.clock = clock;
        this.maxTrackedKeys = maxTrackedKeys;
    }

    /** Like {@link #check}, keyed by client IP (an IPv6 /64 counts as one client). */
    public void checkClient(String bucket, String clientAddress, int limit, Duration window) {
        check(bucket, ClientAddress.rateLimitKey(clientAddress), limit, window);
    }

    /**
     * Counts one request for {@code bucket}/{@code key}.
     *
     * @throws RateLimitedException when more than {@code limit} requests arrive within {@code window}
     */
    public void check(String bucket, String key, int limit, Duration window) {
        Instant now = clock.instant();
        String id = bucket + '|' + key;
        if (windows.size() >= maxTrackedKeys && !windows.containsKey(id)) {
            pruneExpired(now);
            if (windows.size() >= maxTrackedKeys) {
                id = bucket + '|' + OVERFLOW_KEY;
            }
        }
        Window updated = windows.compute(id, (k, current) ->
                current == null || !now.isBefore(current.end())
                        ? new Window(now.plus(window), 1)
                        : new Window(current.end(), current.count() + 1));
        if (updated.count() > limit) {
            long retryAfter = Math.max(1, Duration.between(now, updated.end()).toSeconds());
            throw new RateLimitedException(retryAfter);
        }
    }

    int trackedKeys() {
        return windows.size();
    }

    /** One thread scans at a time, at most once per interval; the others go on without waiting. */
    private void pruneExpired(Instant now) {
        Instant due = nextPrune.get();
        if (now.isBefore(due) || !nextPrune.compareAndSet(due, now.plus(PRUNE_INTERVAL))) {
            return;
        }
        windows.values().removeIf(w -> !now.isBefore(w.end()));
    }
}
