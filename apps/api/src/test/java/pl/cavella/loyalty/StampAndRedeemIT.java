package pl.cavella.loyalty;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static pl.cavella.support.SecurityContexts.callAs;
import static pl.cavella.support.Staff.CASHIER_ANNA;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import pl.cavella.card.domain.CardId;
import pl.cavella.loyalty.application.AddStampsCommand;
import pl.cavella.loyalty.application.BalanceView;
import pl.cavella.loyalty.application.LoyaltyService;
import pl.cavella.loyalty.application.RedeemRewardCommand;
import pl.cavella.loyalty.application.RedemptionResult;
import pl.cavella.loyalty.application.StampResult;
import pl.cavella.loyalty.domain.CardBlockedException;
import pl.cavella.loyalty.domain.CardNotFoundException;
import pl.cavella.loyalty.domain.InvalidStampQuantityException;
import pl.cavella.loyalty.domain.NoRewardAvailableException;
import pl.cavella.shared.IdempotencyKey;
import pl.cavella.support.IntegrationTest;

/** End-to-end stamp and reward rules through the service and the real database. */
class StampAndRedeemIT extends IntegrationTest {

    @Autowired
    LoyaltyService loyalty;

    private StampResult stamp(CardId card, int quantity) throws Exception {
        return callAs(CASHIER_ANNA, () -> loyalty.addStamps(new AddStampsCommand(card, quantity, IdempotencyKey.random())));
    }

    private RedemptionResult redeem(CardId card) throws Exception {
        return callAs(CASHIER_ANNA, () -> loyalty.redeemReward(new RedeemRewardCommand(card, IdempotencyKey.random())));
    }

    @Test
    void aStampIsPersistedAndReturnedWithTheNewBalance() throws Exception {
        CardId card = givenCard(0, 0);

        StampResult result = stamp(card, 1);

        assertThat(result.balance()).isEqualTo(new BalanceView(1, 6, 0));
        assertThat(result.rewardsEarned()).isZero();
        assertThat(result.replayed()).isFalse();
        assertThat(projection(card)).containsExactly(1, 0);
        assertThat(ledgerCount(card, "STAMP")).isEqualTo(1);
    }

    @Test
    void sixPaidCoffeesUnlockOneFreeCoffee() throws Exception {
        CardId card = givenCard(0, 0);

        for (int i = 0; i < 5; i++) {
            assertThat(stamp(card, 1).rewardsEarned()).isZero();
        }
        StampResult sixth = stamp(card, 1);

        assertThat(sixth.rewardsEarned()).isEqualTo(1);
        assertThat(sixth.balance()).isEqualTo(new BalanceView(0, 6, 1));
        assertThat(projection(card)).containsExactly(0, 1);
    }

    @Test
    void redeemingConsumesTheRewardExactlyOnce() throws Exception {
        CardId card = givenCard(2, 1);

        RedemptionResult result = redeem(card);

        assertThat(result.balance()).isEqualTo(new BalanceView(2, 6, 0));
        assertThat(projection(card)).containsExactly(2, 0);
        assertThatThrownBy(() -> redeem(card)).isInstanceOf(NoRewardAvailableException.class);
        assertThat(projection(card)).containsExactly(2, 0);
        assertThat(ledgerCount(card, "REDEEM")).isEqualTo(1);
    }

    @Test
    void redeemingWithoutARewardNeverMakesTheBalanceNegative() throws Exception {
        CardId card = givenCard(5, 0);

        assertThatThrownBy(() -> redeem(card)).isInstanceOf(NoRewardAvailableException.class);

        assertThat(projection(card)).containsExactly(5, 0);
        assertThat(ledgerCount(card)).isZero();
    }

    @Test
    void aQuantityAboveTheCapIsRejectedAndNothingIsWritten() throws Exception {
        CardId card = givenCard(1, 0);

        assertThatThrownBy(() -> stamp(card, 4)).isInstanceOf(InvalidStampQuantityException.class);

        assertThat(projection(card)).containsExactly(1, 0);
        assertThat(ledgerCount(card)).isZero();
    }

    @Test
    void anUnknownCardIsRejected() {
        CardId unknown = new CardId(UUID.randomUUID());

        assertThatThrownBy(() -> stamp(unknown, 1)).isInstanceOf(CardNotFoundException.class);
        assertThatThrownBy(() -> redeem(unknown)).isInstanceOf(CardNotFoundException.class);
    }

    @Test
    void aBlockedCardCannotCollectOrRedeem() throws Exception {
        CardId card = givenCard(3, 1, "BLOCKED");

        assertThatThrownBy(() -> stamp(card, 1)).isInstanceOf(CardBlockedException.class);
        assertThatThrownBy(() -> redeem(card)).isInstanceOf(CardBlockedException.class);

        assertThat(projection(card)).containsExactly(3, 1);
        assertThat(ledgerCount(card)).isZero();
    }

    @Test
    void staffCanViewTheBalanceOfAScannedCard() throws Exception {
        CardId card = givenCard(4, 2);

        BalanceView balance = callAs(CASHIER_ANNA, () -> loyalty.balance(card));

        assertThat(balance).isEqualTo(new BalanceView(4, 6, 2));
    }
}
