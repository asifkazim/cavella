package pl.cavella.loyalty.domain;

/** Unknown card id or token. The message never echoes the token (SEC-03). */
public final class CardNotFoundException extends LoyaltyException {

    public CardNotFoundException() {
        super(LoyaltyErrorCode.CARD_NOT_FOUND, "Card not found");
    }
}
