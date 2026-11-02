package pl.cavella.loyalty;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static pl.cavella.support.SecurityContexts.callAs;
import static pl.cavella.support.Staff.CASHIER_ANNA;
import static pl.cavella.support.Staff.CASHIER_BARTEK;
import static pl.cavella.support.Staff.OWNER_OLA;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import pl.cavella.card.domain.CardId;
import pl.cavella.loyalty.application.AddStampsCommand;
import pl.cavella.loyalty.application.LedgerEntry;
import pl.cavella.loyalty.application.LoyaltyService;
import pl.cavella.loyalty.application.RedeemRewardCommand;
import pl.cavella.loyalty.application.RedemptionResult;
import pl.cavella.loyalty.application.StampResult;
import pl.cavella.loyalty.domain.LoyaltyEventType;
import pl.cavella.loyalty.domain.NoRewardAvailableException;
import pl.cavella.shared.IdempotencyKey;
import pl.cavella.support.IntegrationTest;

/** Rule: every stamp and redemption is auditable (PRD FR-A-02, AC-S-04). */
class AuditTrailIT extends IntegrationTest {

    @Autowired
    LoyaltyService loyalty;

    @Test
    void everyStampAndRedemptionIsRecordedWithWhoWhatWhenAndTheResultingBalance() throws Exception {
        CardId card = givenCard(5, 0);
        IdempotencyKey stampKey = IdempotencyKey.random();
        IdempotencyKey redeemKey = IdempotencyKey.random();
        Instant before = Instant.now();

        StampResult stamp = callAs(CASHIER_ANNA, () -> loyalty.addStamps(new AddStampsCommand(card, 2, stampKey)));
        RedemptionResult redemption =
                callAs(CASHIER_BARTEK, () -> loyalty.redeemReward(new RedeemRewardCommand(card, redeemKey)));

        List<LedgerEntry> trail = callAs(OWNER_OLA, () -> loyalty.auditTrail(card));
        assertThat(trail).hasSize(2);

        LedgerEntry first = trail.get(0);
        assertThat(first.eventId()).isEqualTo(stamp.eventId());
        assertThat(first.cardId()).isEqualTo(card);
        assertThat(first.type()).isEqualTo(LoyaltyEventType.STAMP);
        assertThat(first.quantity()).isEqualTo(2);
        assertThat(first.stampDelta()).isEqualTo(-4); // 5 + 2 = 7 → progress 1, so delta is −4 …
        assertThat(first.rewardDelta()).isEqualTo(1); // … and one reward was earned
        assertThat(first.stampsAfter()).isEqualTo(1);
        assertThat(first.rewardsAfter()).isEqualTo(1);
        assertThat(first.staffId()).isEqualTo(CASHIER_ANNA.id());
        assertThat(first.idempotencyKey()).isEqualTo(stampKey);
        assertThat(first.createdAt()).isBetween(before.minus(Duration.ofSeconds(5)), Instant.now().plusSeconds(5));

        LedgerEntry second = trail.get(1);
        assertThat(second.eventId()).isEqualTo(redemption.eventId());
        assertThat(second.type()).isEqualTo(LoyaltyEventType.REDEEM);
        assertThat(second.quantity()).isEqualTo(1);
        assertThat(second.stampDelta()).isZero();
        assertThat(second.rewardDelta()).isEqualTo(-1);
        assertThat(second.stampsAfter()).isEqualTo(1);
        assertThat(second.rewardsAfter()).isZero();
        assertThat(second.staffId()).isEqualTo(CASHIER_BARTEK.id());
        assertThat(second.idempotencyKey()).isEqualTo(redeemKey);
    }

    @Test
    void rejectedCommandsLeaveNoLedgerEntry() {
        CardId card = givenCard(0, 0);

        assertThatThrownBy(() -> callAs(CASHIER_ANNA,
                        () -> loyalty.redeemReward(new RedeemRewardCommand(card, IdempotencyKey.random()))))
                .isInstanceOf(NoRewardAvailableException.class);

        assertThat(ledgerCount(card)).isZero();
    }

    @Test
    void theCardBalanceAlwaysEqualsTheBalanceRebuiltFromTheLedger() throws Exception {
        CardId card = givenCard(0, 0);
        for (int quantity : new int[] {3, 3, 1, 2, 3}) {
            callAs(CASHIER_ANNA, () -> loyalty.addStamps(new AddStampsCommand(card, quantity, IdempotencyKey.random())));
        }
        callAs(CASHIER_ANNA, () -> loyalty.redeemReward(new RedeemRewardCommand(card, IdempotencyKey.random())));

        // 12 stamps → 2 rewards, progress 0; one redeemed → 1 reward left.
        assertThat(projection(card)).containsExactly(0, 1);
        assertThat(ledgerFold(card, 0, 0)).containsExactly(projection(card));
    }
}
