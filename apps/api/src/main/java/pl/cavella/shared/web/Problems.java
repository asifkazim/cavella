package pl.cavella.shared.web;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Locale;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;

/**
 * Builds RFC 9457 problem responses with the stable {@code code} contract (ARCHITECTURE §5.3).
 * Every error response in the API goes through here, so they all look the same.
 */
public final class Problems {

    private Problems() {}

    public static ProblemDetail detail(HttpStatusCode status, String code, String detail, HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        enrich(problem, code, request);
        return problem;
    }

    /** Adds {@code type}, {@code code}, {@code instance} and {@code requestId} to an existing problem. */
    public static void enrich(ProblemDetail problem, String code, HttpServletRequest request) {
        problem.setType(URI.create("urn:cavella:problem:" + code.toLowerCase(Locale.ROOT).replace('_', '-')));
        problem.setProperty("code", code);
        if (request != null) {
            problem.setInstance(URI.create(request.getRequestURI()));
            String requestId = RequestIdFilter.of(request);
            if (requestId != null) {
                problem.setProperty("requestId", requestId);
            }
        }
    }

    public static ResponseEntity<ProblemDetail> response(
            HttpStatusCode status, String code, String detail, HttpServletRequest request) {
        return ResponseEntity.status(status).body(detail(status, code, detail, request));
    }
}
