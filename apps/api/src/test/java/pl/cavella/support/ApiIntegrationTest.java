package pl.cavella.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import pl.cavella.staff.StaffPrincipal;

/** HTTP-level integration tests: MockMvc through the real security filter chain and Spring Session. */
@AutoConfigureMockMvc
public abstract class ApiIntegrationTest extends IntegrationTest {

    protected static final String SESSION_COOKIE = "__Host-cavella_sid";
    protected static final String CSRF_HEADER = "X-CSRF-Token";
    protected static final String PASSWORD = "correct horse battery staple";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /** Unique client IP per test, so in-memory rate limits never leak between tests. */
    protected String clientIp;

    @BeforeEach
    void pickClientIp() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        clientIp = "10." + r.nextInt(256) + "." + r.nextInt(256) + "." + r.nextInt(1, 255);
    }

    /** Applies this test's client IP to a request. */
    protected MockHttpServletRequestBuilder fromClient(MockHttpServletRequestBuilder request) {
        return request.with(r -> {
            r.setRemoteAddr(clientIp);
            return r;
        });
    }

    /** A logged-in staff session: the session cookie plus its current CSRF token. */
    public record StaffSession(Cookie cookie, String csrfToken) {
        public MockHttpServletRequestBuilder apply(MockHttpServletRequestBuilder request) {
            return request.cookie(cookie).header(CSRF_HEADER, csrfToken);
        }
    }

    protected String emailOf(StaffPrincipal staff) {
        return staff.id().value() + "@staff.test";
    }

    /** Gives a seeded staff account a password so it can log in over HTTP. */
    protected void givenPassword(StaffPrincipal staff) {
        jdbc.update("UPDATE staff_user SET password_hash = ? WHERE id = ?",
                passwordEncoder.encode(PASSWORD), staff.id().value());
    }

    /** Fetches a CSRF token, which also starts an anonymous session. */
    protected StaffSession anonymousSession() throws Exception {
        MvcResult result = mvc.perform(fromClient(get("/api/v1/staff/auth/csrf"))).andExpect(status().isOk()).andReturn();
        return new StaffSession(
                sessionCookie(result),
                JsonPath.read(result.getResponse().getContentAsString(), "$.token"));
    }

    /** The session cookie set by a response; fails with the actual Set-Cookie headers if absent. */
    protected static Cookie sessionCookie(MvcResult result) {
        Cookie cookie = result.getResponse().getCookie(SESSION_COOKIE);
        if (cookie == null) {
            throw new AssertionError("No " + SESSION_COOKIE + " cookie; Set-Cookie headers were: "
                    + result.getResponse().getHeaders("Set-Cookie"));
        }
        return cookie;
    }

    protected MvcResult attemptLogin(StaffSession session, String email, String password) throws Exception {
        String body = "{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password);
        return mvc.perform(fromClient(session.apply(post("/api/v1/staff/auth/login")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn();
    }

    protected StaffSession login(StaffPrincipal staff) throws Exception {
        givenPassword(staff);
        MvcResult result = attemptLogin(anonymousSession(), emailOf(staff), PASSWORD);
        if (result.getResponse().getStatus() != 200) {
            throw new AssertionError("login failed: " + result.getResponse().getContentAsString());
        }
        return new StaffSession(
                result.getResponse().getCookie(SESSION_COOKIE),
                JsonPath.read(result.getResponse().getContentAsString(), "$.csrfToken"));
    }
}
