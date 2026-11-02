package pl.cavella.loyalty.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Stamp and reward rules (PRD BR-02, BR-04, BR-05; ARCHITECTURE §8.2). */
class BalanceTest {

    private static final LoyaltyRules RULES = LoyaltyRules.DEFAULT; // 6 stamps → 1 reward, cap 3

    @Nested
    @DisplayName("collecting stamps")
    class Stamps {

        @Test
        void aNewCardStartsWithNoStampsAndNoRewards() {
            assertThat(Balance.ZERO).isEqualTo(new Balance(0, 0));
        }

        @Test
        void eachPaidCoffeeAddsOneStamp() {
            StampOutcome outcome = Balance.ZERO.addStamps(1, RULES);

            assertThat(outcome.balance()).isEqualTo(new Balance(1, 0));
            assertThat(outcome.rewardsEarned()).isZero();
        }

        @Test
        void fiveStampsDoNotUnlockAReward() {
            Balance balance = Balance.ZERO;
            for (int i = 0; i < 5; i++) {
                balance = balance.addStamps(1, RULES).balance();
            }

            assertThat(balance).isEqualTo(new Balance(5, 0));
        }

        @Test
        void theSixthStampUnlocksOneFreeCoffeeAndResetsProgress() {
            StampOutcome outcome = new Balance(5, 0).addStamps(1, RULES);

            assertThat(outcome.balance()).isEqualTo(new Balance(0, 1));
            assertThat(outcome.rewardsEarned()).isEqualTo(1);
        }

        @Test
        void stampsBeyondTheThresholdCarryOverToTheNextReward() {
            StampOutcome outcome = new Balance(5, 0).addStamps(3, RULES);

            assertThat(outcome.balance()).isEqualTo(new Balance(2, 1));
            assertThat(outcome.rewardsEarned()).isEqualTo(1);
        }

        @Test
        void unredeemedRewardsAccumulate() {
            StampOutcome outcome = new Balance(5, 1).addStamps(1, RULES);

            assertThat(outcome.balance()).isEqualTo(new Balance(0, 2));
        }

        @ParameterizedTest(name = "{0} single stamps → progress {0} mod 6, rewards {0} div 6")
        @ValueSource(ints = {0, 1, 5, 6, 7, 11, 12, 13, 36})
        void progressAndRewardsFollowStampCount(int stamps) {
            Balance balance = Balance.ZERO;
            for (int i = 0; i < stamps; i++) {
                balance = balance.addStamps(1, RULES).balance();
            }

            assertThat(balance).isEqualTo(new Balance(stamps % 6, stamps / 6));
        }

        @Test
        void acceptsTheMaximumQuantityPerTransaction() {
            assertThat(Balance.ZERO.addStamps(3, RULES).balance()).isEqualTo(new Balance(3, 0));
        }

        @ParameterizedTest
        @ValueSource(ints = {0, -1, Integer.MIN_VALUE})
        void rejectsNonPositiveQuantities(int quantity) {
            assertThatThrownBy(() -> Balance.ZERO.addStamps(quantity, RULES))
                    .isInstanceOf(InvalidStampQuantityException.class)
                    .extracting(e -> ((LoyaltyException) e).code())
                    .isEqualTo(LoyaltyErrorCode.VALIDATION_FAILED);
        }

        @ParameterizedTest
        @ValueSource(ints = {4, 10, Integer.MAX_VALUE})
        void rejectsQuantitiesAboveThePerTransactionCap(int quantity) {
            assertThatThrownBy(() -> Balance.ZERO.addStamps(quantity, RULES))
                    .isInstanceOf(InvalidStampQuantityException.class)
                    .extracting(e -> ((LoyaltyException) e).code())
                    .isEqualTo(LoyaltyErrorCode.QUANTITY_EXCEEDS_CAP);
        }
    }

    @Nested
    @DisplayName("redeeming rewards")
    class Redemption {

        @Test
        void redeemingConsumesExactlyOneReward() {
            assertThat(new Balance(2, 2).redeem()).isEqualTo(new Balance(2, 1));
        }

        @Test
        void redemptionDoesNotChangeStampProgress() {
            assertThat(new Balance(4, 1).redeem()).isEqualTo(new Balance(4, 0));
        }

        @Test
        void aRewardCanBeRedeemedOnlyOnce() {
            Balance afterFirst = new Balance(0, 1).redeem();

            assertThatThrownBy(afterFirst::redeem).isInstanceOf(NoRewardAvailableException.class);
        }

        @Test
        void redeemingWithoutARewardIsRejectedAndLeavesTheBalanceUnchanged() {
            Balance balance = new Balance(3, 0);

            assertThatThrownBy(balance::redeem)
                    .isInstanceOf(NoRewardAvailableException.class)
                    .extracting(e -> ((LoyaltyException) e).code())
                    .isEqualTo(LoyaltyErrorCode.NO_REWARD_AVAILABLE);
            assertThat(balance).isEqualTo(new Balance(3, 0));
        }
    }

    @Nested
    @DisplayName("invariants")
    class Invariants {

        @Test
        void rewardsCannotBeNegative() {
            assertThatThrownBy(() -> new Balance(0, -1)).isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void stampProgressCannotBeNegative() {
            assertThatThrownBy(() -> new Balance(-1, 0)).isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void addingStampsRejectsProgressThatAlreadyBreaksTheRules() {
            // Progress 6 is impossible under "6 stamps per reward": corrupt input must not be carried forward.
            assertThatThrownBy(() -> new Balance(6, 0).addStamps(1, RULES))
                    .isInstanceOf(IllegalStateException.class);
        }
    }
}
