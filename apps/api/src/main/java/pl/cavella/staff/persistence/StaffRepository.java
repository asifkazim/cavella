package pl.cavella.staff.persistence;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import pl.cavella.staff.StaffId;
import pl.cavella.staff.StaffRole;

@Repository
public class StaffRepository {

    private final JdbcTemplate jdbc;

    public StaffRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record LoginRow(StaffId id, StaffRole role, boolean active, String passwordHash, Instant lockedUntil) {}

    /** Loads the account for a login attempt and locks the row so concurrent attempts count correctly. */
    public Optional<LoginRow> findForLogin(String email) {
        return jdbc.query(
                        "SELECT id, role, active, password_hash, locked_until FROM staff_user WHERE lower(email) = lower(?) FOR UPDATE",
                        (rs, n) -> {
                            OffsetDateTime locked = rs.getObject("locked_until", OffsetDateTime.class);
                            return new LoginRow(
                                    new StaffId(rs.getObject("id", UUID.class)),
                                    StaffRole.valueOf(rs.getString("role")),
                                    rs.getBoolean("active"),
                                    rs.getString("password_hash"),
                                    locked == null ? null : locked.toInstant());
                        },
                        email)
                .stream()
                .findFirst();
    }

    /** Counts a failed attempt; on reaching {@code maxFailures} locks the account until {@code lockUntil}. */
    public void recordFailedLogin(StaffId id, int maxFailures, Instant lockUntil) {
        jdbc.update("""
                UPDATE staff_user
                   SET locked_until = CASE WHEN failed_login_count + 1 >= ? THEN ? ELSE locked_until END,
                       failed_login_count = CASE WHEN failed_login_count + 1 >= ? THEN 0 ELSE failed_login_count + 1 END
                 WHERE id = ?""",
                maxFailures, OffsetDateTime.ofInstant(lockUntil, ZoneOffset.UTC), maxFailures, id.value());
    }

    public void recordSuccessfulLogin(StaffId id) {
        jdbc.update("UPDATE staff_user SET failed_login_count = 0, locked_until = NULL WHERE id = ?", id.value());
    }

    public void updatePasswordHash(StaffId id, String passwordHash) {
        jdbc.update("UPDATE staff_user SET password_hash = ? WHERE id = ?", passwordHash, id.value());
    }

    public boolean isActive(StaffId id) {
        return Boolean.TRUE.equals(jdbc.query(
                "SELECT active FROM staff_user WHERE id = ?",
                rs -> rs.next() ? rs.getBoolean(1) : Boolean.FALSE,
                id.value()));
    }

    public boolean ownerExists() {
        return Boolean.TRUE.equals(
                jdbc.queryForObject("SELECT exists(SELECT 1 FROM staff_user WHERE role = 'OWNER')", Boolean.class));
    }

    public void insert(StaffId id, String email, String displayName, StaffRole role, String passwordHash) {
        jdbc.update(
                "INSERT INTO staff_user (id, email, display_name, role, password_hash) VALUES (?, ?, ?, ?, ?)",
                id.value(), email, displayName, role.name(), passwordHash);
    }
}
