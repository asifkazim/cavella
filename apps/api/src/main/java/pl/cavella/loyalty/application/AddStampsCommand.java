package pl.cavella.loyalty.application;

import java.util.Objects;
import pl.cavella.card.domain.CardId;
import pl.cavella.shared.IdempotencyKey;

/**
 * Add {@code quantity} stamps for qualifying purchases (PRD J4). The acting staff member comes
 * from the security context, not from this command.
 */
public record AddStampsCommand(CardId cardId, int quantity, IdempotencyKey idempotencyKey) {

    public AddStampsCommand {
        Objects.requireNonNull(cardId, "cardId");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey");
    }
}
