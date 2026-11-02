package pl.cavella.loyalty;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static pl.cavella.support.SecurityContexts.callAs;
import static pl.cavella.support.Staff.CASHIER_ANNA;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import pl.cavella.card.domain.CardId;
import pl.cavella.loyalty.application.AddStampsCommand;
import pl.cavella.loyalty.application.LoyaltyService;
import pl.cavella.loyalty.application.RedeemRewardCommand;
import pl.cavella.loyalty.application.RedemptionResult;
import pl.cavella.loyalty.application.StampResult;
import pl.cavella.shared.IdempotencyKey;
import pl.cavella.support.IntegrationTest;

/**
 * Rule: failed transactions must not partially commit.
 *
 * <p>Fault injection is black-box: a temporary trigger makes the card-projection UPDATE fail
 * for one card. Whatever order the implementation uses, the ledger insert and the idempotency
 * record must roll back together with it, and a retry with the same key must then succeed.
 */
class AtomicityIT extends IntegrationTest {

    @Autowired
    LoyaltyService loyalty;

    private void failProjectionUpdatesFor(CardId card) {
        jdbc.execute("""
                CREATE OR REPLACE FUNCTION test_fail_card_update() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    IF NEW.id = '%s'::uuid THEN
                        RAISE EXCEPTION 'injected failure after earlier writes in the same transaction';
                    END IF;
                    RETURN NEW;
                END;
                $$""".formatted(card.value()));
        jdbc.execute("""
                CREATE TRIGGER test_fail_card_update BEFORE UPDATE ON card
                FOR EACH ROW EXECUTE FUNCTION test_fail_card_update()""");
    }

    private void stopFailing() {
        jdbc.execute("DROP TRIGGER IF EXISTS test_fail_card_update ON card");
        jdbc.execute("DROP FUNCTION IF EXISTS test_fail_card_update()");
    }

    @AfterEach
    void removeFaultInjection() {
        stopFailing();
    }

    @Test
    void aFailedStampLeavesNoTraceAndCanBeRetriedWithTheSameKey() throws Exception {
        CardId card = givenCard(5, 0);
        AddStampsCommand command = new AddStampsCommand(card, 1, IdempotencyKey.random());
        failProjectionUpdatesFor(card);

        assertThatThrownBy(() -> callAs(CASHIER_ANNA, () -> loyalty.addStamps(command)))
                .isInstanceOf(DataAccessException.class);

        assertThat(ledgerCount(card)).isZero();
        assertThat(idempotencyRecordCount()).isZero();
        assertThat(projection(card)).containsExactly(5, 0);

        stopFailing();
        StampResult retry = callAs(CASHIER_ANNA, () -> loyalty.addStamps(command));

        assertThat(retry.replayed()).as("nothing was remembered from the failed attempt").isFalse();
        assertThat(retry.rewardsEarned()).isEqualTo(1);
        assertThat(ledgerCount(card)).isEqualTo(1);
        assertThat(projection(card)).containsExactly(0, 1);
    }

    @Test
    void aFailedRedemptionKeepsTheReward() throws Exception {
        CardId card = givenCard(0, 1);
        RedeemRewardCommand command = new RedeemRewardCommand(card, IdempotencyKey.random());
        failProjectionUpdatesFor(card);

        assertThatThrownBy(() -> callAs(CASHIER_ANNA, () -> loyalty.redeemReward(command)))
                .isInstanceOf(DataAccessException.class);

        assertThat(ledgerCount(card)).isZero();
        assertThat(idempotencyRecordCount()).isZero();
        assertThat(projection(card)).containsExactly(0, 1);

        stopFailing();
        RedemptionResult retry = callAs(CASHIER_ANNA, () -> loyalty.redeemReward(command));

        assertThat(retry.replayed()).isFalse();
        assertThat(projection(card)).containsExactly(0, 0);
        assertThat(ledgerCount(card, "REDEEM")).isEqualTo(1);
    }
}
