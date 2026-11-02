package pl.cavella.card.domain;

/** Card lifecycle (ARCHITECTURE §8.1). Stored as text in {@code card.status}. */
public enum CardStatus {
    PREISSUED,
    ACTIVE,
    BLOCKED
}
