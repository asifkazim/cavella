package pl.cavella.card.application;

import pl.cavella.card.domain.CardId;
import pl.cavella.card.domain.CardToken;

/** Result of issuing a card. The token is returned exactly once and never stored in plaintext. */
public record IssuedCard(CardId id, CardToken token) {}
