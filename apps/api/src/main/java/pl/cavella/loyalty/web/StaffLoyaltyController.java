package pl.cavella.loyalty.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.cavella.card.domain.CardId;
import pl.cavella.card.domain.CardToken;
import pl.cavella.loyalty.application.AddStampsCommand;
import pl.cavella.loyalty.application.BalanceView;
import pl.cavella.loyalty.application.CardSummary;
import pl.cavella.loyalty.application.LoyaltyService;
import pl.cavella.loyalty.application.RedeemRewardCommand;
import pl.cavella.loyalty.application.RedemptionResult;
import pl.cavella.loyalty.application.StampResult;
import pl.cavella.loyalty.domain.CardNotFoundException;
import pl.cavella.loyalty.domain.LoyaltyRules;
import pl.cavella.shared.IdempotencyKey;
import pl.cavella.shared.web.ApiExceptionHandler;
import pl.cavella.shared.web.InvalidRequestException;

/**
 * Cashier endpoints (ARCHITECTURE §5.2). Requires a staff session (security config) and is
 * re-checked by {@code @PreAuthorize} on the service. Mutations need an {@code Idempotency-Key}.
 */
@RestController
@RequestMapping("/api/v1/staff/cards")
class StaffLoyaltyController {

    static final String REPLAYED_HEADER = "Idempotent-Replayed";

    record LookupRequest(@NotBlank @Size(max = 64) String token) {
        @Override
        public String toString() {
            return "LookupRequest[token=redacted]";
        }
    }

    /** {@code @Max} is the database bound; the business cap (3) answers 422 QUANTITY_EXCEEDS_CAP. */
    record StampRequest(@NotNull @Min(1) @Max(LoyaltyRules.MAX_QUANTITY_BOUND) Integer quantity) {}

    record BalanceResponse(int stampProgress, int stampsPerReward, int rewardsAvailable) {
        static BalanceResponse of(BalanceView b) {
            return new BalanceResponse(b.stampProgress(), b.stampsPerReward(), b.rewardsAvailable());
        }
    }

    record CardSummaryResponse(UUID cardId, String status, BalanceResponse balance, Instant lastEventAt) {
        static CardSummaryResponse of(CardSummary s) {
            return new CardSummaryResponse(
                    s.cardId().value(), s.status().name(), BalanceResponse.of(s.balance()), s.lastEventAt());
        }
    }

    record StampResponse(UUID eventId, BalanceResponse balance, int rewardsEarned) {}

    record RedemptionResponse(UUID eventId, BalanceResponse balance) {}

    private final LoyaltyService loyalty;

    StaffLoyaltyController(LoyaltyService loyalty) {
        this.loyalty = loyalty;
    }

    /** Resolves a scanned QR token to the card summary; the token travels in the body, not the URL. */
    @PostMapping("/lookup")
    CardSummaryResponse lookup(@Valid @RequestBody LookupRequest body) {
        CardToken token;
        try {
            token = CardToken.parse(body.token());
        } catch (IllegalArgumentException e) {
            throw new CardNotFoundException();
        }
        return CardSummaryResponse.of(loyalty.lookup(token));
    }

    @GetMapping("/{cardId}")
    BalanceResponse balance(@PathVariable UUID cardId) {
        return BalanceResponse.of(loyalty.balance(new CardId(cardId)));
    }

    @PostMapping("/{cardId}/stamps")
    ResponseEntity<StampResponse> addStamps(
            @PathVariable UUID cardId,
            @RequestHeader(ApiExceptionHandler.IDEMPOTENCY_HEADER) String idempotencyKey,
            @Valid @RequestBody StampRequest body) {
        StampResult result = loyalty.addStamps(new AddStampsCommand(new CardId(cardId), body.quantity(), key(idempotencyKey)));
        return created(new StampResponse(result.eventId(), BalanceResponse.of(result.balance()), result.rewardsEarned()),
                result.replayed());
    }

    @PostMapping("/{cardId}/redemptions")
    ResponseEntity<RedemptionResponse> redeem(
            @PathVariable UUID cardId, @RequestHeader(ApiExceptionHandler.IDEMPOTENCY_HEADER) String idempotencyKey) {
        RedemptionResult result = loyalty.redeemReward(new RedeemRewardCommand(new CardId(cardId), key(idempotencyKey)));
        return created(new RedemptionResponse(result.eventId(), BalanceResponse.of(result.balance())), result.replayed());
    }

    private static IdempotencyKey key(String raw) {
        try {
            return IdempotencyKey.parse(raw);
        } catch (IllegalArgumentException e) {
            throw new InvalidRequestException("Idempotency-Key must be a UUID");
        }
    }

    /** A replay returns the original status and body, flagged with {@code Idempotent-Replayed: true}. */
    private static <T> ResponseEntity<T> created(T body, boolean replayed) {
        ResponseEntity.BodyBuilder response = ResponseEntity.status(HttpStatus.CREATED);
        if (replayed) {
            response.header(REPLAYED_HEADER, "true");
        }
        return response.body(body);
    }
}
