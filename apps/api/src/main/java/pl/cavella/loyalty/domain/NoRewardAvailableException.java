package pl.cavella.loyalty.domain;

public final class NoRewardAvailableException extends LoyaltyException {

    public NoRewardAvailableException() {
        super(LoyaltyErrorCode.NO_REWARD_AVAILABLE, "Card has no reward available");
    }
}
