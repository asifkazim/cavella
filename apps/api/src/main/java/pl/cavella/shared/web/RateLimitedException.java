package pl.cavella.shared.web;

/** Too many requests; {@code retryAfterSeconds} becomes the Retry-After header. */
public class RateLimitedException extends RuntimeException {

    private final long retryAfterSeconds;

    public RateLimitedException(long retryAfterSeconds) {
        super("Too many requests", null, false, false);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
