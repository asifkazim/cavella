package pl.cavella.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import pl.cavella.support.ApiIntegrationTest;
import pl.cavella.support.Staff;

/**
 * L2: {@code GET /staff/auth/csrf} is public and starts a server-side session. Without limits
 * anyone could fill the session table (read on every staff request) with 12-hour rows.
 */
class CsrfSessionApiIT extends ApiIntegrationTest {

    private static final int ANONYMOUS_IDLE_SECONDS = 10 * 60;
    private static final int STAFF_IDLE_SECONDS = 12 * 60 * 60;

    private int maxInactiveInterval(Cookie cookie) {
        String sessionId = new String(Base64.getDecoder().decode(cookie.getValue()));
        return jdbc.queryForObject(
                "SELECT max_inactive_interval FROM spring_session WHERE session_id = ?", Integer.class, sessionId);
    }

    private int sessionCount() {
        return jdbc.queryForObject("SELECT count(*) FROM spring_session", Integer.class);
    }

    @Test
    void aSessionHoldingOnlyACsrfTokenExpiresQuickly() throws Exception {
        StaffSession anonymous = anonymousSession();

        assertThat(maxInactiveInterval(anonymous.cookie())).isEqualTo(ANONYMOUS_IDLE_SECONDS);
    }

    @Test
    void loggingInRestoresTheShiftLengthIdleTimeout() throws Exception {
        StaffSession staff = login(Staff.CASHIER_ANNA);

        assertThat(maxInactiveInterval(staff.cookie())).isEqualTo(STAFF_IDLE_SECONDS);
    }

    @Test
    void aSignedInSessionFetchingAFreshTokenKeepsItsTimeout() throws Exception {
        StaffSession staff = login(Staff.CASHIER_ANNA);

        mvc.perform(fromClient(get("/api/v1/staff/auth/csrf")).cookie(staff.cookie())).andExpect(status().isOk());

        assertThat(maxInactiveInterval(staff.cookie())).isEqualTo(STAFF_IDLE_SECONDS);
    }

    @Test
    void anonymousTokenRequestsAreRateLimitedPerClientAndRejectedOnesCreateNoSession() throws Exception {
        for (int i = 0; i < 30; i++) {
            mvc.perform(fromClient(get("/api/v1/staff/auth/csrf"))).andExpect(status().isOk());
        }
        int sessionsBefore = sessionCount();

        for (int i = 0; i < 5; i++) {
            mvc.perform(fromClient(get("/api/v1/staff/auth/csrf")))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(header().exists("Retry-After"))
                    .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
        }

        assertThat(sessionCount()).as("a rejected request must not write a session row").isEqualTo(sessionsBefore);
    }
}
