package pl.cavella.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.test.web.servlet.MvcResult;
import pl.cavella.support.ApiIntegrationTest;
import pl.cavella.support.Staff;

/** Staff authentication over HTTP (ARCHITECTURE §7, PRD AC-S-03, AC-S-07). */
class StaffAuthApiIT extends ApiIntegrationTest {

    @Test
    void loginStartsAHardenedSessionWithANewIdAndANewCsrfToken() throws Exception {
        givenPassword(Staff.CASHIER_ANNA);
        StaffSession anonymous = anonymousSession();

        MvcResult result = attemptLogin(anonymous, emailOf(Staff.CASHIER_ANNA), PASSWORD);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        String body = result.getResponse().getContentAsString();
        assertThat((String) JsonPath.read(body, "$.staff.role")).isEqualTo("CASHIER");
        assertThat((String) JsonPath.read(body, "$.staff.id")).isEqualTo(Staff.CASHIER_ANNA.id().value().toString());
        assertThat(body).doesNotContain(PASSWORD);

        StaffSession session = new StaffSession(
                result.getResponse().getCookie(SESSION_COOKIE), JsonPath.read(body, "$.csrfToken"));
        assertThat(session.cookie().getValue()).as("session fixation protection").isNotEqualTo(anonymous.cookie().getValue());
        assertThat(session.csrfToken()).as("CSRF token rotates on login").isNotEqualTo(anonymous.csrfToken());
        assertThat(String.join("\n", result.getResponse().getHeaders("Set-Cookie")))
                .contains(SESSION_COOKIE)
                .contains("HttpOnly")
                .contains("Secure")
                .contains("SameSite=Strict");

        mvc.perform(fromClient(get("/api/v1/staff/me")).cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("CASHIER"));

        // Stored server-side, indexed by staff id (revocable), with a shift-length lifetime (FR-S-02).
        String sessionId = new String(java.util.Base64.getDecoder().decode(session.cookie().getValue()));
        var stored = jdbc.queryForMap(
                "SELECT principal_name, max_inactive_interval FROM spring_session WHERE session_id = ?", sessionId);
        assertThat(stored.get("principal_name")).isEqualTo(Staff.CASHIER_ANNA.id().value().toString());
        assertThat(stored.get("max_inactive_interval")).isEqualTo(12 * 60 * 60);
    }

    @Test
    void wrongPasswordsAndUnknownEmailsGetTheSameAnswer() throws Exception {
        givenPassword(Staff.CASHIER_ANNA);

        MvcResult wrongPassword = attemptLogin(anonymousSession(), emailOf(Staff.CASHIER_ANNA), "not the password");
        MvcResult unknownEmail = attemptLogin(anonymousSession(), "nobody@staff.test", PASSWORD);

        for (MvcResult result : new MvcResult[] {wrongPassword, unknownEmail}) {
            assertThat(result.getResponse().getStatus()).isEqualTo(401);
            assertThat((String) JsonPath.read(result.getResponse().getContentAsString(), "$.code"))
                    .isEqualTo("INVALID_CREDENTIALS");
            assertThat((String) JsonPath.read(result.getResponse().getContentAsString(), "$.detail"))
                    .isEqualTo("Invalid email or password");
        }
    }

    @Test
    void fiveFailedAttemptsLockTheAccountEvenForTheRightPassword() throws Exception {
        givenPassword(Staff.CASHIER_ANNA);
        for (int i = 0; i < 5; i++) {
            assertThat(attemptLogin(anonymousSession(), emailOf(Staff.CASHIER_ANNA), "wrong-" + i)
                    .getResponse().getStatus()).isEqualTo(401);
        }

        MvcResult locked = attemptLogin(anonymousSession(), emailOf(Staff.CASHIER_ANNA), PASSWORD);

        assertThat(locked.getResponse().getStatus()).isEqualTo(423);
        assertThat(locked.getResponse().getHeader("Retry-After")).isNotBlank();
        assertThat((String) JsonPath.read(locked.getResponse().getContentAsString(), "$.code")).isEqualTo("ACCOUNT_LOCKED");
    }

    @Test
    void loginWithoutACsrfTokenIsRejected() throws Exception {
        givenPassword(Staff.CASHIER_ANNA);
        StaffSession anonymous = anonymousSession();

        mvc.perform(fromClient(post("/api/v1/staff/auth/login"))
                        .cookie(anonymous.cookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(emailOf(Staff.CASHIER_ANNA), PASSWORD)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void invalidLoginInputIsAValidationError() throws Exception {
        StaffSession anonymous = anonymousSession();

        mvc.perform(fromClient(anonymous.apply(post("/api/v1/staff/auth/login")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[?(@.field == 'email')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'password')]").exists());
    }

    @Test
    void logoutEndsTheSession() throws Exception {
        StaffSession session = login(Staff.CASHIER_ANNA);

        mvc.perform(fromClient(session.apply(post("/api/v1/staff/auth/logout")))).andExpect(status().isNoContent());

        mvc.perform(fromClient(get("/api/v1/staff/me")).cookie(session.cookie()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void deactivatingAnAccountCutsOffItsSessionImmediately() throws Exception {
        StaffSession session = login(Staff.CASHIER_ANNA);

        jdbc.update("UPDATE staff_user SET active = false WHERE id = ?", Staff.CASHIER_ANNA.id().value());

        mvc.perform(fromClient(get("/api/v1/staff/me")).cookie(session.cookie()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void thereIsNoFrameworkDefaultUserWithAGeneratedPassword(@Autowired UserDetailsService users) {
        assertThatThrownBy(() -> users.loadUserByUsername("user")).isInstanceOf(UsernameNotFoundException.class);
    }

    @Test
    void anonymousCallersGetAProblemResponse() throws Exception {
        mvc.perform(fromClient(get("/api/v1/staff/me")))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.requestId").exists());
    }
}
