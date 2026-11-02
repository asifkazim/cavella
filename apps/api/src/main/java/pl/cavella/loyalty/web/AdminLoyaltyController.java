package pl.cavella.loyalty.web;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import pl.cavella.card.domain.CardId;
import pl.cavella.loyalty.application.LedgerEntry;
import pl.cavella.loyalty.application.LoyaltyService;

/** Owner-only audit trail of a card (PRD FR-A-02). */
@RestController
class AdminLoyaltyController {

    record AuditEntryResponse(
            UUID eventId,
            String type,
            int quantity,
            int stampDelta,
            int rewardDelta,
            int stampsAfter,
            int rewardsAfter,
            UUID staffId,
            UUID idempotencyKey,
            Instant createdAt) {

        static AuditEntryResponse of(LedgerEntry e) {
            return new AuditEntryResponse(e.eventId(), e.type().name(), e.quantity(), e.stampDelta(), e.rewardDelta(),
                    e.stampsAfter(), e.rewardsAfter(), e.staffId().value(), e.idempotencyKey().value(), e.createdAt());
        }
    }

    private final LoyaltyService loyalty;

    AdminLoyaltyController(LoyaltyService loyalty) {
        this.loyalty = loyalty;
    }

    @GetMapping("/api/v1/admin/cards/{cardId}/events")
    List<AuditEntryResponse> events(@PathVariable UUID cardId) {
        return loyalty.auditTrail(new CardId(cardId)).stream().map(AuditEntryResponse::of).toList();
    }
}
