package pl.cavella.staff.application;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import pl.cavella.staff.StaffPrincipal;

/** Resolves the acting staff member from the security context (never from request data). */
public final class CurrentStaff {

    private CurrentStaff() {}

    /**
     * Defence in depth behind {@code @PreAuthorize}: even if a role check were misconfigured, a
     * command can only run with a real staff principal to attribute it to.
     */
    public static StaffPrincipal require() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof StaffPrincipal staff) {
            return staff;
        }
        throw new AccessDeniedException("Staff authentication required");
    }
}
