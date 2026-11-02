package pl.cavella.config;

import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Database migrations at startup (L4).
 *
 * <p>Flyway runs on connections borrowed from the app's pool and relaxes their timeouts
 * ({@code spring.flyway.init-sqls}). Once it is done, those connections are evicted so the pool
 * opens fresh ones, which get the app's {@code lock_timeout}/{@code statement_timeout} again from
 * Hikari's {@code connection-init-sql} (ARCHITECTURE §9.3). Without this, some app connections
 * would run without timeouts until they were recycled.
 */
@Configuration
public class MigrationConfig {

    @Bean
    FlywayMigrationStrategy migrateThenRefreshPool(DataSource dataSource) {
        return flyway -> {
            flyway.migrate();
            evictPooledConnections(dataSource);
        };
    }

    private static void evictPooledConnections(DataSource dataSource) {
        try {
            if (dataSource.isWrapperFor(HikariDataSource.class)) {
                HikariPoolMXBean pool = dataSource.unwrap(HikariDataSource.class).getHikariPoolMXBean();
                if (pool != null) {
                    pool.softEvictConnections(); // idle ones now, in-use ones when returned
                }
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not refresh the connection pool after migrations", e);
        }
    }
}
