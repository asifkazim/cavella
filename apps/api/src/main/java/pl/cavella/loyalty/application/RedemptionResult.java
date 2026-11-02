package pl.cavella.loyalty.application;

import java.util.UUID;

/** @param replayed true when this is the stored result of an earlier request with the same key */
public record RedemptionResult(UUID eventId, BalanceView balance, boolean replayed) {}
