package pl.cavella.loyalty.domain;

/** Result of adding stamps: the new balance and how many rewards this purchase unlocked. */
public record StampOutcome(Balance balance, int rewardsEarned) {}
