package pl.cavella.staff.application;

import java.time.Duration;

/** Failed staff login. Messages are deliberately generic: they never reveal whether an email exists. */
public abstract sealed class StaffAuthenticationException extends RuntimeException {

    protected StaffAuthenticationException(String message) {
        super(message, null, false, false);
    }

    public abstract String code();

    public abstract int httpStatus();

    /** Unknown email, wrong password, inactive account, or no password set. */
    public static final class InvalidCredentials extends StaffAuthenticationException {
        public InvalidCredentials() {
            super("Invalid email or password");
        }

        @Override
        public String code() {
            return "INVALID_CREDENTIALS";
        }

        @Override
        public int httpStatus() {
            return 401;
        }
    }

    /** Too many failed attempts (PRD AC-S-07). */
    public static final class AccountLocked extends StaffAuthenticationException {
        private final Duration retryAfter;

        public AccountLocked(Duration retryAfter) {
            super("Account temporarily locked after too many failed attempts");
            this.retryAfter = retryAfter;
        }

        public Duration retryAfter() {
            return retryAfter;
        }

        @Override
        public String code() {
            return "ACCOUNT_LOCKED";
        }

        @Override
        public int httpStatus() {
            return 423;
        }
    }
}
