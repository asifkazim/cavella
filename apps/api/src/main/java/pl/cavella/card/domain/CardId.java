package pl.cavella.card.domain;

import java.util.Objects;
import java.util.UUID;

/**
 * Internal card identifier (database primary key). Only staff endpoints accept it; it is
 * useless without a staff session (ARCHITECTURE §5.2). Customers are identified by the
 * {@link CardToken}, never by this id.
 */
public record CardId(UUID value) {

    public CardId {
        Objects.requireNonNull(value, "value");
    }
}
