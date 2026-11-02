package pl.cavella.card.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.regex.Pattern;

/**
 * Bearer secret that <em>is</em> the loyalty card (ADR-002).
 *
 * <p>Contract:
 * <ul>
 *   <li>{@link #generate(SecureRandom)} draws exactly {@value #ENTROPY_BYTES} bytes (128 bits) from
 *       the given CSPRNG and encodes them as unpadded base64url ({@value #ENCODED_LENGTH} chars).</li>
 *   <li>{@link #parse(String)} accepts only {@code ^[A-Za-z0-9_-]{22}$} and throws
 *       {@link IllegalArgumentException} otherwise (malformed QR payloads, E-18).</li>
 *   <li>{@link #sha256()} returns the 32-byte SHA-256 of the encoded token; only this hash is
 *       ever persisted.</li>
 *   <li>{@link #toString()} never reveals the token, so it cannot leak into logs (SEC-03).</li>
 * </ul>
 */
public record CardToken(String value) {

    public static final int ENTROPY_BYTES = 16;
    public static final int ENCODED_LENGTH = 22;

    private static final Pattern FORMAT = Pattern.compile("^[A-Za-z0-9_-]{" + ENCODED_LENGTH + "}$");
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();

    public CardToken {
        // Deliberately generic message: never echo a (possibly real) token into exceptions or logs.
        if (value == null || !FORMAT.matcher(value).matches()) {
            throw new IllegalArgumentException("Malformed card token");
        }
    }

    public static CardToken generate(SecureRandom random) {
        byte[] bytes = new byte[ENTROPY_BYTES];
        random.nextBytes(bytes);
        return new CardToken(ENCODER.encodeToString(bytes));
    }

    public static CardToken parse(String raw) {
        return new CardToken(raw);
    }

    public byte[] sha256() {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.US_ASCII));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by every Java platform", e);
        }
    }

    @Override
    public String toString() {
        return "CardToken[redacted]";
    }
}
