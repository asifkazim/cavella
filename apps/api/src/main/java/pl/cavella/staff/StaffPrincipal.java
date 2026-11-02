package pl.cavella.staff;

import java.io.Serializable;
import java.security.Principal;
import java.util.Objects;

/**
 * The authenticated staff member, stored as the Spring Security principal.
 * The loyalty module reads the acting staff from the security context — never from the
 * request payload — so a client cannot attribute a stamp to someone else (PRD T-05).
 *
 * <p>Serializable because it lives in the JDBC-backed HTTP session; {@link #getName()} is the
 * staff id, which Spring Session indexes so all sessions of one person can be revoked.
 */
public record StaffPrincipal(StaffId id, StaffRole role) implements Principal, Serializable {

    public StaffPrincipal {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(role, "role");
    }

    @Override
    public String getName() {
        return id.value().toString();
    }
}
