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
 * Re-checks on every request that the session's staff member may still act:
 * <ul>
 *   <li>the shift-length session lifetime has not run out (PRD FR-S-02), and</li>
 *   <li>the account is still active, so deactivating it cuts off its sessions immediately
 *       (PRD E-13, AC-S-03).</li>
 * </ul>
 * Otherwise the session is destroyed and the request continues as anonymous, so the
 * authorization rules answer 401.
 *
 * <p>Not a Spring bean on purpose: it must run only inside the security filter chain.
 */
public class ActiveStaffFilter extends OncePerRequestFilter {

    private final StaffRepository staff;
    private final StaffSessionLifetime lifetime;

    public ActiveStaffFilter(StaffRepository staff, StaffSessionLifetime lifetime) {
        this.staff = staff;
        this.lifetime = lifetime;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof StaffPrincipal principal) {
            HttpSession session = request.getSession(false);
            boolean expired = session == null || lifetime.isExpired(session);
            if (expired || !staff.isActive(principal.id())) {
                SecurityContextHolder.clearContext();
                if (session != null) {
                    session.invalidate();
                }
            }
        }
        chain.doFilter(request, response);
    }
}
