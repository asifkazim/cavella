package pl.cavella.staff.web;

import jakarta.servlet.http.HttpSession;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Absolute lifetime of a staff session (PRD FR-S-02, T-06): one shift from login, however
 * actively the session is used. Spring Session's timeout only covers inactivity and slides
 * with every request, so on its own a daily-used session would never end.
 *
 * <p>Measured from login, not from session creation: the session starts earlier, anonymously,
 * when the client fetches its first CSRF token.
 */
@Component
public class StaffSessionLifetime {

    static final String AUTHENTICATED_AT = StaffSessionLifetime.class.getName() + ".authenticatedAt";

    private final Clock clock;
    private final Duration maxLifetime;
    private final Duration staffIdleTimeout;
    private final Duration anonymousIdleTimeout;

    public StaffSessionLifetime(
            Clock clock,
            @Value("${cavella.session.max-lifetime:12h}") Duration maxLifetime,
            @Value("${spring.session.timeout:12h}") Duration staffIdleTimeout,
            @Value("${cavella.session.anonymous-timeout:10m}") Duration anonymousIdleTimeout) {
        this.clock = clock;
        this.maxLifetime = maxLifetime;
        this.staffIdleTimeout = staffIdleTimeout;
        this.anonymousIdleTimeout = anonymousIdleTimeout;
    }

    /**
     * Records the login time and restores the staff idle timeout; call once authentication has
     * succeeded. Login keeps the session object (only its id changes), so the short anonymous
     * timeout would otherwise carry over.
     */
    public void start(HttpSession session) {
        session.setAttribute(AUTHENTICATED_AT, clock.instant());
        session.setMaxInactiveInterval(Math.toIntExact(staffIdleTimeout.toSeconds()));
    }

    /**
     * A session that only holds a CSRF token before login (L2): anyone can create one, so it
     * must not occupy a session row for a whole shift. Signed-in sessions are left unchanged.
     */
    public void limitIfAnonymous(HttpSession session) {
        if (session.getAttribute(AUTHENTICATED_AT) == null) {
            session.setMaxInactiveInterval(Math.toIntExact(anonymousIdleTimeout.toSeconds()));
        }
    }

    /** True once the shift is over, or when no login time was recorded (fail closed). */
    public boolean isExpired(HttpSession session) {
        return !(session.getAttribute(AUTHENTICATED_AT) instanceof Instant loggedInAt)
                || !clock.instant().isBefore(loggedInAt.plus(maxLifetime));
    }
}
