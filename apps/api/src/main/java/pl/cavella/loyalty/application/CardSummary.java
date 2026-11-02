package pl.cavella.loyalty.application;

import java.time.Instant;
import pl.cavella.card.domain.CardId;
import pl.cavella.card.domain.CardStatus;

/** What the cashier sees after scanning a card (PRD FR-S-05). {@code lastEventAt} is null for an unused card. */
public record CardSummary(CardId cardId, CardStatus status, BalanceView balance, Instant lastEventAt) {}
