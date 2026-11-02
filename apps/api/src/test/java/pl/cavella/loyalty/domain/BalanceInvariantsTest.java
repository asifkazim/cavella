package pl.cavella.loyalty.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.util.Random;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Property-style check: for any random sequence of valid and invalid commands the balance stays
 * valid and no stamp is ever created or lost. Seeds are fixed so failures are reproducible.
 */
class BalanceInvariantsTest {

    private static final LoyaltyRules RULES = LoyaltyRules.DEFAULT;

    @ParameterizedTest(name = "seed {0}")
    @ValueSource(longs = {1, 7, 42, 2026, 31337})
    void randomCommandSequencesPreserveInvariantsAndConserveStamps(long seed) {
        Random random = new Random(seed);
        Balance balance = Balance.ZERO;
        int totalStamps = 0;
        int redeemed = 0;

        for (int step = 0; step < 2_000; step++) {
            if (random.nextInt(3) == 0) {
                Balance before = balance;
                Throwable error = catchThrowable(before::redeem);
                if (error == null) {
                    balance = before.redeem();
                    redeemed++;
                } else {
                    assertThat(error).isInstanceOf(NoRewardAvailableException.class);
                    assertThat(before.rewardsAvailable()).isZero();
                }
            } else {
                int quantity = random.nextInt(6) - 1; // -1..4: includes invalid quantities
                Balance before = balance;
                Throwable error = catchThrowable(() -> before.addStamps(quantity, RULES));
                if (quantity >= 1 && quantity <= RULES.maxStampsPerTransaction()) {
                    assertThat(error).as("valid quantity %d", quantity).isNull();
                    balance = before.addStamps(quantity, RULES).balance();
                    totalStamps += quantity;
                } else {
                    assertThat(error).isInstanceOf(InvalidStampQuantityException.class);
                }
            }

            assertThat(balance.rewardsAvailable()).isGreaterThanOrEqualTo(0);
            assertThat(balance.stampProgress()).isBetween(0, RULES.stampsPerReward() - 1);
            assertThat(balance.stampProgress()
                            + RULES.stampsPerReward() * (balance.rewardsAvailable() + redeemed))
                    .as("every stamp is accounted for")
                    .isEqualTo(totalStamps);
        }
    }
}
