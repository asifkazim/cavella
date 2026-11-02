package pl.cavella.config;

import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.HandlerExceptionResolver;
import pl.cavella.shared.web.RateLimitProperties;
import pl.cavella.staff.persistence.StaffRepository;
import pl.cavella.staff.web.ActiveStaffFilter;

/**
 * HTTP security (ARCHITECTURE §7). Composition root: wires the modules' web pieces together.
 *
 * <ul>
 *   <li>Public: card creation and card read by bearer token (no cookies, so no CSRF).</li>
 *   <li>Staff: server-side session (Spring Session JDBC), {@code __Host-} cookie, CSRF token in
 *       the {@code X-CSRF-Token} header.</li>
 *   <li>Everything else is denied by default.</li>
 *   <li>401/403 from the filter chain go through the same problem-detail handler as controllers.</li>
 * </ul>
 */
@Configuration
@EnableConfigurationProperties({RateLimitProperties.class, CorsProperties.class})
public class WebSecurityConfig {

    public static final String CSRF_HEADER = "X-CSRF-Token";

    /** bcrypt (cost 12) behind a delegating encoder, so hashes can migrate to Argon2id later (SEC-04, APR-07). */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new DelegatingPasswordEncoder("bcrypt", Map.of("bcrypt", new BCryptPasswordEncoder(12)));
    }

    /**
     * Staff authenticate only through StaffAuthenticationService. This explicit, empty user store
     * stops Spring Boot from creating a default "user" whose generated password it prints to
     * the log (found in the smoke test).
     */
    @Bean
    UserDetailsService noFrameworkManagedUsers() {
        return new InMemoryUserDetailsManager();
    }

    @Bean
    CsrfTokenRepository csrfTokenRepository() {
        HttpSessionCsrfTokenRepository repository = new HttpSessionCsrfTokenRepository();
        repository.setHeaderName(CSRF_HEADER);
        return repository;
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /**
     * Applied on login: new session id (prevents session fixation) and a fresh CSRF token. The
     * raw (non-XOR) token handler matches what single-page clients send back in the header.
     */
    @Bean
    SessionAuthenticationStrategy loginSessionStrategy(CsrfTokenRepository csrfTokens) {
        CsrfAuthenticationStrategy csrf = new CsrfAuthenticationStrategy(csrfTokens);
        csrf.setRequestHandler(new CsrfTokenRequestAttributeHandler());
        return new CompositeSessionAuthenticationStrategy(List.of(new ChangeSessionIdAuthenticationStrategy(), csrf));
    }

    /** Filter-level 401/403 are rendered by the same advice as controller errors. */
    @Bean
    ProblemSecurityHandler problemSecurityHandler(
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver) {
        return new ProblemSecurityHandler(resolver);
    }

    @Bean
    SecurityFilterChain apiSecurity(
            HttpSecurity http,
            CsrfTokenRepository csrfTokens,
            SecurityContextRepository contexts,
            ProblemSecurityHandler problems,
            StaffRepository staff)
            throws Exception {
        // Uses the bean named "corsConfigurationSource" below (MVC also exposes one, so not by type).
        http.cors(Customizer.withDefaults())
                .csrf(c -> c.csrfTokenRepository(csrfTokens)
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
                        // Bearer-token endpoints use no cookies, so cross-site request forgery does not apply.
                        .ignoringRequestMatchers("/api/v1/cards", "/api/v1/cards/**"))
                .securityContext(c -> c.securityContextRepository(contexts))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.POST, "/api/v1/cards").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/cards/self").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/staff/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/staff/auth/login").permitAll()
                        .requestMatchers("/api/v1/admin/**").hasRole("OWNER")
                        .requestMatchers("/api/v1/staff/**").hasAnyRole("CASHIER", "OWNER")
                        .requestMatchers("/error").permitAll()
                        .anyRequest().denyAll())
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .logout(l -> l.logoutUrl("/api/v1/staff/auth/logout")
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
                .exceptionHandling(e -> e.authenticationEntryPoint(problems).accessDeniedHandler(problems))
                .addFilterBefore(new ActiveStaffFilter(staff), AnonymousAuthenticationFilter.class);
        return http.build();
    }

    /** Only the configured web origins may call the API from a browser; none when unset. */
    @Bean
    CorsConfigurationSource corsConfigurationSource(CorsProperties properties) {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        List<String> origins = properties.allowedOrigins() == null ? List.of() : properties.allowedOrigins().stream()
                .filter(o -> !o.isBlank())
                .toList();
        if (!origins.isEmpty()) {
            CorsConfiguration config = new CorsConfiguration();
            config.setAllowedOrigins(origins);
            config.setAllowedMethods(List.of("GET", "POST"));
            config.setAllowedHeaders(List.of("Content-Type", "X-Card-Token", CSRF_HEADER, "Idempotency-Key"));
            config.setExposedHeaders(List.of("X-Request-Id", "Idempotent-Replayed", "Retry-After"));
            config.setAllowCredentials(true);
            config.setMaxAge(600L);
            source.registerCorsConfiguration("/api/**", config);
        }
        return source;
    }

    /** Delegates security errors to the MVC exception resolver (and so to the problem-detail advice). */
    static final class ProblemSecurityHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

        private final HandlerExceptionResolver resolver;

        ProblemSecurityHandler(HandlerExceptionResolver resolver) {
            this.resolver = resolver;
        }

        @Override
        public void commence(
                jakarta.servlet.http.HttpServletRequest request,
                jakarta.servlet.http.HttpServletResponse response,
                org.springframework.security.core.AuthenticationException authException) {
            resolver.resolveException(request, response, null, authException);
        }

        @Override
        public void handle(
                jakarta.servlet.http.HttpServletRequest request,
                jakarta.servlet.http.HttpServletResponse response,
                org.springframework.security.access.AccessDeniedException accessDeniedException) {
            resolver.resolveException(request, response, null, accessDeniedException);
        }
    }
}
