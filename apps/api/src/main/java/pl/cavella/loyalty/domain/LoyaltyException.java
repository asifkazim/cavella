package pl.cavella.loyalty.domain;

import java.util.Objects;

/**
 * Business-rule rejection. Thrown inside the command transaction, it rolls everything back
 * except the idempotency record that remembers the rejection (ARCHITECTURE §10.1).
 */
public abstract sealed class LoyaltyException extends RuntimeException
        permits CardBlockedException,
                CardNotFoundException,
                IdempotencyKeyReusedException,
                InvalidStampQuantityException,
                NoRewardAvailableException {

    private final LoyaltyErrorCode code;

    protected LoyaltyException(LoyaltyErrorCode code, String message) {
        super(message);
        this.code = Objects.requireNonNull(code, "code");
    }

    public LoyaltyErrorCode code() {
        return code;
    }
}
