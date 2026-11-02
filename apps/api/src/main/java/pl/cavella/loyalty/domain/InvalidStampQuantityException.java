package pl.cavella.loyalty.domain;

/** Quantity below 1 ({@code VALIDATION_FAILED}) or above the per-transaction cap ({@code QUANTITY_EXCEEDS_CAP}). */
public final class InvalidStampQuantityException extends LoyaltyException {

    private InvalidStampQuantityException(LoyaltyErrorCode code, String message) {
        super(code, message);
    }

    public static InvalidStampQuantityException notPositive(int quantity) {
        return new InvalidStampQuantityException(
                LoyaltyErrorCode.VALIDATION_FAILED, "Stamp quantity must be at least 1, was " + quantity);
    }

    public static InvalidStampQuantityException aboveCap(int quantity, int cap) {
        return new InvalidStampQuantityException(
                LoyaltyErrorCode.QUANTITY_EXCEEDS_CAP, "Stamp quantity " + quantity + " exceeds the cap of " + cap);
    }
}
