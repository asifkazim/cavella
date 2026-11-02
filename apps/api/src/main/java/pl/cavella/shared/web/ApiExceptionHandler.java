package pl.cavella.shared.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;

/**
 * Centralised error handling for cross-cutting failures (ARCHITECTURE §5.3). Module-specific
 * exceptions are mapped by their own advices, which run first. Responses never contain stack
 * traces, SQL, or echoed input.
 */
@RestControllerAdvice
@Order(Ordered.LOWEST_PRECEDENCE)
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    public static final String IDEMPOTENCY_HEADER = "Idempotency-Key";

    @ExceptionHandler(InvalidRequestException.class)
    ResponseEntity<ProblemDetail> invalidRequest(InvalidRequestException e, HttpServletRequest request) {
        return Problems.response(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", e.getMessage(), request);
    }

    @ExceptionHandler(RateLimitedException.class)
    ResponseEntity<ProblemDetail> rateLimited(RateLimitedException e, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(e.retryAfterSeconds()))
                .body(Problems.detail(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many requests", request));
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ProblemDetail> unauthenticated(AuthenticationException e, HttpServletRequest request) {
        return Problems.response(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication required", request);
    }

    @ExceptionHandler(CsrfException.class)
    ResponseEntity<ProblemDetail> csrf(CsrfException e, HttpServletRequest request) {
        return Problems.response(HttpStatus.FORBIDDEN, "CSRF_INVALID", "Missing or invalid CSRF token", request);
    }

    /** Anonymous callers get 401 (log in); authenticated callers without the role get 403. */
    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ProblemDetail> accessDenied(AccessDeniedException e, HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth instanceof AnonymousAuthenticationToken || !auth.isAuthenticated()) {
            return unauthenticated(null, request);
        }
        return Problems.response(HttpStatus.FORBIDDEN, "FORBIDDEN", "Not allowed", request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> unexpected(Exception e, HttpServletRequest request) {
        log.error("Unhandled exception (requestId={})", RequestIdFilter.of(request), e);
        return Problems.response(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Unexpected error", request);
    }

    /**
     * Standard Spring MVC exceptions (validation, malformed JSON, unknown routes …): keep Spring's
     * status but add the {@code code} contract and replace details that could echo user input.
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, Object body, HttpHeaders headers, HttpStatusCode status, WebRequest webRequest) {
        HttpServletRequest request = ((ServletWebRequest) webRequest).getRequest();
        ProblemDetail problem = body instanceof ProblemDetail p ? p : ProblemDetail.forStatus(status);
        String code = switch (ex) {
            case MissingRequestHeaderException m when IDEMPOTENCY_HEADER.equalsIgnoreCase(m.getHeaderName()) -> {
                problem.setDetail("The Idempotency-Key header is required");
                yield "IDEMPOTENCY_KEY_REQUIRED";
            }
            case MethodArgumentNotValidException invalid -> {
                problem.setDetail("Request validation failed");
                problem.setProperty("errors", invalid.getBindingResult().getFieldErrors().stream()
                        .map(f -> Map.of("field", f.getField(), "code", String.valueOf(f.getCode())))
                        .toList());
                yield "VALIDATION_FAILED";
            }
            case HandlerMethodValidationException invalid -> {
                problem.setDetail("Request validation failed");
                yield "VALIDATION_FAILED";
            }
            case HttpMessageNotReadableException unreadable -> {
                problem.setDetail("Malformed or unexpected request body");
                yield "VALIDATION_FAILED";
            }
            case TypeMismatchException mismatch -> {
                problem.setDetail("Invalid value for '" + mismatch.getPropertyName() + "'");
                yield "VALIDATION_FAILED";
            }
            case NoResourceFoundException notFound -> {
                problem.setDetail("No such resource");
                yield "NOT_FOUND";
            }
            case HttpRequestMethodNotSupportedException m -> "METHOD_NOT_ALLOWED";
            case HttpMediaTypeNotSupportedException m -> "UNSUPPORTED_MEDIA_TYPE";
            default -> status.value() == 400 ? "VALIDATION_FAILED" : "HTTP_" + status.value();
        };
        Problems.enrich(problem, code, request);
        return super.handleExceptionInternal(ex, problem, headers, status, webRequest);
    }
}
