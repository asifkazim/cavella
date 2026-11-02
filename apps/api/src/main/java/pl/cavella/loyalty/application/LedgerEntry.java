package pl.cavella.loyalty.application;

import java.time.Instant;
import java.util.UUID;
import pl.cavella.card.domain.CardId;
import pl.cavella.loyalty.domain.LoyaltyEventType;
import pl.cavella.shared.IdempotencyKey;
import pl.cavella.staff.StaffId;

/**
 * One immutable audit record (PRD FR-A-02): who did what to which card, when, under which
 * idempotency key, with the deltas applied and the balance right after.
 */
public record LedgerEntry(
        UUID eventId,
        CardId cardId,
        LoyaltyEventType type,
        int quantity,
        int stampDelta,
        int rewardDelta,
        int stampsAfter,
        int rewardsAfter,
        StaffId staffId,
        IdempotencyKey idempotencyKey,
        Instant createdAt) {}
