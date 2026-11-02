package pl.cavella.loyalty.application;

import java.util.UUID;

/**
 * @param eventId       public id of the ledger entry
 * @param rewardsEarned rewards unlocked by this command (0 or more)
 * @param replayed      true when this is the stored result of an earlier request with the same key
 */
public record StampResult(UUID eventId, BalanceView balance, int rewardsEarned, boolean replayed) {}
