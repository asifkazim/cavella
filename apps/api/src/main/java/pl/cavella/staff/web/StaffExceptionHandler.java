package pl.cavella.staff.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import pl.cavella.shared.web.Problems;
import pl.cavella.staff.application.StaffAuthenticationException;

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class StaffExceptionHandler {

    @ExceptionHandler(StaffAuthenticationException.class)
    ResponseEntity<ProblemDetail> login(StaffAuthenticationException e, HttpServletRequest request) {
        HttpStatus status = HttpStatus.valueOf(e.httpStatus());
        ResponseEntity.BodyBuilder response = ResponseEntity.status(status);
        if (e instanceof StaffAuthenticationException.AccountLocked locked) {
            response.header(HttpHeaders.RETRY_AFTER, Long.toString(Math.max(1, locked.retryAfter().toSeconds())));
        }
        return response.body(Problems.detail(status, e.code(), e.getMessage(), request));
    }
}
