package pl.cavella.loyalty;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static pl.cavella.support.SecurityContexts.callAnonymously;
import static pl.cavella.support.SecurityContexts.callAs;
import static pl.cavella.support.Staff.CASHIER_ANNA;
import static pl.cavella.support.Staff.OWNER_OLA;

import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.stream.Stream;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import pl.cavella.card.domain.CardId;
import pl.cavella.loyalty.application.AddStampsCommand;
import pl.cavella.loyalty.application.LoyaltyService;
import pl.cavella.loyalty.application.RedeemRewardCommand;
import pl.cavella.shared.IdempotencyKey;
import pl.cavella.support.IntegrationTest;
import pl.cavella.support.SecurityContexts;

/**
 * Rule: only authorized staff may add stamps or redeem (PRD BR-01, AC-L-03, T-01).
 * Enforced on the service methods, so it holds for every caller, not only HTTP controllers.
 */
class AuthorizationIT extends IntegrationTest {

    @Autowired
    LoyaltyService loyalty;

    enum Operation {
        ADD_STAMPS, REDEEM, VIEW_BALANCE
    }

    private Callable<Object> invoke(Operation operation, CardId card) {
        return switch (operation) {
            case ADD_STAMPS -> () -> loyalty.addStamps(new AddStampsCommand(card, 1, IdempotencyKey.random()));
            case REDEEM -> () -> loyalty.redeemReward(new RedeemRewardCommand(card, IdempotencyKey.random()));
            case VIEW_BALANCE -> () -> loyalty.balance(card);
        };
    }

    static Stream<Operation> staffOperations() {
        return Stream.of(Operation.values());
    }

    @ParameterizedTest
    @MethodSource("staffOperations")
    void anonymousCallersAreRejected(Operation operation) {
        CardId card = givenCard(0, 1);

        assertThatThrownBy(() -> callAnonymously(invoke(operation, card)))
                .isInstanceOf(AuthenticationCredentialsNotFoundException.class);

        assertNothingWritten(card);
    }

    @ParameterizedTest
    @MethodSource("staffOperations")
    void authenticatedNonStaffUsersAreRejected(Operation operation) {
        CardId card = givenCard(0, 1);

        assertThatThrownBy(() -> callAs(SecurityContexts.customer(), invoke(operation, card)))
                .isInstanceOf(AuthorizationDeniedException.class);

        assertNothingWritten(card);
    }

    static Stream<Arguments> staffMembers() {
        return Stream.of(
                Arguments.of(Named.of("cashier", SecurityContexts.staff(CASHIER_ANNA))),
                Arguments.of(Named.of("owner", SecurityContexts.staff(OWNER_OLA))));
    }

    @ParameterizedTest
    @MethodSource("staffMembers")
    void cashiersAndOwnersMayAddStamps(Authentication staff) throws Exception {
        CardId card = givenCard(0, 0);

        callAs(staff, invoke(Operation.ADD_STAMPS, card));

        assertThat(ledgerCount(card, "STAMP")).isEqualTo(1);
    }

    @ParameterizedTest
    @MethodSource("staffMembers")
    void cashiersAndOwnersMayRedeem(Authentication staff) throws Exception {
        CardId card = givenCard(0, 1);

        callAs(staff, invoke(Operation.REDEEM, card));

        assertThat(ledgerCount(card, "REDEEM")).isEqualTo(1);
    }

    @Test
    void theLedgerRecordsTheAuthenticatedStaffMemberNotAnyClientSuppliedIdentity() throws Exception {
        CardId card = givenCard(0, 0);

        callAs(CASHIER_ANNA, invoke(Operation.ADD_STAMPS, card));

        UUID recordedStaff = jdbc.queryForObject(
                "SELECT staff_user_id FROM loyalty_event WHERE card_id = ?", UUID.class, card.value());
        assertThat(recordedStaff).isEqualTo(CASHIER_ANNA.id().value());
    }

    @Test
    void onlyTheOwnerMayReadTheAuditTrail() throws Exception {
        CardId card = givenCard(0, 0);

        assertThatThrownBy(() -> callAs(CASHIER_ANNA, () -> loyalty.auditTrail(card)))
                .isInstanceOf(AuthorizationDeniedException.class);
        assertThat(callAs(OWNER_OLA, () -> loyalty.auditTrail(card))).isEmpty();
    }

    private void assertNothingWritten(CardId card) {
        assertThat(ledgerCount(card)).isZero();
        assertThat(idempotencyRecordCount()).isZero();
        assertThat(projection(card)).containsExactly(0, 1);
    }
}
