package pl.cavella.staff.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import pl.cavella.staff.StaffPrincipal;
import pl.cavella.staff.persistence.StaffRepository;

/**
 * Re-checks on every request that the session's staff member is still active, so deactivating
 * an account cuts off its sessions immediately (PRD E-13, AC-S-03). The request then continues
 * as anonymous and the authorization rules answer 401.
 *
 * <p>Not a Spring bean on purpose: it must run only inside the security filter chain.
 */
public class ActiveStaffFilter extends OncePerRequestFilter {

    private final StaffRepository staff;

    public ActiveStaffFilter(StaffRepository staff) {
        this.staff = staff;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof StaffPrincipal principal && !staff.isActive(principal.id())) {
            SecurityContextHolder.clearContext();
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
        }
        chain.doFilter(request, response);
    }
}
