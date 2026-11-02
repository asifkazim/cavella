package pl.cavella.loyalty.domain;

/**
 * A card's loyalty balance: stamps toward the next reward and unredeemed rewards
 * (ARCHITECTURE §8.2). Immutable; every operation returns a new value.
 *
 * <p>Invariants (constructor throws {@link IllegalArgumentException} when violated):
 * {@code stampProgress ≥ 0} and {@code rewardsAvailable ≥ 0}. The upper bound
 * {@code stampProgress < stampsPerReward} depends on the rules and is enforced by
 * {@link #addStamps}.
 *
 * <p>Transitions:
 * <ul>
 *   <li>{@code addStamps(q)}: {@code t = progress + q; rewards += t / N; progress = t % N}.
 *       Rejects {@code q < 1} ({@link InvalidStampQuantityException}, VALIDATION_FAILED) and
 *       {@code q > maxStampsPerTransaction} (QUANTITY_EXCEEDS_CAP).</li>
 *   <li>{@code redeem()}: {@code rewards - 1}; throws {@link NoRewardAvailableException} at zero,
 *       so a balance can never go negative (BR-05).</li>
 * </ul>
 */
public record Balance(int stampProgress, int rewardsAvailable) {

    public static final Balance ZERO = new Balance(0, 0);

    public Balance {
        if (stampProgress < 0) {
            throw new IllegalArgumentException("stampProgress cannot be negative, was " + stampProgress);
        }
        if (rewardsAvailable < 0) {
            throw new IllegalArgumentException("rewardsAvailable cannot be negative, was " + rewardsAvailable);
        }
    }

    public StampOutcome addStamps(int quantity, LoyaltyRules rules) {
        rules.checkQuantity(quantity);
        int perReward = rules.stampsPerReward();
        if (stampProgress >= perReward) {
            // Only reachable with corrupt data or a rule change not yet normalised (ARCHITECTURE §8.2).
            throw new IllegalStateException(
                    "stampProgress " + stampProgress + " is not valid for " + perReward + " stamps per reward");
        }
        int total = stampProgress + quantity;
        int earned = total / perReward;
        return new StampOutcome(new Balance(total % perReward, Math.addExact(rewardsAvailable, earned)), earned);
    }

    public Balance redeem() {
        if (rewardsAvailable == 0) {
            throw new NoRewardAvailableException();
        }
        return new Balance(stampProgress, rewardsAvailable - 1);
    }
}
