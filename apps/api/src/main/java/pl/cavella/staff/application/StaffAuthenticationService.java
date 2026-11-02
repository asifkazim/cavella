package pl.cavella.staff.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.cavella.staff.StaffPrincipal;
import pl.cavella.staff.persistence.StaffRepository;
import pl.cavella.staff.persistence.StaffRepository.LoginRow;

/**
 * Verifies staff credentials (ARCHITECTURE §7). Lockout: 5 failures → locked for 15 minutes
 * (PRD AC-S-07). The failure counter commits even though the login fails, hence
 * {@code noRollbackFor}.
 */
@Service
public class StaffAuthenticationService {

    static final int MAX_FAILED_ATTEMPTS = 5;
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private final StaffRepository staff;
    private final PasswordEncoder passwords;
    private final Clock clock;
    /** Compared against when the email is unknown, so response time does not reveal which emails exist. */
    private final String dummyHash;

    public StaffAuthenticationService(StaffRepository staff, PasswordEncoder passwords, Clock clock) {
        this.staff = staff;
        this.passwords = passwords;
        this.clock = clock;
        this.dummyHash = passwords.encode("timing-equaliser-not-a-real-password");
    }

    @Transactional(noRollbackFor = StaffAuthenticationException.class)
    public StaffPrincipal login(String email, String rawPassword) {
        Instant now = clock.instant();
        Optional<LoginRow> found = staff.findForLogin(email);
        if (found.isEmpty()) {
            passwords.matches(rawPassword, dummyHash);
            throw new StaffAuthenticationException.InvalidCredentials();
        }
        LoginRow account = found.get();
        if (account.lockedUntil() != null && account.lockedUntil().isAfter(now)) {
            throw new StaffAuthenticationException.AccountLocked(Duration.between(now, account.lockedUntil()));
        }
        String hash = account.passwordHash() != null ? account.passwordHash() : dummyHash;
        boolean valid = passwords.matches(rawPassword, hash) && account.passwordHash() != null && account.active();
        if (!valid) {
            staff.recordFailedLogin(account.id(), MAX_FAILED_ATTEMPTS, now.plus(LOCK_DURATION));
            throw new StaffAuthenticationException.InvalidCredentials();
        }
        staff.recordSuccessfulLogin(account.id());
        if (passwords.upgradeEncoding(account.passwordHash())) {
            staff.updatePasswordHash(account.id(), passwords.encode(rawPassword));
        }
        return new StaffPrincipal(account.id(), account.role());
    }
}
