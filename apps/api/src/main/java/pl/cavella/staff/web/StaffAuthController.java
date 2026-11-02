package pl.cavella.staff.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import pl.cavella.shared.web.RateLimitProperties;
import pl.cavella.shared.web.RateLimiter;
import pl.cavella.staff.StaffPrincipal;
import pl.cavella.staff.application.CurrentStaff;
import pl.cavella.staff.application.StaffAuthenticationService;

/**
 * Staff session lifecycle (ARCHITECTURE §5.2, §7). Logout is handled by the security filter
 * chain at {@code POST /api/v1/staff/auth/logout}.
 */
@RestController
class StaffAuthController {

    record CsrfResponse(String headerName, String token) {}

    record LoginRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 200) String password) {

        /** Never print the password, e.g. in validation logs. */
        @Override
        public String toString() {
            return "LoginRequest[email=" + email + ", password=redacted]";
        }
    }

    record StaffResponse(UUID id, String role) {
        static StaffResponse of(StaffPrincipal staff) {
            return new StaffResponse(staff.id().value(), staff.role().name());
        }
    }

    /** The CSRF token rotates on login; the client must use this one from now on. */
    record LoginResponse(StaffResponse staff, String csrfToken) {}

    private final StaffAuthenticationService authentication;
    private final SessionAuthenticationStrategy loginSessionStrategy;
    private final SecurityContextRepository securityContexts;
    private final RateLimiter rateLimiter;
    private final RateLimitProperties limits;
    private final StaffSessionLifetime sessionLifetime;

    StaffAuthController(
            StaffAuthenticationService authentication,
            SessionAuthenticationStrategy loginSessionStrategy,
            SecurityContextRepository securityContexts,
            RateLimiter rateLimiter,
            RateLimitProperties limits,
            StaffSessionLifetime sessionLifetime) {
        this.authentication = authentication;
        this.loginSessionStrategy = loginSessionStrategy;
        this.securityContexts = securityContexts;
        this.rateLimiter = rateLimiter;
        this.limits = limits;
        this.sessionLifetime = sessionLifetime;
    }

    /**
     * Starts a session and returns its CSRF token; call before logging in. Public, so it is
     * rate-limited before any session is written, and a pre-login session expires quickly (L2).
     */
    @GetMapping("/api/v1/staff/auth/csrf")
    CsrfResponse csrf(CsrfToken token, HttpServletRequest request) {
        rateLimiter.checkClient("csrf", request.getRemoteAddr(), limits.csrfTokensPerMinute(), Duration.ofMinutes(1));
        String value = token.getToken(); // deferred token: this is what creates the session
        HttpSession session = request.getSession(false);
        if (session != null) {
            sessionLifetime.limitIfAnonymous(session);
        }
        return new CsrfResponse(token.getHeaderName(), value);
    }

    @PostMapping("/api/v1/staff/auth/login")
    LoginResponse login(
            @Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        rateLimiter.checkClient("login", request.getRemoteAddr(), limits.loginAttemptsPerMinute(), Duration.ofMinutes(1));
        StaffPrincipal staff = authentication.login(body.email(), body.password());

        Authentication auth = UsernamePasswordAuthenticationToken.authenticated(
                staff, null, List.of(new SimpleGrantedAuthority(staff.role().authority())));
        loginSessionStrategy.onAuthentication(auth, request, response); // new session id + new CSRF token
        sessionLifetime.start(request.getSession()); // the shift starts now (FR-S-02)
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        securityContexts.saveContext(context, request, response);

        CsrfToken rotated = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        return new LoginResponse(StaffResponse.of(staff), rotated.getToken());
    }

    @GetMapping("/api/v1/staff/me")
    StaffResponse me() {
        return StaffResponse.of(CurrentStaff.require());
    }
}
