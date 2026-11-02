package pl.cavella.shared.config;

import java.security.SecureRandom;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import pl.cavella.loyalty.domain.LoyaltyRules;

/**
 * Method security enforces staff-only commands on the service itself, not just on controllers
 * (ARCHITECTURE §7, SEC-02). The HTTP filter chain arrives with the web layer.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    /** All timestamps come from this clock (ARCHITECTURE §3, E-15); tests can replace it. */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    LoyaltyRules loyaltyRules() {
        return LoyaltyRules.DEFAULT;
    }

    /** One shared, thread-safe CSPRNG for card tokens (ADR-002). */
    @Bean
    SecureRandom secureRandom() {
        return new SecureRandom();
    }
}
