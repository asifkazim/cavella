package pl.cavella.support;

import java.util.List;
import java.util.concurrent.Callable;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import pl.cavella.staff.StaffPrincipal;

/**
 * Runs code as a given caller on the <em>current thread</em>. Works inside executor threads,
 * which annotation-based helpers like {@code @WithMockUser} do not reach.
 */
public final class SecurityContexts {

    private SecurityContexts() {}

    public static Authentication staff(StaffPrincipal principal) {
        return UsernamePasswordAuthenticationToken.authenticated(
                principal, null, List.of(new SimpleGrantedAuthority(principal.role().authority())));
    }

    /** An authenticated user that is not staff (e.g. a future customer login). */
    public static Authentication customer() {
        return UsernamePasswordAuthenticationToken.authenticated(
                "customer", null, List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER")));
    }

    public static <T> T callAs(Authentication authentication, Callable<T> action) throws Exception {
        SecurityContext previous = SecurityContextHolder.getContext();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        try {
            return action.call();
        } finally {
            SecurityContextHolder.setContext(previous);
        }
    }

    public static <T> T callAs(StaffPrincipal staff, Callable<T> action) throws Exception {
        return callAs(staff(staff), action);
    }

    /** Runs with no authentication at all. */
    public static <T> T callAnonymously(Callable<T> action) throws Exception {
        SecurityContext previous = SecurityContextHolder.getContext();
        SecurityContextHolder.clearContext();
        try {
            return action.call();
        } finally {
            SecurityContextHolder.setContext(previous);
        }
    }
}
