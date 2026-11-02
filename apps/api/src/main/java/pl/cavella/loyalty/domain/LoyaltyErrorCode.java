package pl.cavella.loyalty.domain;

/** Stable machine codes; the web layer maps them to RFC 9457 problems (ARCHITECTURE §5.3). */
public enum LoyaltyErrorCode {
    VALIDATION_FAILED(400),
    CARD_NOT_FOUND(404),
    CARD_BLOCKED(409),
    NO_REWARD_AVAILABLE(409),
    QUANTITY_EXCEEDS_CAP(422),
    IDEMPOTENCY_KEY_REUSED(422);

    private final int httpStatus;

    LoyaltyErrorCode(int httpStatus) {
        this.httpStatus = httpStatus;
    }

    public int httpStatus() {
        return httpStatus;
    }
}
