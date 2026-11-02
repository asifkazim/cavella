package pl.cavella.loyalty.domain;

/**
 * Loyalty programme parameters (PRD BR-02, FR-S-06).
 *
 * <p>Contract: {@code stampsPerReward ≥ 1} and {@code 1 ≤ maxStampsPerTransaction ≤ 10}
 * (the database bounds {@code quantity} to 1–10); otherwise {@link IllegalArgumentException}.
 */
public record LoyaltyRules(int stampsPerReward, int maxStampsPerTransaction) {

    /** Database bound on {@code loyalty_event.quantity}. */
    public static final int MAX_QUANTITY_BOUND = 10;

    /** Six paid coffees unlock one free coffee; at most 3 stamps per purchase ([PLACEHOLDER] cap, PRD FR-S-06). */
    public static final LoyaltyRules DEFAULT = new LoyaltyRules(6, 3);

    public LoyaltyRules {
        if (stampsPerReward < 1) {
            throw new IllegalArgumentException("stampsPerReward must be at least 1, was " + stampsPerReward);
        }
        if (maxStampsPerTransaction < 1 || maxStampsPerTransaction > MAX_QUANTITY_BOUND) {
            throw new IllegalArgumentException(
                    "maxStampsPerTransaction must be between 1 and " + MAX_QUANTITY_BOUND + ", was " + maxStampsPerTransaction);
        }
    }

    /**
     * Validates a stamp quantity independently of any card state, so a bad request can be
     * rejected before the transaction touches the database.
     */
    public void checkQuantity(int quantity) {
        if (quantity < 1) {
            throw InvalidStampQuantityException.notPositive(quantity);
        }
        if (quantity > maxStampsPerTransaction) {
            throw InvalidStampQuantityException.aboveCap(quantity, maxStampsPerTransaction);
        }
    }
}
