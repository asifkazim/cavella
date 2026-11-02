package pl.cavella.shared.web;

/** A request value failed validation outside Bean Validation (e.g. a malformed header). → 400 VALIDATION_FAILED. */
public class InvalidRequestException extends RuntimeException {

    public InvalidRequestException(String safeDetail) {
        super(safeDetail, null, false, false);
    }
}
