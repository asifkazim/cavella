package pl.cavella.loyalty.domain;

/**
 * Ledger entry types in scope for this iteration. VOID, ADJUST, BLOCK, UNBLOCK and REISSUE
 * (ARCHITECTURE §8) follow in later iterations with their own tests.
 */
public enum LoyaltyEventType {
    STAMP,
    REDEEM
}
