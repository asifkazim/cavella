package pl.cavella.shared;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class IdempotencyKeyTest {

    @Test
    void parsesACanonicalUuid() {
        UUID uuid = UUID.fromString("3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b");

        assertThat(IdempotencyKey.parse("3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b").value()).isEqualTo(uuid);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"not-a-uuid", "3f2b8c1e9a4d4e6f8b7a1c2d3e4f5a6b", "1-1-1-1-1"})
    void rejectsAnythingButACanonicalUuid(String raw) {
        assertThatThrownBy(() -> IdempotencyKey.parse(raw)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void cannotBeNull() {
        assertThatThrownBy(() -> new IdempotencyKey(null)).isInstanceOf(NullPointerException.class);
    }
}
