package pl.cavella.loyalty.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class LoyaltyRulesTest {

    @Test
    void defaultIsSixStampsPerFreeCoffee() {
        assertThat(LoyaltyRules.DEFAULT.stampsPerReward()).isEqualTo(6);
        assertThat(LoyaltyRules.DEFAULT.maxStampsPerTransaction()).isEqualTo(3);
    }

    @ParameterizedTest(name = "stampsPerReward={0}, cap={1}")
    @CsvSource({"0, 3", "-6, 3", "6, 0", "6, -1", "6, 11"})
    void rejectsImpossibleRules(int stampsPerReward, int cap) {
        assertThatThrownBy(() -> new LoyaltyRules(stampsPerReward, cap))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
