package pl.cavella.loyalty.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import pl.cavella.card.domain.CardId;
import pl.cavella.card.domain.CardStatus;
import pl.cavella.card.domain.CardToken;
import pl.cavella.loyalty.domain.Balance;
import pl.cavella.loyalty.domain.CardBlockedException;
import pl.cavella.loyalty.domain.CardNotFoundException;
import pl.cavella.loyalty.domain.IdempotencyKeyReusedException;
import pl.cavella.loyalty.domain.LoyaltyErrorCode;
import pl.cavella.loyalty.domain.LoyaltyEventType;
import pl.cavella.loyalty.domain.LoyaltyException;
import pl.cavella.loyalty.domain.LoyaltyRules;
import pl.cavella.loyalty.domain.NoRewardAvailableException;
import pl.cavella.loyalty.domain.StampOutcome;
import pl.cavella.loyalty.persistence.LoyaltyRepository;
import pl.cavella.loyalty.persistence.LoyaltyRepository.CardState;
import pl.cavella.loyalty.persistence.LoyaltyRepository.NewEvent;
import pl.cavella.loyalty.persistence.LoyaltyRepository.StoredEvent;
import pl.cavella.shared.IdempotencyKey;
import pl.cavella.shared.idempotency.IdempotencyStore;
import pl.cavella.shared.idempotency.RequestFingerprint;
import pl.cavella.shared.idempotency.StoredOutcome;
import pl.cavella.staff.StaffId;
import pl.cavella.staff.application.CurrentStaff;

/**
 * Loyalty use cases (ARCHITECTURE §8–§10). Authorization and transaction boundaries are part of
 * the contract and are declared here.
 *
 * <h2>Command contract ({@link #addStamps}, {@link #redeemReward})</h2>
 * One command = one database transaction (READ COMMITTED), in this order:
 * <ol>
 *   <li>{@code INSERT idempotency_record … ON CONFLICT DO NOTHING} keyed by (acting staff, key).
 *       If the key exists: same request fingerprint → return the stored outcome with
 *       {@code replayed = true} (or rethrow the stored rejection); different fingerprint →
 *       {@code IdempotencyKeyReusedException}.</li>
 *   <li>{@code SELECT … FROM card WHERE id = ? FOR UPDATE} — serialises all commands per card.</li>
 *   <li>Apply the {@code Balance} transition (domain rules).</li>
 *   <li>{@code INSERT loyalty_event} (append-only ledger, with deltas and the after-snapshot).</li>
 *   <li>{@code UPDATE card} projection columns.</li>
 *   <li>Store the outcome on the idempotency record; commit.</li>
 * </ol>
 * Any exception before commit rolls back every step — nothing is partially written.
 * Business rejections ({@code LoyaltyException}) are remembered on the idempotency record so a
 * retry gets the same answer, but never produce a ledger entry. They are thrown only after the
 * rejection is recorded and before any ledger write, which is why the transaction is configured
 * not to roll back for them ({@code noRollbackFor}).
 */
@Service
public class LoyaltyService {

    private final LoyaltyRepository ledger;
    private final IdempotencyStore idempotency;
    private final LoyaltyRules rules;
    private final Clock clock;

    public LoyaltyService(LoyaltyRepository ledger, IdempotencyStore idempotency, LoyaltyRules rules, Clock clock) {
        this.ledger = ledger;
        this.idempotency = idempotency;
        this.rules = rules;
        this.clock = clock;
    }

    @PreAuthorize("hasAnyRole('CASHIER', 'OWNER')")
    @Transactional(isolation = Isolation.READ_COMMITTED, noRollbackFor = LoyaltyException.class)
    public StampResult addStamps(AddStampsCommand command) {
        rules.checkQuantity(command.quantity()); // stateless validation: rejected before touching the database
        StaffId staff = CurrentStaff.require().id();
        IdempotencyKey key = command.idempotencyKey();
        RequestFingerprint fingerprint = RequestFingerprint.of(
                LoyaltyEventType.STAMP.name(), command.cardId().value().toString(), Integer.toString(command.quantity()));

        Optional<StoredOutcome> previous = claim(staff, key, fingerprint);
        if (previous.isPresent()) {
            StoredEvent event = replayedEvent(previous.get());
            return new StampResult(
                    event.entry().eventId(), viewAfter(event), event.entry().rewardDelta(), true);
        }

        CardState card = lockActiveCard(command.cardId(), staff, key);
        StampOutcome outcome = card.balance().addStamps(command.quantity(), rules);
        UUID eventId = record(card, LoyaltyEventType.STAMP, command.quantity(),
                outcome.balance(), outcome.rewardsEarned(), staff, key);
        return new StampResult(eventId, view(outcome.balance()), outcome.rewardsEarned(), false);
    }

    @PreAuthorize("hasAnyRole('CASHIER', 'OWNER')")
    @Transactional(isolation = Isolation.READ_COMMITTED, noRollbackFor = LoyaltyException.class)
    public RedemptionResult redeemReward(RedeemRewardCommand command) {
        StaffId staff = CurrentStaff.require().id();
        IdempotencyKey key = command.idempotencyKey();
        RequestFingerprint fingerprint =
                RequestFingerprint.of(LoyaltyEventType.REDEEM.name(), command.cardId().value().toString());

        Optional<StoredOutcome> previous = claim(staff, key, fingerprint);
        if (previous.isPresent()) {
            StoredEvent event = replayedEvent(previous.get());
            return new RedemptionResult(event.entry().eventId(), viewAfter(event), true);
        }

        CardState card = lockActiveCard(command.cardId(), staff, key);
        Balance after;
        try {
            after = card.balance().redeem();
        } catch (NoRewardAvailableException e) {
            throw rejected(staff, key, e);
        }
        UUID eventId = record(card, LoyaltyEventType.REDEEM, 1, after, -1, staff, key);
        return new RedemptionResult(eventId, view(after), false);
    }

    /** Staff view of a scanned card (PRD FR-S-05). */
    @PreAuthorize("hasAnyRole('CASHIER', 'OWNER')")
    @Transactional(readOnly = true)
    public BalanceView balance(CardId cardId) {
        return ledger.findCard(cardId).map(c -> view(c.balance())).orElseThrow(CardNotFoundException::new);
    }

    /** Customer view: possession of the token is the only credential (ADR-002). */
    @Transactional(readOnly = true)
    public BalanceView balanceForToken(CardToken token) {
        return ledger.findCardByTokenHash(token.sha256())
                .map(c -> view(c.balance()))
                .orElseThrow(CardNotFoundException::new);
    }

    /** Staff card lookup by scanned token: everything the cashier screen needs (FR-S-05). */
    @PreAuthorize("hasAnyRole('CASHIER', 'OWNER')")
    @Transactional(readOnly = true)
    public CardSummary lookup(CardToken token) {
        CardState card = ledger.findCardByTokenHash(token.sha256()).orElseThrow(CardNotFoundException::new);
        return new CardSummary(card.id(), card.status(), view(card.balance()), card.lastEventAt());
    }

    /** Full audit trail of a card, oldest first (PRD FR-A-02). Owner only. */
    @PreAuthorize("hasRole('OWNER')")
    @Transactional(readOnly = true)
    public List<LedgerEntry> auditTrail(CardId cardId) {
        if (ledger.findCard(cardId).isEmpty()) {
            throw new CardNotFoundException();
        }
        return ledger.events(cardId);
    }

    // ---- command steps ------------------------------------------------------------------------

    private Optional<StoredOutcome> claim(StaffId staff, IdempotencyKey key, RequestFingerprint fingerprint) {
        try {
            return idempotency.claim(staff.value(), key, fingerprint);
        } catch (IdempotencyStore.FingerprintMismatch e) {
            throw new IdempotencyKeyReusedException();
        }
    }

    /** Replays a stored outcome: the original event, or the original rejection. */
    private StoredEvent replayedEvent(StoredOutcome outcome) {
        return switch (outcome) {
            case StoredOutcome.Succeeded succeeded -> ledger.getEvent(succeeded.eventId());
            case StoredOutcome.Rejected rejected -> throw rejectionFor(rejected.code());
        };
    }

    private CardState lockActiveCard(CardId cardId, StaffId staff, IdempotencyKey key) {
        CardState card = ledger.lockCard(cardId).orElseThrow(() -> rejected(staff, key, new CardNotFoundException()));
        if (card.status() == CardStatus.BLOCKED) {
            throw rejected(staff, key, new CardBlockedException());
        }
        return card;
    }

    private UUID record(CardState card, LoyaltyEventType type, int quantity, Balance after, int rewardDelta,
                        StaffId staff, IdempotencyKey key) {
        UUID eventId = UUID.randomUUID();
        Instant now = clock.instant();
        int stampDelta = after.stampProgress() - card.balance().stampProgress();
        ledger.appendEvent(new NewEvent(eventId, card.id(), type, quantity, stampDelta, rewardDelta, after,
                rules.stampsPerReward(), staff, key, now));
        ledger.updateProjection(card.id(), after,
                type == LoyaltyEventType.STAMP ? quantity : 0,
                type == LoyaltyEventType.REDEEM ? 1 : 0,
                now);
        idempotency.recordSuccess(staff.value(), key, eventId);
        return eventId;
    }

    /** Remembers a business rejection on the idempotency record, then returns it for throwing. */
    private <E extends LoyaltyException> E rejected(StaffId staff, IdempotencyKey key, E rejection) {
        idempotency.recordRejection(staff.value(), key, rejection.code().name(), rejection.code().httpStatus());
        return rejection;
    }

    private static LoyaltyException rejectionFor(String code) {
        return switch (LoyaltyErrorCode.valueOf(code)) {
            case NO_REWARD_AVAILABLE -> new NoRewardAvailableException();
            case CARD_NOT_FOUND -> new CardNotFoundException();
            case CARD_BLOCKED -> new CardBlockedException();
            default -> throw new IllegalStateException("Unexpected stored rejection " + code);
        };
    }

    private BalanceView view(Balance balance) {
        return new BalanceView(balance.stampProgress(), rules.stampsPerReward(), balance.rewardsAvailable());
    }

    /** The balance right after a stored event, with the rule that applied then. */
    private static BalanceView viewAfter(StoredEvent event) {
        return new BalanceView(event.entry().stampsAfter(), event.stampsPerReward(), event.entry().rewardsAfter());
    }
}
