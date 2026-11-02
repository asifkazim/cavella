package pl.cavella.loyalty.application;

import java.util.Objects;
import pl.cavella.card.domain.CardId;
import pl.cavella.shared.IdempotencyKey;

/** Redeem exactly one reward (PRD J5, FR-S-07). */
public record RedeemRewardCommand(CardId cardId, IdempotencyKey idempotencyKey) {

    public RedeemRewardCommand {
        Objects.requireNonNull(cardId, "cardId");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey");
    }
}
