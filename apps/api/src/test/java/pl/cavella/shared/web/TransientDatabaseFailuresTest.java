package pl.cavella.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.jdbc.UncategorizedSQLException;

class TransientDatabaseFailuresTest {

    private static UncategorizedSQLException uncategorized(String sqlState) {
        return new UncategorizedSQLException("PreparedStatementCallback", "SELECT 1", new SQLException("x", sqlState));
    }

    @Test
    void postgresLockAndStatementTimeoutsAreTransientEvenWhenSpringLeavesThemUncategorized() {
        // Observed in LockTimeoutApiIT: 55P03 arrives as UncategorizedSQLException.
        assertThat(TransientDatabaseFailures.isTransient(uncategorized("55P03"))).as("lock_not_available").isTrue();
        assertThat(TransientDatabaseFailures.isTransient(uncategorized("57014"))).as("query_canceled").isTrue();
        assertThat(TransientDatabaseFailures.isTransient(uncategorized("40P01"))).as("deadlock_detected").isTrue();
        assertThat(TransientDatabaseFailures.isTransient(uncategorized("40001"))).as("serialization_failure").isTrue();
    }

    @Test
    void springsOwnLockAndTimeoutExceptionsAreTransient() {
        assertThat(TransientDatabaseFailures.isTransient(new CannotAcquireLockException("lock"))).isTrue();
        assertThat(TransientDatabaseFailures.isTransient(new QueryTimeoutException("timeout"))).isTrue();
    }

    @Test
    void realBugsAreNotHiddenAsRetryable() {
        assertThat(TransientDatabaseFailures.isTransient(uncategorized("23505"))).as("unique_violation").isFalse();
        assertThat(TransientDatabaseFailures.isTransient(new DataIntegrityViolationException("check"))).isFalse();
        assertThat(TransientDatabaseFailures.isTransient(new IllegalStateException("bug"))).isFalse();
        assertThat(TransientDatabaseFailures.isTransient(null)).isFalse();
    }

    @Test
    void sqlStateIsReportedForLogsWithoutTheStatement() {
        assertThat(TransientDatabaseFailures.sqlState(uncategorized("55P03"))).isEqualTo("55P03");
        assertThat(TransientDatabaseFailures.sqlState(new CannotAcquireLockException("lock"))).isEqualTo("n/a");
    }
}
