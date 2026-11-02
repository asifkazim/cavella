package pl.cavella.shared.idempotency;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RequestFingerprintTest {

    @Test
    void identicalRequestsHaveIdenticalFingerprints() {
        RequestFingerprint a = RequestFingerprint.of("STAMP", "card-1", "1");
        RequestFingerprint b = RequestFingerprint.of("STAMP", "card-1", "1");

        assertThat(a).isEqualTo(b);
        assertThat(a.matches(b.sha256())).isTrue();
        assertThat(a.sha256()).hasSize(32);
    }

    @Test
    void anyDifferenceInOperationOrParametersChangesTheFingerprint() {
        RequestFingerprint stamp = RequestFingerprint.of("STAMP", "card-1", "1");

        assertThat(stamp.matches(RequestFingerprint.of("STAMP", "card-1", "2").sha256())).isFalse();
        assertThat(stamp.matches(RequestFingerprint.of("STAMP", "card-2", "1").sha256())).isFalse();
        assertThat(stamp.matches(RequestFingerprint.of("REDEEM", "card-1", "1").sha256())).isFalse();
    }

    @Test
    void partsCannotBeShiftedAcrossBoundaries() {
        assertThat(RequestFingerprint.of("OP", "a|b", "c")).isNotEqualTo(RequestFingerprint.of("OP", "a", "b|c"));
    }
}
