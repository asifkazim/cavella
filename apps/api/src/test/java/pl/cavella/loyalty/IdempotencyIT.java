package pl.cavella.loyalty;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static pl.cavella.support.SecurityContexts.callAs;
import static pl.cavella.support.Staff.CASHIER_ANNA;
import static pl.cavella.support.Staff.CASHIER_BARTEK;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import pl.cavella.card.domain.CardId;
import pl.cavella.loyalty.application.AddStampsCommand;
import pl.cavella.loyalty.application.LoyaltyService;
import pl.cavella.loyalty.application.RedeemRewardCommand;
import pl.cavella.loyalty.application.RedemptionResult;
import pl.cavella.loyalty.application.StampResult;
import pl.cavella.loyalty.domain.IdempotencyKeyReusedException;
import pl.cavella.loyalty.domain.NoRewardAvailableException;
import pl.cavella.shared.IdempotencyKey;
import pl.cavella.support.IntegrationTest;

/** Rule: duplicate requests with the same idempotency key never create duplicate transactions (BR-06). */
class IdempotencyIT extends IntegrationTest {

    @Autowired
    LoyaltyService loyalty;

    @Test
    void retryingAStampWithTheSameKeyReturnsTheOriginalResultWithoutStampingTwice() throws Exception {
        CardId card = givenCard(0, 0);
        AddStampsCommand command = new AddStampsCommand(card, 1, IdempotencyKey.random());

        StampResult first = callAs(CASHIER_ANNA, () -> loyalty.addStamps(command));
        StampResult retry = callAs(CASHIER_ANNA, () -> loyalty.addStamps(command));

        assertThat(first.replayed()).isFalse();
        assertThat(retry.replayed()).isTrue();
        assertThat(retry.eventId()).isEqualTo(first.eventId());
        assertThat(retry.balance()).isEqualTo(first.balance());
        assertThat(ledgerCount(card)).isEqualTo(1);
        assertThat(projection(card)).containsExactly(1, 0);
    }

    @Test
    void retryingARedemptionWithTheSameKeyDoesNotConsumeASecondReward() throws Exception {
        CardId card = givenCard(0, 2);
        RedeemRewardCommand command = new RedeemRewardCommand(card, IdempotencyKey.random());

        RedemptionResult first = callAs(CASHIER_ANNA, () -> loyalty.redeemReward(command));
        RedemptionResult retry = callAs(CASHIER_ANNA, () -> loyalty.redeemReward(command));

        assertThat(retry.replayed()).isTrue();
        assertThat(retry.eventId()).isEqualTo(first.eventId());
        assertThat(ledgerCount(card, "REDEEM")).isEqualTo(1);
        assertThat(projection(card)).containsExactly(0, 1);
    }

    @Test
    void reusingAKeyForADifferentRequestIsRejected() throws Exception {
        CardId card = givenCard(0, 0);
        IdempotencyKey key = IdempotencyKey.random();
        callAs(CASHIER_ANNA, () -> loyalty.addStamps(new AddStampsCommand(card, 1, key)));

        assertThatThrownBy(() -> callAs(CASHIER_ANNA, () -> loyalty.addStamps(new AddStampsCommand(card, 2, key))))
                .isInstanceOf(IdempotencyKeyReusedException.class);
        assertThatThrownBy(() -> callAs(CASHIER_ANNA, () -> loyalty.redeemReward(new RedeemRewardCommand(card, key))))
                .isInstanceOf(IdempotencyKeyReusedException.class);

        assertThat(ledgerCount(card)).isEqualTo(1);
        assertThat(projection(card)).containsExactly(1, 0);
    }

    @Test
    void keysAreScopedPerStaffMember() throws Exception {
        CardId card = givenCard(0, 0);
        IdempotencyKey sameKey = IdempotencyKey.random();

        StampResult anna = callAs(CASHIER_ANNA, () -> loyalty.addStamps(new AddStampsCommand(card, 1, sameKey)));
        StampResult bartek = callAs(CASHIER_BARTEK, () -> loyalty.addStamps(new AddStampsCommand(card, 1, sameKey)));

        assertThat(bartek.replayed()).isFalse();
        assertThat(bartek.eventId()).isNotEqualTo(anna.eventId());
        assertThat(ledgerCount(card)).isEqualTo(2);
    }

    @Test
    void aRejectedRequestIsReplayedAsTheSameRejection() throws Exception {
        CardId card = givenCard(0, 0);
        RedeemRewardCommand command = new RedeemRewardCommand(card, IdempotencyKey.random());

        assertThatThrownBy(() -> callAs(CASHIER_ANNA, () -> loyalty.redeemReward(command)))
                .isInstanceOf(NoRewardAvailableException.class);

        // Even if a reward appears later, retrying the *same* intent gives the same answer
        // (deterministic replay, ARCHITECTURE §10.1); a new attempt needs a new key.
        setRewards(card, 1);
        assertThatThrownBy(() -> callAs(CASHIER_ANNA, () -> loyalty.redeemReward(command)))
                .isInstanceOf(NoRewardAvailableException.class);

        assertThat(ledgerCount(card)).isZero();
        assertThat(projection(card)).containsExactly(0, 1);
    }
}
