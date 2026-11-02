package pl.cavella.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

/**
 * Staff session cookie, configured explicitly rather than through auto-configuration:
 * {@code server.servlet.session.cookie.*} did not reach Spring Session's cookie in this setup
 * (found by StaffAuthApiIT), and these attributes are security-critical.
 *
 * <p>HttpOnly and SameSite=Strict are always on. Only the name and the Secure flag can be
 * overridden, for plain-http local development (application-dev.yaml).
 */
@Configuration
@EnableConfigurationProperties(SessionConfig.SessionCookieProperties.class)
public class SessionConfig {

    /** {@code cavella.session.cookie.*}; defaults are the production values. */
    @ConfigurationProperties("cavella.session.cookie")
    public record SessionCookieProperties(String name, Boolean secure) {
        public SessionCookieProperties {
            name = name == null || name.isBlank() ? "__Host-cavella_sid" : name;
            secure = secure == null || secure;
        }
    }

    @Bean
    CookieSerializer sessionCookieSerializer(SessionCookieProperties properties) {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName(properties.name());
        serializer.setCookiePath("/"); // required by the __Host- prefix
        serializer.setUseHttpOnlyCookie(true);
        serializer.setUseSecureCookie(properties.secure());
        serializer.setSameSite("Strict");
        return serializer;
    }
}
