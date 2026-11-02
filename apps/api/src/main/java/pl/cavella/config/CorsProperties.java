package pl.cavella.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** {@code cavella.cors.allowed-origins}: exact web origins (no wildcards), e.g. https://cavella.pl. */
@ConfigurationProperties("cavella.cors")
public record CorsProperties(List<String> allowedOrigins) {}
