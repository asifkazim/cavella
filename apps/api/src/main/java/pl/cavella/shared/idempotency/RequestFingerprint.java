package pl.cavella.shared.idempotency;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;

/**
 * SHA-256 of a canonical description of a request (operation + parameters). The same
 * idempotency key with a different fingerprint is a client bug and is rejected.
 */
public record RequestFingerprint(byte[] sha256) {

    public static RequestFingerprint of(String operation, String... parts) {
        StringBuilder canonical = new StringBuilder(operation);
        for (String part : parts) {
            // Length-prefix each part so ("a|b", "c") and ("a", "b|c") can never collide.
            canonical.append('|').append(part.length()).append(':').append(part);
        }
        try {
            return new RequestFingerprint(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by every Java platform", e);
        }
    }

    /** Constant-time comparison. */
    public boolean matches(byte[] other) {
        return MessageDigest.isEqual(sha256, other);
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof RequestFingerprint f && Arrays.equals(sha256, f.sha256);
    }

    @Override
    public int hashCode() {
        return Arrays.hashCode(sha256);
    }

    @Override
    public String toString() {
        return "RequestFingerprint[" + sha256.length + " bytes]";
    }
}
