package pl.cavella.shared.web;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Per-client limits (PRD FR-L-06, SEC-05). Defaults live in application.yaml. */
@Validated
@ConfigurationProperties("cavella.rate-limit")
public record RateLimitProperties(
        @Min(1) int cardCreationsPerHour,
        @Min(1) int cardReadsPerMinute,
        @Min(1) int loginAttemptsPerMinute,
        @Min(1) int csrfTokensPerMinute) {}
