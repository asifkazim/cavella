package pl.cavella;

import static org.assertj.core.api.Assertions.assertThat;

import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * L4: the app's connections carry {@code statement_timeout = 5s} and {@code lock_timeout = 3s}
 * (ARCHITECTURE §9.3). Migrations must not inherit them, or a long index build or backfill
 * fails at startup and blocks the deploy. Flyway borrows connections from the app's pool, so
 * whatever it changes must not leak back into the app's connections either.
 *
 * <p>Wired like production on purpose: datasource from {@code spring.datasource.*} properties.
 * With {@code @ServiceConnection} (the other ITs) Spring Boot gives Flyway a separate
 * DataSource outside the pool, which hides this problem entirely.
 */
@SpringBootTest
class MigrationTimeoutsIT {

    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(DockerImageName.parse(
                    System.getProperty("cavella.test.postgres-image", "postgres:17-alpine"))
            .asCompatibleSubstituteFor("postgres"));

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void productionStyleDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    private static final String TEST_SCHEMA = "l4_migration_test";

    @Autowired
    DataSource dataSource;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    Flyway appFlyway;

    @Autowired
    ObjectProvider<FlywayMigrationStrategy> strategy;

    @AfterEach
    void dropTestSchema() {
        jdbc.execute("DROP SCHEMA IF EXISTS " + TEST_SCHEMA + " CASCADE");
    }

    /** Runs a migration exactly as startup would: the app's Flyway settings and migration strategy. */
    private void migrateWithTheAppsSettings(String location) {
        Flyway flyway = Flyway.configure()
                .configuration(appFlyway.getConfiguration())
                .locations(location)
                .schemas(TEST_SCHEMA)
                .defaultSchema(TEST_SCHEMA)
                .createSchemas(true)
                .table("l4_history")
                .load();
        FlywayMigrationStrategy configured = strategy.getIfAvailable();
        if (configured != null) {
            configured.migrate(flyway);
        } else {
            flyway.migrate();
        }
    }

    /** Borrows every connection the pool can hand out at once and reads their session timeouts. */
    private List<String> timeoutsOfAllPooledConnections() throws Exception {
        int poolSize = dataSource.unwrap(HikariDataSource.class).getMaximumPoolSize();
        List<Connection> borrowed = new ArrayList<>();
        List<String> timeouts = new ArrayList<>();
        try {
            for (int i = 0; i < poolSize; i++) {
                Connection c = dataSource.getConnection();
                borrowed.add(c);
                try (Statement s = c.createStatement();
                     ResultSet rs = s.executeQuery(
                             "SELECT current_setting('statement_timeout') || '/' || current_setting('lock_timeout')")) {
                    rs.next();
                    timeouts.add(rs.getString(1));
                }
            }
        } finally {
            for (Connection c : borrowed) {
                c.close();
            }
        }
        return timeouts;
    }

    @Test
    void flywaySharesTheAppPoolAsInProduction() {
        assertThat(appFlyway.getConfiguration().getDataSource()).isSameAs(dataSource);
    }

    @Test
    void aMigrationLongerThanTheAppStatementTimeoutSucceeds() {
        migrateWithTheAppsSettings("classpath:db/test-long-migration");

        Integer applied = jdbc.queryForObject(
                "SELECT count(*) FROM " + TEST_SCHEMA + ".l4_history WHERE success AND version = '1'", Integer.class);
        assertThat(applied).isEqualTo(1);
    }

    @Test
    void appConnectionsKeepTheirTimeoutsAfterMigrations() throws Exception {
        migrateWithTheAppsSettings("classpath:db/test-long-migration");

        assertThat(timeoutsOfAllPooledConnections()).containsOnly("5s/3s");
    }
}
