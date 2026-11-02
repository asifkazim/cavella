package pl.cavella.loyalty.domain;

/** The same staff member reused an idempotency key for a different request (ARCHITECTURE §10.1). */
public final class IdempotencyKeyReusedException extends LoyaltyException {

    public IdempotencyKeyReusedException() {
        super(LoyaltyErrorCode.IDEMPOTENCY_KEY_REUSED, "Idempotency key was already used for a different request");
    }
}
