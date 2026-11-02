package pl.cavella.card.domain;

import static java.nio.charset.StandardCharsets.US_ASCII;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

/** Card identity (ADR-002): cryptographically random, well-formed, hash-only storage, never logged. */
class CardTokenTest {

    private static final String VALID = "AAECAwQFBgcICQoLDA0ODw"; // base64url of bytes 0..15

    /** SecureRandom that returns a known byte pattern and counts how many bytes were requested. */
    private static final class FixedRandom extends SecureRandom {
        int bytesRequested;

        @Override
        public void nextBytes(byte[] bytes) {
            bytesRequested += bytes.length;
            for (int i = 0; i < bytes.length; i++) {
                bytes[i] = (byte) i;
            }
        }
    }

    @Test
    void isDrawnFromTheGivenCsprngWith128BitsOfEntropy() {
        FixedRandom random = new FixedRandom();

        CardToken token = CardToken.generate(random);

        assertThat(random.bytesRequested).isEqualTo(16);
        assertThat(token.value()).isEqualTo(VALID);
    }

    @Test
    void isUnpaddedBase64UrlOf22Characters() {
        CardToken token = CardToken.generate(new SecureRandom());

        assertThat(token.value()).matches("^[A-Za-z0-9_-]{22}$");
        assertThat(Base64.getUrlDecoder().decode(token.value())).hasSize(16);
    }

    @Test
    void generatedTokensAreUnique() {
        SecureRandom random = new SecureRandom();
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 10_000; i++) {
            assertThat(seen.add(CardToken.generate(random).value())).isTrue();
        }
    }

    @Test
    void parsesAWellFormedToken() {
        assertThat(CardToken.parse(VALID).value()).isEqualTo(VALID);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {
        "",
        "AAECAwQFBgcICQoLDA0OD",        // 21 chars
        "AAECAwQFBgcICQoLDA0ODwA",      // 23 chars
        "AAECAwQFBgcICQoLDA0OD+",       // '+' is standard base64, not base64url
        "AAECAwQFBgcICQoLDA0OD/",
        "AAECAwQFBgcICQoLDA0OD=",
        " AECAwQFBgcICQoLDA0ODw",
        "https://cavella.pl/c#AAECAwQFBgcICQoLDA0ODw"
    })
    void rejectsMalformedTokens(String raw) {
        assertThatThrownBy(() -> CardToken.parse(raw)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void constructorRejectsMalformedValues() {
        assertThatThrownBy(() -> new CardToken("not-a-token")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void hashIsSha256OfTheEncodedToken() throws Exception {
        byte[] expected = MessageDigest.getInstance("SHA-256").digest(VALID.getBytes(US_ASCII));

        byte[] hash = CardToken.parse(VALID).sha256();

        assertThat(hash).hasSize(32).isEqualTo(expected);
    }

    @Test
    void differentTokensHaveDifferentHashes() {
        SecureRandom random = new SecureRandom();
        byte[] a = CardToken.generate(random).sha256();
        byte[] b = CardToken.generate(random).sha256();

        assertThat(Arrays.equals(a, b)).isFalse();
    }

    @Test
    void neverRevealsTheSecretWhenPrintedOrLogged() {
        assertThat(new CardToken(VALID).toString()).doesNotContain(VALID).contains("redacted");
    }
}
