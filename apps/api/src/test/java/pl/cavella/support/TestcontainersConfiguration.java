package pl.cavella.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Real PostgreSQL for integration tests: row locks, constraints, triggers and isolation behave
 * exactly as in production — an in-memory database would not prove the concurrency contracts.
 * Spring's context cache shares one container across all IT classes.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    /**
     * Same major version as production (ARCHITECTURE §11.1). Pin by digest in CI later.
     * Overridable with {@code -Dcavella.test.postgres-image=…} (e.g. an image already present
     * locally when the registry is unreachable).
     */
    static final DockerImageName POSTGRES = DockerImageName.parse(
                    System.getProperty("cavella.test.postgres-image", "postgres:17-alpine"))
            .asCompatibleSubstituteFor("postgres");

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer(POSTGRES);
    }
}
