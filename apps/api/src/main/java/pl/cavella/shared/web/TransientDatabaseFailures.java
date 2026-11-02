package pl.cavella.shared.web;

import java.sql.SQLException;
import java.util.Set;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.dao.QueryTimeoutException;

/**
 * Recognises database failures that are safe and useful to retry: the transaction rolled back
 * completely, so a retry with the same idempotency key executes fresh (ARCHITECTURE §9.3, §10.1).
 *
 * <p>Checks SQLStates as well as Spring's exception types because Spring does not always
 * categorise them: a PostgreSQL lock timeout (55P03) arrives as {@code UncategorizedSQLException}.
 */
public final class TransientDatabaseFailures {

    /** lock_not_available (lock_timeout), query_canceled (statement_timeout), deadlock, serialization. */
    private static final Set<String> TRANSIENT_SQL_STATES = Set.of("55P03", "57014", "40P01", "40001");

    private TransientDatabaseFailures() {}

    public static boolean isTransient(Throwable failure) {
        for (Throwable t = failure; t != null; t = t.getCause()) {
            if (t instanceof PessimisticLockingFailureException || t instanceof QueryTimeoutException) {
                return true;
            }
            if (t instanceof SQLException sql && sql.getSQLState() != null
                    && TRANSIENT_SQL_STATES.contains(sql.getSQLState())) {
                return true;
            }
        }
        return false;
    }

    /** The first SQLState in the cause chain, for logs. Never the statement or its parameters. */
    public static String sqlState(Throwable failure) {
        for (Throwable t = failure; t != null; t = t.getCause()) {
            if (t instanceof SQLException sql && sql.getSQLState() != null) {
                return sql.getSQLState();
            }
        }
        return "n/a";
    }
}
