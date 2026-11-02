package pl.cavella.loyalty.domain;

public final class CardBlockedException extends LoyaltyException {

    public CardBlockedException() {
        super(LoyaltyErrorCode.CARD_BLOCKED, "Card is blocked");
    }
}
