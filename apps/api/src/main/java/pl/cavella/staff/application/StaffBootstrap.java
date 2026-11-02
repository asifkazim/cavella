package pl.cavella.staff.application;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pl.cavella.staff.StaffId;
import pl.cavella.staff.StaffRole;
import pl.cavella.staff.persistence.StaffRepository;

/**
 * Creates the first OWNER account from environment variables when no owner exists yet.
 * Nothing is created when the variables are unset; credentials are never hardcoded or logged.
 */
@Component
public class StaffBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(StaffBootstrap.class);
    static final int MIN_PASSWORD_LENGTH = 12;

    private final StaffRepository staff;
    private final PasswordEncoder passwords;
    private final String email;
    private final String password;

    public StaffBootstrap(
            StaffRepository staff,
            PasswordEncoder passwords,
            @Value("${cavella.bootstrap.owner.email:}") String email,
            @Value("${cavella.bootstrap.owner.password:}") String password) {
        this.staff = staff;
        this.passwords = passwords;
        this.email = email;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (email.isBlank() && password.isBlank()) {
            return;
        }
        if (email.isBlank() || password.length() < MIN_PASSWORD_LENGTH) {
            throw new IllegalStateException("Bootstrap owner needs an email and a password of at least "
                    + MIN_PASSWORD_LENGTH + " characters");
        }
        if (staff.ownerExists()) {
            log.info("Owner account already exists; bootstrap credentials ignored. Remove them from the environment.");
            return;
        }
        staff.insert(new StaffId(UUID.randomUUID()), email.trim(), "Owner", StaffRole.OWNER, passwords.encode(password));
        log.info("Bootstrap owner account created. Remove the bootstrap credentials from the environment.");
    }
}
